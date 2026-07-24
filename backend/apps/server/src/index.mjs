import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '@ghfinder/core';
import { jobs } from './jobs.mjs';

import statsRoutes from './routes/stats.mjs';
import leadsRoutes from './routes/leads.mjs';
import citiesRoutes from './routes/cities.mjs';
import discoveryRoutes from './routes/discovery.mjs';
import campaignsRoutes from './routes/campaigns.mjs';
import accountsRoutes from './routes/accounts.mjs';
import exportsRoutes from './routes/exports.mjs';

const HOST = process.env.GHFINDER_API_HOST || '127.0.0.1';
const PORT = Number(process.env.GHFINDER_API_PORT || 8787);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/api/health', async () => ({ ok: true, root: config.root }));

for (const plugin of [
  statsRoutes,
  leadsRoutes,
  citiesRoutes,
  discoveryRoutes,
  campaignsRoutes,
  accountsRoutes,
  exportsRoutes,
]) {
  await app.register(plugin, { prefix: '/api' });
}

const shutdown = async () => {
  try { jobs.stopAll(); } catch { }
  try { await app.close(); } catch { }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ host: HOST, port: PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
