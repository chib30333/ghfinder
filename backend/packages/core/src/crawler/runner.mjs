import { GitHub } from '../github/client.mjs';
import { childWindows, canSplit } from './dates.mjs';
import { extractSocialLinks } from './social.mjs';
import { locationMatches } from './location.mjs';
import {
  nextCity,
  setCityStatus,
  cityStatus,
  insertSegment,
  nextSegment,
  setSegmentProgress,
  userExists,
  upsertUser,
  looksLikeOrg,
  counts,
} from '../db/index.mjs';
import { config } from '../config.mjs';

const CURRENT_YEAR = new Date().getUTCFullYear();

const MAX_CREATED_YEAR = 2021;
const CREATED_CEILING = `${MAX_CREATED_YEAR}-12-31`;

function createdAfterCutoff(createdAt) {
  if (!createdAt) return false;
  const year = Number(String(createdAt).slice(0, 4));
  return Number.isFinite(year) && year > MAX_CREATED_YEAR;
}

function toRow(u, sourceCityId) {
  return {
    id: u.id,
    login: u.login,
    name: u.name ?? null,
    company: u.company ?? null,
    blog: u.blog ?? null,
    location: u.location ?? null,
    email: u.email ?? null,
    bio: u.bio ?? null,
    twitter: u.twitter_username ?? null,
    public_repos: u.public_repos ?? null,
    public_gists: u.public_gists ?? null,
    followers: u.followers ?? null,
    following: u.following ?? null,
    hireable: u.hireable == null ? null : u.hireable ? 1 : 0,
    type: u.type ?? null,
    html_url: u.html_url ?? null,
    created_at: u.created_at ?? null,
    updated_at: u.updated_at ?? null,
    source_city_id: sourceCityId,
    fetched_at: new Date().toISOString(),
    email_source: u.email ? 'profile' : null,
    telegram: null,
    discord: null,
    raw: JSON.stringify(u),
  };
}

function segQuery(baseQuery, from, to) {
  return from && to ? `${baseQuery} created:${from}..${to}` : baseQuery;
}

function splitSegment(city, seg) {
  const kids = childWindows(seg, Math.min(CURRENT_YEAR, MAX_CREATED_YEAR));
  for (const w of kids) {
    insertSegment({
      city_id: city.id,
      q: segQuery(city.query, w.from, w.to),
      date_from: w.from,
      date_to: w.to,
      granularity: w.granularity,
    });
  }
  return kids.length;
}

function isExcludedCompany(company) {
  if (!company) return false;
  const c = company.toLowerCase();
  return c.includes('upwork') || c.includes('freelancer');
}

function isRealEmail(email) {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false;
  const e = email.toLowerCase();
  return !e.endsWith('@users.noreply.github.com') && e !== 'noreply@github.com';
}

function firstRealEmail(text) {
  const matches = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g);
  if (!matches) return null;
  for (const m of matches) if (isRealEmail(m)) return m;
  return null;
}

async function fetchReadme(gh, login) {
  if (!(config.readmeEmail || config.socialLinks)) return null;
  if (typeof gh.getProfileReadme !== 'function') return null;
  try {
    return (await gh.getProfileReadme(login)) || null;
  } catch (err) {
    gh.log?.(`[warn] readme fetch failed for ${login}: ${err.message}`);
    return null;
  }
}

async function emailFromCommits(gh, login) {
  if (config.emailRepoScan <= 0 || typeof gh.listUserRepos !== 'function') return null;
  try {
    const repos = await gh.listUserRepos(login);
    if (!Array.isArray(repos)) return null;
    const own = repos.filter((r) => r && !r.fork).slice(0, config.emailRepoScan);
    for (const r of own) {
      const commits = await gh.listRepoCommits(login, r.name, login);
      if (!Array.isArray(commits)) continue;
      for (const c of commits) {
        const email = c?.commit?.author?.email;
        if (isRealEmail(email)) return email;
      }
    }
    return null;
  } catch (err) {
    gh.log?.(`[warn] commit-email scan failed for ${login}: ${err.message}`);
    return null;
  }
}

async function fetchProfiles(gh, items, city, ctl) {
  let added = 0;
  for (const hit of items) {
    if (userExists(hit.login)) continue;
    const full = await gh.getUser(hit.login);
    if (!full) continue;
    if (full.type !== 'User') continue;
    if (createdAfterCutoff(full.created_at)) continue;
    if (isExcludedCompany(full.company)) continue;
    // Skip accounts whose display name is an organisation/company/group/bot rather
    // than a person — we only cold-email individuals, and {{firstName}} on an org
    // name renders a brand word ("Hi, TaylorMade").
    if (looksLikeOrg(full.name)) continue;
    // GitHub's `location:` qualifier is a fuzzy token match, not a geocoded
    // lookup: location:"Arab" (Arab, AL) also returns everyone in "Dubai, United
    // Arab Emirates", and location:"Houston" (Houston, AK) returns Houston, TX.
    // The profile we just fetched carries the real location, so re-check it here
    // — before the readme/repo/commit enrichment, so a wrong-place hit costs no
    // extra API calls. Hits rejected for naming another US state are not lost;
    // they are harvested when their own city row comes up in the work list.
    const geo = locationMatches(full.location, city.city, city.state, { strict: config.locationStrict });
    if (!geo.ok) {
      const tag = geo.reason.split(':')[0];
      ctl.rejects.set(tag, (ctl.rejects.get(tag) ?? 0) + 1);
      continue;
    }

    const row = toRow(full, city.id);

    const readme = await fetchReadme(gh, full.login);

    const readmeEmail = config.readmeEmail && readme ? firstRealEmail(readme) : null;
    if (readmeEmail) {
      row.email = readmeEmail;
      row.email_source = 'readme';
    } else if (!row.email) {
      const commitEmail = await emailFromCommits(gh, full.login);
      if (commitEmail) {
        row.email = commitEmail;
        row.email_source = 'commits';
      }
    }

    if (config.socialLinks) {
      const links = extractSocialLinks([full.bio, full.blog, readme]);
      row.telegram = links.telegram;
      row.discord = links.discord;
    }

    upsertUser(row);
    added++;
    ctl.added++;
    console.error(
      `[user] ${full.login} · ${row.email || 'no email'} · ${full.followers ?? 0}f` +
        (full.location ? ` · ${full.location}` : '') +
        (row.telegram || row.discord ? ' · social' : '')
    );
    if (ctl.maxProfiles && ctl.added >= ctl.maxProfiles) ctl.stopping = true;
  }
  return added;
}

