import { listCities, loadCities, loadCountryCities, loadAllCountryCities, listCountries, cityCountsByState, countryStates, skipCity } from '@ghfinder/core';

export default async function citiesRoutes(fastify) {
  fastify.get('/cities', async (req) => {
    const q = req.query;
    const country = q.state || q.country;
    // CSV-backed countries (the US) span many state values, so filter by the
    // full set of their state codes rather than a single exact match.
    const states = country ? countryStates(country) : null;
    return listCities({
      status: q.status,
      search: q.search,
      ...(states && states.length ? { states } : { state: country }),
      limit: q.limit,
      offset: q.offset,
    });
  });

  fastify.post('/cities/:id/skip', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: 'invalid city id' });
    if (!skipCity(id)) return reply.code(404).send({ error: 'city not found' });
    return { skipped: true, id };
  });

  fastify.get('/countries', async () => listCountries(cityCountsByState()));

  fastify.post('/cities/load', async (req, reply) => {
    const mode = req.body?.queryMode === 'city-state' ? 'city-state' : 'city';
    try {
      const inserted = loadCities(mode);
      return { inserted, queryMode: mode };
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.post('/cities/load-country', async (req, reply) => {
    const mode = req.body?.queryMode === 'city-state' ? 'city-state' : 'city';
    const code = req.body?.code;
    if (!code) return reply.code(400).send({ error: 'country code is required' });
    try {
      const result = loadCountryCities(code, mode);
      return { ...result, queryMode: mode };
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  // Seed EVERY city of a country (full remote gazetteer), not just the curated
  // hubs that /cities/load-country loads. Used by the "Search all cities" button.
  fastify.post('/cities/load-country-all', async (req, reply) => {
    const mode = req.body?.queryMode === 'city-state' ? 'city-state' : 'city';
    const code = req.body?.code;
    if (!code) return reply.code(400).send({ error: 'country code is required' });
    try {
      const result = await loadAllCountryCities(code, mode);
      return { ...result, queryMode: mode };
    } catch (e) {
      return reply.code(502).send({ error: e.message });
    }
  });
}
