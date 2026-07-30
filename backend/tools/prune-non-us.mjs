// Delete leads that are not in the United States.
//
// Separate from prune-wrong-location.mjs: that one asks "is this lead in the
// city we filed it under" (and so rejects Houston TX filed under Houston AK).
// This one asks only "is this lead in the US at all", which is the right
// question for a US-only outreach list.
//
// Dry run by default — prints what it would do and changes nothing.
//
//   node backend/tools/prune-non-us.mjs                      # report only
//   node backend/tools/prune-non-us.mjs --apply              # delete confirmed non-US
//   node backend/tools/prune-non-us.mjs --apply --include-unknown
//   node backend/tools/prune-non-us.mjs --apply --keep-emailed
//
// Every location falls in one of three buckets (see isUnitedStates):
//   us=true   a US state name/code backed by a real gazetteer city, or "USA"
//   us=false  a foreign country or hub is named outright
//   us=null   undecidable — a bare "Houston", "Anchorage", "Saint-Petersburg"
//
// --include-unknown also deletes the undecidable bucket. That is the aggressive
// choice: it clears the remaining foreign residue but also discards genuine US
// leads who simply never wrote their state.
//
// --keep-emailed preserves rows carrying an `emailed_at` stamp. Not the default:
// those leads are non-US too, and the fixed crawler will never re-harvest them,
// so they cannot be mailed a second time once deleted.

import { DatabaseSync } from 'node:sqlite';
import { config } from '../packages/core/src/config.mjs';
import { isUnitedStates } from '../packages/core/src/crawler/location.mjs';

const has = (name) => process.argv.includes(`--${name}`);
const apply = has('apply');
const includeUnknown = has('include-unknown');
const keepEmailed = has('keep-emailed');

const db = new DatabaseSync(config.dbPath);
const rows = db.prepare(`SELECT id, login, location, email, emailed_at FROM users`).all();

const keep = [];
const doomed = [];
const spared = [];
const byReason = new Map();
const unknownSamples = new Map();

for (const r of rows) {
  const v = isUnitedStates(r.location);
  const remove = v.us === false || (includeUnknown && v.us === null);
  if (!remove) {
    keep.push(r);
    if (v.us === null) unknownSamples.set(r.location, (unknownSamples.get(r.location) || 0) + 1);
    continue;
  }
  if (keepEmailed && r.emailed_at) { spared.push(r); continue; }
  doomed.push(r);
  const tag = v.reason.split(':')[0] === 'foreign' ? v.reason.slice(8) : v.reason;
  byReason.set(tag, (byReason.get(tag) || 0) + 1);
}

const emailed = (a) => a.filter((r) => r.emailed_at).length;
const withEmail = (a) => a.filter((r) => r.email).length;

console.error(`stored leads        ${rows.length}`);
console.error(`  keeping           ${keep.length}   with-email=${withEmail(keep)}`);
console.error(`  deleting          ${doomed.length}   with-email=${withEmail(doomed)}  already-emailed=${emailed(doomed)}`);
if (keepEmailed) console.error(`  spared (emailed)  ${spared.length}`);
console.error(`\nmode: ${includeUnknown ? 'confirmed non-US + undecidable' : 'confirmed non-US only'}`);

console.error('\nwhy they are being deleted:');
for (const [k, n] of [...byReason].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.error(`  ${String(n).padStart(7)}  ${k}`);
}

if (!includeUnknown && unknownSamples.size) {
  const total = [...unknownSamples.values()].reduce((a, b) => a + b, 0);
  console.error(`\nkept but undecidable (${total} rows) — re-run with --include-unknown to drop these too:`);
  for (const [k, n] of [...unknownSamples].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.error(`  ${String(n).padStart(7)}  ${JSON.stringify(k)}`);
  }
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
  db.exec('COMMIT');
  console.error(`\nDeleted ${doomed.length} non-US leads. ${keep.length + spared.length} remain.`);
  console.error('Exported text files are now stale — regenerate them if you use them.');
} catch (e) {
  db.exec('ROLLBACK');
  console.error(`\nFailed, rolled back: ${e.message}`);
  process.exitCode = 1;
}

db.close();
