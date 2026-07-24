import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const pkg = resolve(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).workspaces) return dir;
      } catch { }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const ROOT = process.env.GHFINDER_ROOT
  ? resolve(process.env.GHFINDER_ROOT)
  : findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const _emit = process.emitWarning.bind(process);
process.emitWarning = (warning, ...rest) => {
  const type = typeof rest[0] === 'object' && rest[0] ? rest[0].type : rest[0];
  if (type === 'ExperimentalWarning' && /SQLite/i.test(String(warning))) return;
  return _emit(warning, ...rest);
};

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(resolve(ROOT, '.env'));

const token = (process.env.GITHUB_TOKEN || '').trim();
if (!token) {
  console.error('FATAL: GITHUB_TOKEN is not set (checked .env and environment).');
  process.exit(1);
}

const dbPath = resolve(ROOT, process.env.GHFINDER_DB || 'data/ghfinder.sqlite');
const exportDir = resolve(ROOT, process.env.GHFINDER_TEXTDIR || resolve(dirname(dbPath), 'cities'));
const linkPath = resolve(ROOT, process.env.GHFINDER_LINKS || resolve(dirname(dbPath), 'link.csv'));

export const config = {
  root: ROOT,
  token,
  dbPath,
  exportDir,
  linkPath,
  cachePath: resolve(ROOT, process.env.GHFINDER_CACHE || '.cache/http'),
  clonesPath: resolve(ROOT, process.env.GHFINDER_CLONES || 'clones'),
  citiesCsv: resolve(ROOT, process.env.GHFINDER_CITIES || 'data/us_cities.csv'),
  apiBase: 'https://api.github.com',
  userAgent: 'ghfinder/0.1 (+https://github.com)',
  apiVersion: '2022-11-28',
  searchResultCap: 1000,
  perPage: 100,
  emailRepoScan: Number(process.env.GHFINDER_EMAIL_REPOS ?? 5),
  readmeEmail: (process.env.GHFINDER_README_EMAIL ?? '1') !== '0',
  socialLinks: (process.env.GHFINDER_SOCIAL_LINKS ?? '1') !== '0',
  usersPerFile: Math.max(1, Number(process.env.GHFINDER_USERS_PER_FILE ?? 2000) || 2000),
};
