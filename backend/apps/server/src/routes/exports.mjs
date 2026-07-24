import { existsSync, readdirSync, statSync, createReadStream } from 'node:fs';
import { join, basename } from 'node:path';
import { config, gesDir } from '@ghfinder/core';

function listDir(dir, re) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => re.test(n))
    .sort()
    .map((name) => {
      const st = statSync(join(dir, name));
      return { name, size: st.size, mtime: st.mtimeMs };
    });
}

export default async function exportsRoutes(fastify) {
  fastify.get('/exports', async () => {
    const batches = listDir(config.exportDir, /^users_\d+\.txt$/);
    const ges = listDir(gesDir, /^batch_\d+\.json$/);
    const link = existsSync(config.linkPath)
      ? [{
          name: basename(config.linkPath),
          size: statSync(config.linkPath).size,
          mtime: statSync(config.linkPath).mtimeMs,
        }]
      : [];
    return { batches, ges, link, dirs: { exportDir: config.exportDir, gesDir, linkPath: config.linkPath } };
  });

  fastify.get('/exports/download', async (req, reply) => {
    const kind = String(req.query.kind || 'batch');
    const name = String(req.query.name || '');

    let filePath;
    if (kind === 'link') {
      filePath = config.linkPath;
    } else {
      if (basename(name) !== name || name === '') return reply.code(400).send({ error: 'bad name' });
      filePath = join(kind === 'ges' ? gesDir : config.exportDir, name);
    }

    if (!existsSync(filePath)) return reply.code(404).send({ error: 'not found' });
    reply.header('Content-Disposition', `attachment; filename="${basename(filePath)}"`);
    return reply.send(createReadStream(filePath));
  });
}
