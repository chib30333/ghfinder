import { join } from 'node:path';
import { config, loadTemplate, saveTemplate, buildBatches, usersWithEmail } from '@ghfinder/core';
import { jobs } from '../jobs.mjs';
import { streamJob } from '../sse.mjs';

const SENDER = join(config.root, 'apps', 'sender', 'src', 'index.mjs');

export default async function campaignsRoutes(fastify) {
  fastify.get('/campaigns/template', async () => loadTemplate());

  fastify.put('/campaigns/template', async (req, reply) => {
    try {
      return saveTemplate(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.get('/campaigns/recipients', async () => ({ unique: usersWithEmail().length }));

  fastify.post('/campaigns/batches', async (req, reply) => {
    const size = Math.max(1, Number(req.body?.size ?? 20) || 20);
    try {
      const tpl = loadTemplate();
      return buildBatches(usersWithEmail(), tpl, size);
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.get('/campaigns/send/status', async () => jobs.job('campaign').state());

  fastify.post('/campaigns/send/start', async (req, reply) => {
    const { dryRun = true, all = true, count, index, perAccount, accounts, sentOffsets } = req.body ?? {};
    const argv = [SENDER];
    if (!dryRun) argv.push('--send');
    if (all) argv.push('--all');
    if (count != null) argv.push('--count', String(count));
    if (index != null) argv.push('--index', String(index));
    if (perAccount != null) argv.push('--per-account', String(perAccount));
    if (accounts != null) {
      argv.push('--accounts', Array.isArray(accounts) ? accounts.join(',') : String(accounts));
    }
    // Per-account "already sent today" counts (slot=count), so the sender subtracts
    // them from the cap and only tops each account up to its remaining headroom.
    if (sentOffsets != null && typeof sentOffsets === 'object') {
      const pairs = Object.entries(sentOffsets)
        .map(([slot, n]) => [parseInt(slot, 10), Number(n)])
        .filter(([slot, n]) => Number.isInteger(slot) && Number.isFinite(n) && n > 0)
        .map(([slot, n]) => `${slot}=${n}`);
      if (pairs.length) argv.push('--sent-offsets', pairs.join(','));
    }
    try {
      return jobs.job('campaign').start(argv);
    } catch (e) {
      return reply.code(409).send({ error: e.message });
    }
  });

  fastify.post('/campaigns/send/stop', async () => ({ stopping: jobs.job('campaign').stop() }));

  fastify.get('/campaigns/send/stream', (req, reply) => {
    streamJob(jobs.job('campaign'), req, reply);
  });
}
