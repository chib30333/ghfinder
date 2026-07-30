// Prune leads that were harvested before the crawler verified locations.
//
// GitHub's `location:` qualifier is a fuzzy token match, so every city crawled
// before crawler/location.mjs existed stored whatever the search returned:
// "Dubai, United Arab Emirates" under Arab AL, "Houston, TX" under Houston AK,
// "Saint-Petersburg, Russia" under Petersburg AK. This replays the same check
// the crawler now applies and removes the rows that fail it.
//
// Dry run by default — prints what it would do and changes nothing.
//
//   node backend/tools/prune-wrong-location.mjs                 # report only
//   node backend/tools/prune-wrong-location.mjs --apply         # delete them
//   node backend/tools/prune-wrong-location.mjs --apply --reset-cities
//
// Rows with an `emailed_at` stamp are ALWAYS kept: that stamp is the only record
// that the lead has already been contacted, and deleting it would let the sender
// mail the same person twice.
//
// --reset-cities additionally puts every affected city back to 'pending' and
// drops its segments so the fixed crawler re-visits it. That re-spends the API
// budget those cities already cost, so it is opt-in.

import { DatabaseSync } from 'node:sqlite';
import { config } from '../packages/core/src/config.mjs';
import { locationMatches } from '../packages/core/src/crawler/location.mjs';

const has = (name) => process.argv.includes(`--${name}`);
const apply = has('apply');
const resetCities = has('reset-cities');

const db = new DatabaseSync(config.dbPath);

const rows = db
  .prepare(
    `SELECT u.id, u.login, u.location, u.emailed_at, c.id AS city_id, c.city, c.state
     FROM users u JOIN cities c ON c.id = u.source_city_id`
  )
  .all();

const doomed = [];
const protectedRows = [];
const perCity = new Map();

for (const r of rows) {
  if (locationMatches(r.location, r.city, r.state, { strict: config.locationStrict }).ok) continue;
  if (r.emailed_at) { protectedRows.push(r); continue; }
  doomed.push(r);
  const key = `${r.city}, ${r.state}`;
  const p = perCity.get(key) ?? { cityId: r.city_id, n: 0 };
  p.n++;
  perCity.set(key, p);
}

const orphaned = rows.length - doomed.length - protectedRows.length;
console.error(`stored leads          ${rows.length}`);
console.error(`location verified     ${orphaned}`);
console.error(`mis-attributed        ${doomed.length + protectedRows.length}`);
console.error(`  → to delete         ${doomed.length}`);
console.error(`  → kept (emailed)    ${protectedRows.length}`);

console.error('\nby source city:');
for (const [name, p] of [...perCity].sort((a, b) => b[1].n - a[1].n).slice(0, 30)) {
  console.error(`  ${String(p.n).padStart(7)}  ${name}`);
}

if (!apply) {
  console.error('\nDry run — nothing changed. Re-run with --apply to delete.');
  db.close();
  process.exit(0);
}

db.exec('BEGIN');
try {
  const del = db.prepare('DELETE FROM users WHERE id = ?');
  for (const r of doomed) del.run(r.id);

  let reset = 0;
  if (resetCities) {
    const clearSegs = db.prepare('DELETE FROM segments WHERE city_id = ?');
    const pend = db.prepare(`UPDATE cities SET status = 'pending', updated_at = NULL WHERE id = ?`);
    for (const { cityId } of perCity.values()) {
      clearSegs.run(cityId);
      reset += pend.run(cityId).changes;
    }
  }
  db.exec('COMMIT');
  console.error(`\nDeleted ${doomed.length} leads.`);
  if (resetCities) console.error(`Reset ${reset} cities to pending (segments cleared) for a re-crawl.`);
} catch (e) {
  db.exec('ROLLBACK');
  console.error(`\nFailed, rolled back: ${e.message}`);
  process.exitCode = 1;
}

db.close();
