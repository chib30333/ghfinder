import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import Fastify from 'fastify';

const root = mkdtempSync(join(tmpdir(), 'ghfinder-settings-'));
mkdirSync(join(root, 'data'), { recursive: true });
process.env.GHFINDER_ROOT = root;
process.env.GITHUB_TOKEN = 'test-secret-value-1234';
process.env.GHFINDER_USERS_PER_FILE = '321';

const { default: settingsRoutes } = await import('../apps/server/src/routes/settings.mjs');
const { db } = await import('../packages/core/src/index.mjs');
const app = Fastify();
await app.register(settingsRoutes, { prefix: '/api' });

test.after(async () => {
  await app.close();
  db.close();
  rmSync(root, { recursive: true, force: true });
});

test('runtime settings match backend config without exposing the token', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/settings' });
  assert.equal(response.statusCode, 200);
  const body = response.json();

  assert.equal(body.github.configured, true);
  assert.match(body.github.tokenMask, /1234$/);
  assert.equal(JSON.stringify(body).includes(process.env.GITHUB_TOKEN), false);
  assert.equal(body.storage.dbPath, join(root, 'data', 'ghfinder.sqlite'));
  assert.equal(body.storage.exportDir, join(root, 'data', 'cities'));
  assert.equal(body.storage.usersPerFile, 321);
  assert.deepEqual(body.enrichment, {
    readmeEmail: true,
    commitEmail: true,
    emailRepoScan: 5,
    telegram: true,
    discord: true,
  });
});
