import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { config } from '../config.mjs';

let dirReady = false;
function ensureDir() {
  if (dirReady) return;
  if (!existsSync(config.exportDir)) mkdirSync(config.exportDir, { recursive: true });
  dirReady = true;
}

let linkDirReady = false;
function ensureLinkDir() {
  if (linkDirReady) return;
  const d = dirname(config.linkPath);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  linkDirReady = true;
}

const BATCH_RE = /^users_(\d+)\.txt$/;
export function batchFileName(index) {
  return `users_${String(index).padStart(4, '0')}.txt`;
}

const clean = (v) => (v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' ').trim());

const record = (name, email) => JSON.stringify({ fullname: clean(name), email: clean(email) }) + '\n';

const hasEmail = (email) => clean(email).length > 0;

function countRecords(path) {
  if (!existsSync(path)) return 0;
  const text = readFileSync(path, 'utf8');
  let n = 0;
  for (const line of text.split('\n')) if (line.trim().length > 0) n++;
  return n;
}

function listBatchFiles() {
  if (!existsSync(config.exportDir)) return [];
  const out = [];
  for (const name of readdirSync(config.exportDir)) {
    const m = BATCH_RE.exec(name);
    if (m) out.push({ index: Number(m[1]), name });
  }
  return out;
}

function removeBatchFiles() {
  for (const { name } of listBatchFiles()) rmSync(join(config.exportDir, name));
}

let cursor = null;
function initCursor() {
  if (cursor) return cursor;
  ensureDir();
  const files = listBatchFiles();
  if (files.length === 0) return (cursor = { index: 1, count: 0 });
  const last = files.reduce((a, b) => (b.index > a.index ? b : a));
  const count = countRecords(join(config.exportDir, last.name));
  cursor = count >= config.usersPerFile ? { index: last.index + 1, count: 0 } : { index: last.index, count };
  return cursor;
}

export function appendUser(u) {
  if (!hasEmail(u.email)) return;
  const st = initCursor();
  if (st.count >= config.usersPerFile) { st.index++; st.count = 0; }
  appendFileSync(join(config.exportDir, batchFileName(st.index)), record(u.name, u.email));
  st.count++;
}

function writeBatches(records) {
  ensureDir();
  removeBatchFiles();
  const per = config.usersPerFile;
  let files = 0;
  for (let i = 0; i < records.length; i += per) {
    const chunk = records.slice(i, i + per);
    writeFileSync(join(config.exportDir, batchFileName(files + 1)), chunk.join(''));
    files++;
  }
  cursor = null;
  return files;
}

export function regenerateAllUserFiles(rows) {
  const records = [];
  for (const r of rows) if (hasEmail(r.email)) records.push(record(r.name, r.email));
  return writeBatches(records);
}

export function migrateCityFilesToBatches() {
  ensureDir();
  const legacy = [];
  if (existsSync(config.exportDir)) {
    for (const name of readdirSync(config.exportDir)) {
      if (name.endsWith('.txt') && !BATCH_RE.test(name)) legacy.push(name);
    }
  }
  const records = [];
  for (const name of legacy) {
    const text = readFileSync(join(config.exportDir, name), 'utf8');
    for (const line of text.split('\n')) {
      const s = line.trim();
      if (!s) continue;
      try {
        const o = JSON.parse(s);
        if (o && typeof o.email === 'string' && o.email.trim().length > 0) records.push(s + '\n');
      } catch { }
    }
  }
  for (const name of legacy) rmSync(join(config.exportDir, name));
  const files = writeBatches(records);
  return { records: records.length, files, legacy: legacy.length };
}

const linkRecord = (name, links) =>
  JSON.stringify({
    fullname: clean(name),
    telegram: clean(links.telegram),
    discord: clean(links.discord),
  }) + '\n';

export function appendUserLinks(name, links) {
  ensureLinkDir();
  appendFileSync(config.linkPath, linkRecord(name, links));
}

export function regenerateLinkFile(rows) {
  ensureLinkDir();
  let n = 0;
  const lines = [];
  for (const r of rows) {
    if (!r.telegram && !r.discord) continue;
    lines.push(linkRecord(r.name, r));
    n++;
  }
  writeFileSync(config.linkPath, lines.join(''));
  return n;
}
