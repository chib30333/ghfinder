import { dashboardStats } from '@ghfinder/core';

export default async function statsRoutes(fastify) {
  fastify.get('/stats', async () => dashboardStats());
}
