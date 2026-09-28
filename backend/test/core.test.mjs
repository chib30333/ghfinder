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
process.env.GITHUB_TOKEN = 'test-token-placeholder';

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
  const created = templates.loadTemplates();
  assert.equal(created.created, true);
  assert.equal(created.templates.length, 1);
  assert.match(readFileSync(templates.templatePath, 'utf8'), /firstName/);

  const saved = templates.saveTemplates([{ subject: 'Hello', message: 'Hi {{firstName}}' }]);
  assert.deepEqual(saved, [{ subject: 'Hello', message: 'Hi {{firstName}}' }]);
  assert.deepEqual(templates.loadTemplates().templates, saved);
});

test('a single-template file still loads as a one-entry rotation', () => {
  writeFileSync(
    templates.templatePath,
    JSON.stringify({ subject: 'Legacy', message: 'Body' }),
  );
  assert.deepEqual(templates.loadTemplates().templates, [{ subject: 'Legacy', message: 'Body' }]);
});

test('a rotation is saved, reloaded, and walked in order', () => {
  const rotation = [1, 2, 3].map((n) => ({ subject: `S${n}`, message: `M${n} {{firstName}}` }));
  assert.deepEqual(templates.saveTemplates({ templates: rotation }), rotation);

  const { templates: loaded } = templates.loadTemplates();
  assert.deepEqual(loaded, rotation);
  // Message n takes template n, wrapping at the end of the rotation.
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((n) => templates.templateAt(loaded, n).subject),
    ['S1', 'S2', 'S3', 'S1', 'S2'],
  );
});

test('a rotation is rejected when empty, oversized, or malformed', () => {
  assert.throws(() => templates.saveTemplates([]), /at least one template/);
  assert.throws(
    () => templates.saveTemplates(
      Array.from({ length: templates.MAX_TEMPLATES + 1 }, () => ({ subject: 's', message: 'm' })),
    ),
    /at most 10 templates/,
  );
  assert.throws(
    () => templates.saveTemplates([{ subject: 'ok', message: 'ok' }, { subject: 'no' }]),
    /template 2 of 2/,
  );
});

test('batches rotate templates across the recipient list', () => {
  const rotation = [
    { subject: 'A', message: 'a {{firstName}}' },
    { subject: 'B', message: 'b {{firstName}}' },
  ];
  const rows = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing'].map((name, i) => ({
    name, email: `u${i}@example.com`,
  }));
  const { recipients, files } = templates.buildBatches(rows, rotation, 2);
  assert.equal(recipients, 3);
  assert.equal(files, 2);
  const batch = (n) => JSON.parse(readFileSync(join(templates.gesDir, `batch_000${n}.json`), 'utf8'));
  const entries = [...batch(1), ...batch(2)];
  assert.deepEqual(entries.map((e) => e.subject), ['A', 'B', 'A']);
  assert.deepEqual(entries.map((e) => e.message), ['a Ada', 'b Grace', 'a Alan']);
});
