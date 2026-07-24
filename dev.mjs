#!/usr/bin/env node
// dev.mjs — launch the ghfinder backend API (:8787) and the frontend dev server
// (:5173) together with one command. Zero dependencies.
//
//   • Output from each process is prefixed [api] / [web] so you can tell them apart.
//   • Ctrl+C stops both.
//   • If either process exits on its own, the other is stopped too.
//   • Before launching, a stale listener on the API port is freed automatically so a
//     leftover process from a previous run can't crash startup with EADDRINUSE.
//
// Both children are plain Node processes (the backend entry, and Vite's own bin),
// launched directly — no npm/shell wrapper — so there are no orphaned processes
// to clean up on Windows.
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import net from 'node:net';

const ROOT = dirname(fileURLToPath(import.meta.url));
const node = process.execPath;
const RESET = '\x1b[0m';

// Mirror the backend's defaults (src/index.mjs) so the preflight checks the port
// the API will actually bind to.
const API_HOST = process.env.GHFINDER_API_HOST || '127.0.0.1';
const API_PORT = Number(process.env.GHFINDER_API_PORT || 8787);

const targets = [
  {
    name: 'api',
    color: '\x1b[36m', // cyan
    cmd: node,
    args: ['src/index.mjs'],
    cwd: resolve(ROOT, 'backend/apps/server'),
  },
  {
    name: 'web',
    color: '\x1b[32m', // green
    cmd: node,
    args: [resolve(ROOT, 'frontend/node_modules/vite/bin/vite.js')],
    cwd: resolve(ROOT, 'frontend'),
  },
];

// Fail fast with a clear message if the frontend hasn't been installed yet.
const viteBin = targets[1].args[0];
if (!existsSync(viteBin)) {
  console.error(`\x1b[31mVite not found at ${viteBin}\x1b[0m`);
  console.error("Run `npm install` in the frontend/ directory first.");
  process.exit(1);
}

const children = [];
let shuttingDown = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function note(msg) {
  process.stdout.write(`\x1b[90m[dev]\x1b[0m ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Port preflight
//
// The backend spawns a detached debug Chrome that, on Windows, can inherit the
// API's listening socket. If the backend then dies, :8787 stays LISTENING under
// the (now dead) backend PID, so the next `npm run dev` fails to bind with
// EADDRINUSE and — because api's exit tears down web — the whole thing closes.
// Here we detect and free that stale listener before launching.
// ---------------------------------------------------------------------------

// Resolve `free` | `busy` | `error` by trying to bind the port ourselves.
function checkPort(port, host) {
  return new Promise((res) => {
    const srv = net.createServer();
    srv.once('error', (err) => res(err.code === 'EADDRINUSE' ? 'busy' : 'error'));
    srv.once('listening', () => srv.close(() => res('free')));
    srv.listen(port, host);
  });
}

async function waitFree(port, host, ms) {
  const deadline = Date.now() + ms;
  do {
    if ((await checkPort(port, host)) === 'free') return true;
    await sleep(250);
  } while (Date.now() < deadline);
  return (await checkPort(port, host)) === 'free';
}

function ps(script) {
  return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

const pidsFrom = (out) => [...new Set((out || '').split(/\s+/).map((s) => s.trim()).filter(Boolean))];

// PIDs owning a LISTENING socket on `port` (Windows).
function ownersWin(port) {
  try {
    return pidsFrom(
      ps(
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ` +
          `Select-Object -ExpandProperty OwningProcess -Unique`,
      ),
    );
  } catch {
    return [];
  }
}

function pidAliveWin(pid) {
  try {
    return (
      ps(
        `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id`,
      ).trim().length > 0
    );
  } catch {
    return false;
  }
}

function killTreeWin(pid) {
  try {
    execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Leaked-handle recovery: the socket owner PID is dead but the port is still held
// by the detached ghfinder debug Chrome that inherited it. Kill ONLY that Chrome —
// matched by its dedicated `.ghfinder\chrome-profile` user-data-dir, so this never
// touches a normal Chrome window or the Playwright-MCP Chrome (which shares 9222
// but uses a different profile).
function killGhfinderChromeWin() {
  try {
    const pids = pidsFrom(
      ps(
        `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ` +
          `Where-Object { $_.CommandLine -like '*\\.ghfinder\\chrome-profile*' } | ` +
          `Select-Object -ExpandProperty ProcessId`,
      ),
    );
    let killed = 0;
    for (const pid of pids) if (killTreeWin(pid)) killed++;
    return killed;
  } catch {
    return 0;
  }
}

function freePosix(port) {
  try {
    const pids = pidsFrom(
      execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }),
    );
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
    return pids.length;
  } catch {
    return 0;
  }
}

async function ensurePortFree(port, host, label) {
  if ((await checkPort(port, host)) !== 'busy') return true;
  note(`port ${port} (${label}) is in use — freeing it…`);

  if (process.platform === 'win32') {
    for (const pid of ownersWin(port)) if (pidAliveWin(pid)) killTreeWin(pid);
    if (await waitFree(port, host, 4000)) {
      note(`freed port ${port}.`);
      return true;
    }
    // Still busy ⇒ leaked socket held by the detached ghfinder Chrome.
    const n = killGhfinderChromeWin();
    if (n) note(`stopped ${n} leftover ghfinder Chrome process(es) holding the socket.`);
    if (await waitFree(port, host, 6000)) {
      note(`freed port ${port}.`);
      return true;
    }
  } else {
    if (freePosix(port) && (await waitFree(port, host, 4000))) {
      note(`freed port ${port}.`);
      return true;
    }
  }

  return (await checkPort(port, host)) !== 'busy';
}

function prefixer(name, color) {
  let buf = '';
  const tag = `${color}[${name}]${RESET} `;
  return (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) process.stdout.write(tag + line + '\n');
  };
}

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.exitCode === null && c.signalCode === null) {
      try { c.kill(signal); } catch { /* already gone */ }
    }
  }
}

process.stdout.write('\x1b[1mghfinder dev\x1b[0m — API http://127.0.0.1:8787  ·  Web http://127.0.0.1:5173\n');
process.stdout.write('Press Ctrl+C to stop both.\n\n');

// Free a stale API listener before launching so a leftover process can't crash
// startup (and take the whole dev session down with it).
if (!(await ensurePortFree(API_PORT, API_HOST, 'api'))) {
  console.error(
    `\x1b[31mCould not free ${API_HOST}:${API_PORT}. Something is still holding it.\x1b[0m`,
  );
  console.error(
    `Inspect it with:  Get-NetTCPConnection -LocalPort ${API_PORT} | Select-Object OwningProcess`,
  );
  process.exit(1);
}

for (const t of targets) {
  const child = spawn(t.cmd, t.args, { cwd: t.cwd, env: process.env });
  children.push(child);
  child.stdout.on('data', prefixer(t.name, t.color));
  child.stderr.on('data', prefixer(t.name, t.color));
  child.on('exit', (code, signal) => {
    process.stdout.write(`${t.color}[${t.name}]${RESET} exited (${signal || `code ${code}`})\n`);
    if (!shuttingDown) {
      process.exitCode = code ?? 1;
      stopAll();
    }
  });
  child.on('error', (err) => {
    process.stdout.write(`${t.color}[${t.name}]${RESET} failed to start: ${err.message}\n`);
    stopAll();
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => stopAll());
}
