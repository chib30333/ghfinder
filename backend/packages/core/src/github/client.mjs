import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cacheFileFor(url) {
  const h = createHash('sha1').update(url).digest('hex');
  return join(config.cachePath, `${h}.json`);
}

function readCache(url) {
  const f = cacheFileFor(url);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(url, entry) {
  if (!existsSync(config.cachePath)) mkdirSync(config.cachePath, { recursive: true });
  writeFileSync(cacheFileFor(url), JSON.stringify(entry));
}

export class GitHub {
  constructor({ token = config.token, log = console.error } = {}) {
    this.token = token;
    this.log = log;
    this.requests = 0;
  }

  headers(extra = {}) {
    return {
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': config.apiVersion,
      'User-Agent': config.userAgent,
      ...extra,
    };
  }

  async honorPrimaryLimit(res, floor) {
    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    if (Number.isFinite(remaining) && remaining <= floor && Number.isFinite(reset)) {
      const waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000;
      this.log(`[rate] ${remaining} left; sleeping ${Math.ceil(waitMs / 1000)}s until reset`);
      await sleep(waitMs);
    }
  }

  // Snapshot every rate-limit window (core, search, graphql, …). GitHub does not
  // charge this endpoint against the budget it reports, so it is safe to poll.
  // Deliberately bypasses getJson(): its ETag cache would answer a 304 with a
  // stale snapshot, which is exactly the number we must never show.
  async getRateLimit() {
    if (!this.token) return { ok: false, reason: 'missing_token' };
    const res = await fetch(`${config.apiBase}/rate_limit`, { headers: this.headers() });
    if (res.status === 401) return { ok: false, reason: 'bad_token' };
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const body = await res.json();
    return { ok: true, resources: body?.resources ?? {} };
  }

  async getJson(path, { floor = 2, retries = 6 } = {}) {
    if (!this.token) {
      throw new Error(
        'GITHUB_TOKEN is not set. Add it to backend/.env before starting a Discovery crawl.',
      );
    }
    const url = path.startsWith('http') ? path : `${config.apiBase}${path}`;
    const cached = readCache(url);

    for (let attempt = 0; ; attempt++) {
      const extra = {};
      if (cached?.etag) extra['If-None-Match'] = cached.etag;

      let res;
      try {
        res = await fetch(url, { headers: this.headers(extra) });
      } catch (err) {
        if (attempt >= retries) throw err;
        const backoff = Math.min(60000, 1000 * 2 ** attempt);
        this.log(`[net] ${err.code || err.message}; retry in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      this.requests++;

      if (res.status === 304 && cached) {
        await this.honorPrimaryLimit(res, floor);
        return cached.body;
      }

      if (res.status === 200) {
        const body = await res.json();
        const etag = res.headers.get('etag');
        writeCache(url, { etag, body });
        await this.honorPrimaryLimit(res, floor);
        return body;
      }

      if (res.status === 403 || res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const reset = Number(res.headers.get('x-ratelimit-reset'));
        let waitMs;
        if (Number.isFinite(retryAfter)) waitMs = retryAfter * 1000;
        else if (Number.isFinite(reset)) waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000;
        else waitMs = Math.min(120000, 2000 * 2 ** attempt);
        this.log(`[rate] HTTP ${res.status}; backing off ${Math.ceil(waitMs / 1000)}s`);
        await sleep(waitMs);
        if (attempt >= retries) throw new Error(`giving up after ${retries} retries on ${url}`);
        continue;
      }

      if (res.status === 401) {
        // Bad credentials are deterministic — retrying the same token can never
        // succeed, so fail fast with an actionable message instead of backing off.
        const text = await res.text().catch(() => '');
        const looksPlaceholder = /placeholder/i.test(this.token || '');
        const hint = looksPlaceholder
          ? 'GITHUB_TOKEN is still the placeholder value — put a real GitHub ' +
            'personal access token in backend/.env to run a live Discovery crawl.'
          : 'Check GITHUB_TOKEN in backend/.env (expired, revoked, or wrong scope).';
        throw new Error(`GitHub 401 Bad credentials on ${url} — ${hint} ${text.slice(0, 200)}`);
      }

      if (res.status === 404) return null;
      if (res.status === 409) return null;
      if (res.status === 451) return null;
      if (res.status >= 500 && attempt < retries) {
        const backoff = Math.min(60000, 1000 * 2 ** attempt);
        this.log(`[http] ${res.status}; retry in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      const text = await res.text().catch(() => '');
      throw new Error(`GitHub ${res.status} on ${url}: ${text.slice(0, 200)}`);
    }
  }

  searchUsersPage(q, page) {
    const params = new URLSearchParams({
      q,
      sort: 'joined',
      order: 'asc',
      per_page: String(config.perPage),
      page: String(page),
    });
    return this.getJson(`/search/users?${params}`, { floor: 3 });
  }

  getUser(login) {
    return this.getJson(`/users/${encodeURIComponent(login)}`, { floor: 50 });
  }

  listUserRepos(login, perPage = 30) {
    const params = new URLSearchParams({
      type: 'owner',
      sort: 'pushed',
      direction: 'desc',
      per_page: String(perPage),
    });
    return this.getJson(`/users/${encodeURIComponent(login)}/repos?${params}`, { floor: 50 });
  }

  listRepoCommits(owner, repo, author, perPage = 5) {
    const params = new URLSearchParams({ author, per_page: String(perPage) });
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params}`;
    return this.getJson(path, { floor: 50 });
  }

  async getProfileReadme(login) {
    const l = encodeURIComponent(login);
    const data = await this.getJson(`/repos/${l}/${l}/readme`, { floor: 50 });
    if (!data?.content) return null;
    try {
      return Buffer.from(data.content, data.encoding || 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
}
