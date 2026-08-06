import { join } from 'node:path';
import { config } from '@ghfinder/core';
import { jobs } from '../jobs.mjs';
import { streamJob } from '../sse.mjs';

const CLI = join(config.root, 'apps', 'cli', 'src', 'cli.mjs');

export default async function discoveryRoutes(fastify) {
  fastify.get('/discovery/status', async () => jobs.job('discovery').state());

  fastify.post('/discovery/start', async (req, reply) => {
    if (!config.token) {
      return reply.code(400).send({
        error: 'GITHUB_TOKEN is not set. Add it to backend/.env before starting Discovery.',
      });
    }
    const { limit, maxProfiles, country } = req.body ?? {};
    const argv = [CLI, 'run'];
    if (limit != null) argv.push('--limit', String(limit));
    if (maxProfiles != null) argv.push('--max-profiles', String(maxProfiles));
    // Scope the crawl to the country the operator is viewing in Discovery, so
    // "Start crawler" works the displayed work list rather than the global one.
    if (country) argv.push('--country', String(country));
    try {
      return jobs.job('discovery').start(argv);
    } catch (e) {
      return reply.code(409).send({ error: e.message });
    }
  });

  fastify.post('/discovery/stop', async () => ({ stopping: jobs.job('discovery').stop() }));

  fastify.get('/discovery/stream', (req, reply) => {
    streamJob(jobs.job('discovery'), req, reply);
  });
}
