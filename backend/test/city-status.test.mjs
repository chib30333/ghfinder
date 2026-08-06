import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

const root = mkdtempSync(join(tmpdir(), 'ghfinder-city-status-'));
mkdirSync(join(root, 'data'), { recursive: true });
process.env.GHFINDER_ROOT = root;
process.env.GITHUB_TOKEN = 'test-token';

const { db, loadCitiesTx, listCities, setCityStatus } = await import('../packages/core/src/index.mjs');

test.after(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

test('activating a city returns the previous active city to pending', () => {
  loadCitiesTx([
    { city: 'First', state: 'Test', query: 'location:"First" type:user' },
    { city: 'Second', state: 'Test', query: 'location:"Second" type:user' },
  ]);
  const [first, second] = listCities({ state: 'Test' }).rows;

  assert.equal(setCityStatus(first.id, 'active').changes, 1);
  assert.equal(setCityStatus(second.id, 'active').changes, 1);

  const rows = listCities({ state: 'Test' }).rows;
  assert.equal(rows.filter((city) => city.status === 'active').length, 1);
  assert.equal(rows.find((city) => city.id === first.id).status, 'pending');
  assert.equal(rows.find((city) => city.id === second.id).status, 'active');
});

test('city lists sort globally by every data column', () => {
  const rows = listCities({ state: 'Test' }).rows;
  const first = rows.find((city) => city.city === 'First');
  const second = rows.find((city) => city.city === 'Second');
  loadCitiesTx([{ city: 'Alpha City', state: 'Alpha', query: 'location:"Alpha City" type:user' }]);
  db.prepare(`INSERT INTO users (id, login, source_city_id) VALUES (?, ?, ?)`).run(1, 'one', first.id);
  db.prepare(`INSERT INTO users (id, login, source_city_id) VALUES (?, ?, ?)`).run(2, 'two', first.id);
  db.prepare(`INSERT INTO users (id, login, source_city_id) VALUES (?, ?, ?)`).run(3, 'three', second.id);
  db.prepare(`UPDATE cities SET updated_at=? WHERE id=?`).run('2026-01-01T00:00:00.000Z', first.id);
  db.prepare(`UPDATE cities SET updated_at=? WHERE id=?`).run('2026-02-01T00:00:00.000Z', second.id);

  assert.equal(listCities({ state: 'Test', sort: 'city', order: 'desc' }).rows[0].city, 'Second');
  assert.equal(listCities({ sort: 'state', order: 'asc' }).rows[0].state, 'Alpha');
  assert.equal(listCities({ state: 'Test', sort: 'status', order: 'asc' }).rows[0].status, 'active');
  assert.equal(listCities({ state: 'Test', sort: 'found', order: 'desc' }).rows[0].city, 'First');
  assert.equal(listCities({ state: 'Test', sort: 'updated', order: 'desc' }).rows[0].city, 'Second');
});

test('the database rejects multiple active cities from direct writers', () => {
  const rows = listCities({ state: 'Test' }).rows;
  const pending = rows.find((city) => city.status === 'pending');
  assert.throws(
    () => db.prepare(`UPDATE cities SET status='active' WHERE id=?`).run(pending.id),
    /UNIQUE constraint failed/,
  );
});

test('an unknown city id does not clear the current active city', () => {
  assert.equal(setCityStatus(999999, 'active').changes, 0);
  assert.equal(listCities({ state: 'Test' }).rows.filter((city) => city.status === 'active').length, 1);
});
