import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

const BACKEND_PORT = 8787;

const children = [];

function run(name, cwd, args) {
  const child = spawn(npm, args, {
    cwd: join(root, cwd),
    stdio: 'inherit',
    shell: isWin,
  });
  child.on('exit', (code) => {
    console.log(`\n[${name}] exited (code ${code ?? 0}) — shutting the other process down.`);
    shutdown();
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const c of children) {
    try { c.kill(); } catch { }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Resolve once the backend is accepting TCP connections, so Vite never proxies
// to a dead :8787 (which returns HTTP 500 — fatal for the discovery SSE stream,
// which then won't auto-reconnect — and errors the dashboard's initial fetches).
function waitForPort(port, { host = '127.0.0.1', timeoutMs = 60000, intervalMs = 250 } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = connect({ port, host });
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error(`timed out waiting for backend on :${port}`));
        else setTimeout(attempt, intervalMs);
      });
    };
    attempt();
  });
}

console.log('Starting ghfinder — backend API (:8787) + frontend (:5173)…');
run('backend', 'backend', ['run', 'server']);

console.log(`Waiting for backend on :${BACKEND_PORT}…`);
try {
  await waitForPort(BACKEND_PORT);
  console.log('Backend is up — starting frontend.');
} catch (e) {
  console.warn(`[dev] ${e.message}; starting frontend anyway.`);
}
run('frontend', 'frontend', ['run', 'dev']);
