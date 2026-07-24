import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { config } from '../config.mjs';
import { db } from '../db/index.mjs';

const BATCH_RE = /^users_\d+\.txt$/;

const clean = (v) => (v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' ').trim());
const emailKey = (email) => clean(email).toLowerCase();
const sha = (text) => createHash('sha1').update(text).digest('hex');

function importedId(email) {
  return -Number.parseInt(sha(email).slice(0, 12), 16);
}

function importedLogin(email) {
  return `imported-email-${sha(email).slice(0, 16)}`;
}

function listFiles() {
  if (!existsSync(config.exportDir)) return [];
  return readdirSync(config.exportDir)
    .filter((name) => BATCH_RE.test(name))
    .sort()
    .map((name) => join(config.exportDir, name));
}

function readRows(files) {
  const rows = [];
  const seen = new Set();
  let malformed = 0;
  let blank = 0;

  for (const file of files) {
    const rel = relative(config.root, file);
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const s = line.trim();
      if (!s) {
        blank++;
        continue;
      }
      let obj;
      try {
        obj = JSON.parse(s);
      } catch {
        malformed++;
        continue;
      }
      const email = clean(obj.email);
      const key = emailKey(email);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ name: clean(obj.fullname), email, key, source: rel });
    }
  }

  return { rows, malformed, blank };
}

const stmts = {
  findByEmail: db.prepare(`
    SELECT id, name FROM users
    WHERE LOWER(TRIM(email)) = ?
    LIMIT 1
  `),
  updateName: db.prepare(`
    UPDATE users SET name = ?
    WHERE id = ? AND (name IS NULL OR TRIM(name) = '')
  `),
  insertImported: db.prepare(`
    INSERT OR IGNORE INTO users (
      id, login, name, email, type, fetched_at, email_source, raw
    ) VALUES (
      @id, @login, @name, @email, 'Imported', @fetched_at, 'txt',
      @raw
    )
  `),
};

export function importTextUsersToDb() {
  const files = listFiles();
  const { rows, malformed, blank } = readRows(files);
  const now = new Date().toISOString();
  const summary = {
    files: files.length,
    rows: rows.length,
    matched: 0,
    inserted: 0,
    skipped: 0,
    malformed,
    blank,
  };

  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const existing = stmts.findByEmail.get(row.key);
      if (existing) {
        summary.matched++;
        if (row.name) stmts.updateName.run(row.name, existing.id);
        continue;
      }

      const result = stmts.insertImported.run({
        id: importedId(row.key),
        login: importedLogin(row.key),
        name: row.name || null,
        email: row.email,
        fetched_at: now,
        raw: JSON.stringify({
          imported_from: row.source,
          fullname: row.name,
          email: row.email,
        }),
      });
      if (result.changes) summary.inserted++;
      else summary.skipped++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return summary;
}
