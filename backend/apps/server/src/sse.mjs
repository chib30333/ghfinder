
export function startSSE(reply) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });
  reply.raw.write('retry: 3000\n\n');

  let closed = false;
  const send = (event, data) => {
    if (closed) return;
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const heartbeat = setInterval(() => {
    if (!closed) reply.raw.write(': ping\n\n');
  }, 15000);
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    try { reply.raw.end(); } catch { }
  };
  return { send, close };
}

export function streamJob(job, req, reply) {
  const sse = startSSE(reply);
  reply.hijack();

  sse.send('status', job.state());
  for (const entry of job.lines) sse.send('line', entry);

  const onLine = (e) => sse.send('line', e);
  const onEnd = (e) => sse.send('end', e);
  job.on('line', onLine);
  job.on('end', onEnd);

  req.raw.on('close', () => {
    job.off('line', onLine);
    job.off('end', onEnd);
    sse.close();
  });
}
