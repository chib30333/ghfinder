import { config } from '@ghfinder/core';

function maskToken(token) {
  if (!token) return 'Not configured';
  const prefix = token.includes('_') ? `${token.split('_', 1)[0]}_` : '';
  const suffix = token.slice(-4);
  return `${prefix}${'•'.repeat(16)}${suffix}`;
}

export default async function settingsRoutes(fastify) {
  fastify.get('/settings', async () => ({
    github: {
      configured: Boolean(config.token),
      tokenMask: maskToken(config.token),
    },
    storage: {
      dbPath: config.dbPath,
      exportDir: config.exportDir,
      usersPerFile: config.usersPerFile,
    },
    enrichment: {
      readmeEmail: config.readmeEmail,
      commitEmail: config.emailRepoScan > 0,
      emailRepoScan: config.emailRepoScan,
      telegram: config.socialLinks,
      discord: config.socialLinks,
    },
  }));
}
