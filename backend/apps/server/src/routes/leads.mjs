import { listUsers, getUserByLogin } from '@ghfinder/core';

const bool = (v) => v === '1' || v === 'true' || v === true;

export default async function leadsRoutes(fastify) {
  fastify.get('/leads', async (req) => {
    const q = req.query;
    return listUsers({
      search: q.search,
      hasEmail: bool(q.hasEmail),
      hasSocial: bool(q.hasSocial),
      hireable: bool(q.hireable),
      emailSource: q.emailSource,
      city: q.city,
      sort: q.sort,
      order: q.order,
      limit: q.limit,
      offset: q.offset,
    });
  });

  fastify.get('/leads/:login', async (req, reply) => {
    const row = getUserByLogin(req.params.login);
    if (!row) return reply.code(404).send({ error: 'not found' });
    if (row.raw) {
      try { row.raw = JSON.parse(row.raw); } catch { }
    }
    return row;
  });
}
