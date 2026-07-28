import { GitHub } from '@ghfinder/core';

// One client for the process — it carries no per-request state beyond a counter.
const gh = new GitHub({ log: () => { } });

// GitHub omits `used` on some resources; derive it rather than showing a hole.
function shapeWindow(r) {
  if (!r) return null;
  const limit = Number(r.limit) || 0;
  const remaining = Number(r.remaining) || 0;
  return {
    limit,
    remaining,
    used: Number.isFinite(Number(r.used)) ? Number(r.used) : Math.max(0, limit - remaining),
    reset: Number(r.reset) || 0,
  };
}

export default async function rateLimitRoutes(fastify) {
  fastify.get('/rate-limit', async (req) => {
    let snap;
    try {
      snap = await gh.getRateLimit();
    } catch (err) {
      // A dead network is a UI state, not a 500 — the meter shows "offline" and
      // keeps the last good numbers rather than blanking the whole top bar.
      req.log.warn({ err: err?.message }, 'rate-limit probe failed');
      snap = { ok: false, reason: 'unreachable' };
    }

    const base = { checkedAt: Date.now(), core: null, search: null, graphql: null };
    if (!snap.ok) return { ...base, ok: false, reason: snap.reason };

    return {
      ...base,
      ok: true,
      core: shapeWindow(snap.resources.core),
      search: shapeWindow(snap.resources.search),
      graphql: shapeWindow(snap.resources.graphql),
    };
  });
}
