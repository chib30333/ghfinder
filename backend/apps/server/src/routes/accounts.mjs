import { getGmailAccounts } from '../cdp.mjs';
import { launchBrowser, addAccount, openMailbox, BrowserError } from '../browser.mjs';

const statusFor = (e) =>
  e instanceof BrowserError
    ? { 'cdp-down': 409, 'no-chrome': 404, 'no-port': 502, 'open-failed': 502 }[e.code] ?? 500
    : 500;

export default async function accountsRoutes(fastify) {
  fastify.get('/accounts', async () => getGmailAccounts());

  fastify.post('/accounts/launch', async (req, reply) => {
    try {
      const result = await launchBrowser();
      const state = await getGmailAccounts();
      return { ...result, ...state };
    } catch (e) {
      return reply.code(statusFor(e)).send({ error: e.message });
    }
  });

  fastify.post('/accounts/add', async (req, reply) => {
    try {
      return await addAccount();
    } catch (e) {
      return reply.code(statusFor(e)).send({ error: e.message });
    }
  });

  fastify.post('/accounts/open', async (req, reply) => {
    const index = Number(req.body?.index);
    if (!Number.isInteger(index) || index < 0) {
      return reply.code(400).send({ error: 'A valid account index is required.' });
    }
    try {
      return await openMailbox(index);
    } catch (e) {
      return reply.code(statusFor(e)).send({ error: e.message });
    }
  });
}