async function processSegment(gh, city, seg, ctl) {
  const perPage = config.perPage;
  const hardPageCap = Math.ceil(config.searchResultCap / perPage);
  let total = seg.total_found;
  let page = seg.status === 'active' ? seg.next_page : 1;
  let added = 0;

  while (true) {
    const res = await gh.searchUsersPage(seg.q, page);
    const items = res?.items ?? [];

    if (total == null) {
      total = res?.total_count ?? 0;
      if (total > config.searchResultCap && canSplit(seg.granularity)) {
        const n = splitSegment(city, seg);
        setSegmentProgress(seg.id, 'split', 1, total);
        return { kind: 'split', total, children: n };
      }
    }

    added += await fetchProfiles(gh, items, city, ctl);
    console.error(`[search] ${city.city} page ${page} → ${items.length} hits` + (total != null ? ` of ${total}` : ''));

    const pageCap = Math.max(1, Math.min(hardPageCap, Math.ceil((total || 0) / perPage)));
    const last = items.length < perPage || page >= pageCap;
    const status = last ? (total > config.searchResultCap ? 'capped' : 'done') : 'active';
    setSegmentProgress(seg.id, status, page + 1, total);

    if (last) return { kind: status, total, added };
    if (ctl.stopping) return { kind: 'paused', total, added };
    // The operator can skip the city being crawled from the dashboard; the server
    // writes status='skipped', which we see here between pages and bail on.
    if (cityStatus(city.id) === 'skipped') return { kind: 'skipped', total, added };
    page++;
  }
}

export async function run({
  limit = Infinity,
  maxProfiles = 0,
  states = null,
  search = '',
  sort = 'id',
  order = 'asc',
  gh: injectedGh,
} = {}) {
  const gh = injectedGh ?? new GitHub();
  // `rejects` tallies why hits were thrown away by the location check, reset per
  // city so the summary line says what a city's search actually dragged in.
  const ctl = { stopping: false, added: 0, maxProfiles, rejects: new Map() };
  const scope = Array.isArray(states) && states.length ? states : null;
  process.on('SIGINT', () => {
    if (ctl.stopping) process.exit(1);
    ctl.stopping = true;
    console.error('\n[stop] finishing current page, then exiting (progress saved)...');
  });

  let processedCities = 0;
  while (processedCities < limit) {
    const city = nextCity({ states: scope, search, sort, order });
    if (!city) {
      console.error(scope ? '[done] no remaining cities in scope.' : '[done] no remaining cities.');
      break;
    }
    setCityStatus(city.id, 'active');
    ctl.rejects.clear();
    console.error(`[city] crawling ${city.city}, ${city.state}`);

    insertSegment({
      city_id: city.id,
      q: `${city.query} created:<=${CREATED_CEILING}`,
      date_from: null,
      date_to: null,
      granularity: 'all',
    });

    let cityAdded = 0;
    let splits = 0;
    let capped = 0;
    let skipped = false;
    let seg;
    while ((seg = nextSegment(city.id))) {
      if (cityStatus(city.id) === 'skipped') { skipped = true; break; }
      const out = await processSegment(gh, city, seg, ctl);
      if (out.kind === 'skipped') { skipped = true; break; }
      if (out.kind === 'split') splits++;
      else cityAdded += out.added || 0;
      if (out.kind === 'capped') capped++;
      if (ctl.stopping) {
        console.error('[stop] exiting after checkpoint.');
        process.exit(0);
      }
    }

    if (skipped) {
      // Leave the 'skipped' status in place so nextCity() won't hand it back.
      console.error(`[skip] ${city.city}, ${city.state} — skipped by operator (new_profiles=${cityAdded})`);
      continue;
    }

    setCityStatus(city.id, 'done');
    processedCities++;
    const rejected = [...ctl.rejects.values()].reduce((a, b) => a + b, 0);
    const why = [...ctl.rejects].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' ');
    console.error(
      `[city] ${city.city}, ${city.state} — new_profiles=${cityAdded}` +
        (rejected ? ` wrong_location=${rejected} (${why})` : '') +
        (splits ? ` splits=${splits}` : '') +
        (capped ? ` capped_days=${capped}` : '') +
        ` (api_calls=${gh.requests})`
    );
  }

  const c = counts();
  console.error(
    `[summary] cities ${c.cities_done}/${c.cities_total} done · segments ${c.seg_total} ` +
      `(${c.seg_split} split, ${c.seg_capped} capped) · users ${c.users_total}`
  );
}
