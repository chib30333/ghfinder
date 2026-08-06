import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

const root = mkdtempSync(join(tmpdir(), 'ghfinder-test-'));
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(
  join(root, 'data', 'us_cities.csv'),
  'city,state\nAustin,TX\n"Washington, D.C.",DC\nAustin,TX\nInvalid,XX\n',
);

process.env.GHFINDER_ROOT = root;
process.env.GITHUB_TOKEN = 'test-token';

const countries = await import('../packages/core/src/data/countries.mjs');
const templates = await import('../packages/core/src/outreach/template.mjs');
const { GitHub } = await import('../packages/core/src/github/client.mjs');

test.after(() => rmSync(root, { recursive: true, force: true }));

test('country catalog resolves codes and names without case sensitivity', () => {
  assert.equal(countries.getCountry('us').name, 'United States');
  assert.equal(countries.getCountry('GERMANY').code, 'DE');
  assert.equal(countries.getCountry('unknown'), null);
});

test('GitHub client reports a missing token without terminating the process', async () => {
  const github = new GitHub({ token: '', log: () => {} });
  assert.deepEqual(await github.getRateLimit(), { ok: false, reason: 'missing_token' });
  await assert.rejects(() => github.getJson('/user'), /GITHUB_TOKEN is not set/);
});

test('US CSV parser handles quoted fields, invalid states, and duplicates', () => {
  assert.deepEqual(countries.readUsCities(), [
    { city: 'Austin', state: 'TX' },
    { city: 'Washington, D.C.', state: 'DC' },
  ]);
  assert.equal(countries.usCityCount(), 2);
});

test('country state filters match database storage buckets', () => {
  assert.ok(countries.countryStates('US').includes('CA'));
  assert.deepEqual(countries.countryStates('Germany'), ['Germany']);
  assert.equal(countries.countryStates('unknown'), null);
});

test('template creation and saving work in a fresh data directory', () => {
  rmSync(join(root, 'data'), { recursive: true, force: true });
  const created = templates.loadTemplate();
  assert.equal(created._created, true);
  assert.match(readFileSync(templates.templatePath, 'utf8'), /firstName/);

  const saved = templates.saveTemplate({ subject: 'Hello', message: 'Hi {{firstName}}' });
  assert.deepEqual(saved, { subject: 'Hello', message: 'Hi {{firstName}}' });
});
