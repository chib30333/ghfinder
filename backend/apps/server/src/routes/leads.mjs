import { listUsers, getUserByLogin, setLeadStatus } from '@ghfinder/core';

const bool = (v) => v === '1' || v === 'true' || v === true;

// Outreach state an operator may set per lead. 'done' stamps emailed_at (the lead
// drops out of the send queue); 'active' clears it (the lead is mailable again).
const LEAD_STATUSES = new Set(['active', 'done']);

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

  // Flip a lead between active and done from the Leads table. Backs the per-row
  // Active / Done buttons; applied by email so duplicate logins move together.
  fastify.post('/leads/:login/status', async (req, reply) => {
    const status = req.body?.status;
    if (!LEAD_STATUSES.has(status)) return reply.code(400).send({ error: 'invalid status' });
    const result = setLeadStatus(req.params.login, status);
    if (!result) return reply.code(404).send({ error: 'lead not found' });
    return { updated: true, ...result };
  });
}
