import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CDP = process.env.GHFINDER_CDP || 'http://127.0.0.1:9222';
const PORT = Number(new URL(CDP).port || '9222');

const PROFILE_DIR =
  process.env.GHFINDER_CHROME_PROFILE || path.join(os.homedir(), '.ghfinder', 'chrome-profile');

const CHROME_CANDIDATES = [
  process.env.GHFINDER_CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

const GMAIL = 'https://mail.google.com/';
const ADD_SESSION =
  'https://accounts.google.com/AddSession?service=mail&continue=https://mail.google.com/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BrowserError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BrowserError';
    this.code = code;
  }
}

const uIndexOf = (url) => {
  const m = (url || '').match(/\/mail\/u\/(\d+)\//);
  return m ? Number(m[1]) : null;
};

function findChrome() {
  return CHROME_CANDIDATES.find((p) => existsSync(p));
}

async function cdpReady() {
  try {
    const r = await fetch(`${CDP}/json/version`, { signal: AbortSignal.timeout(1200) });
    return r.ok;
  } catch {
    return false;
  }
}

async function listTargets() {
  let res;
  try {
    res = await fetch(`${CDP}/json`, { signal: AbortSignal.timeout(1500) });
  } catch {
    throw new BrowserError('Chrome debug port not reachable. Launch Chrome first.', 'cdp-down');
  }
  if (!res.ok) throw new BrowserError('Chrome debug port not reachable. Launch Chrome first.', 'cdp-down');
  return res.json();
}

async function openUrl(url) {
  const endpoint = `${CDP}/json/new?${encodeURIComponent(url)}`;
  let res = await fetch(endpoint, { method: 'PUT', signal: AbortSignal.timeout(3000) }).catch(() => null);
  if (!res || !res.ok) {
    res = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(3000) }).catch(() => null);
  }
  if (!res || !res.ok) throw new BrowserError('Could not open a new tab in Chrome.', 'open-failed');
  return res.json().catch(() => ({}));
}

async function activateTarget(id) {
  await fetch(`${CDP}/json/activate/${id}`, { signal: AbortSignal.timeout(2000) }).catch(() => {});
}

export async function launchBrowser() {
  if (await cdpReady()) return { launched: false, alreadyRunning: true, endpoint: CDP };

  const exe = findChrome();
  if (!exe) {
    throw new BrowserError(
      'Could not find Chrome. Set GHFINDER_CHROME to the chrome.exe path and retry.',
      'no-chrome',
    );
  }

  const child = spawn(
    exe,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--restore-last-session=false',
      GMAIL,
    ],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await sleep(400);
    if (await cdpReady()) return { launched: true, alreadyRunning: false, endpoint: CDP };
  }
  throw new BrowserError(
    'Chrome was launched but the debug port never opened. If a Chrome window is ' +
      'already open with this profile, close it and try again.',
    'no-port',
  );
}

export async function addAccount() {
  if (!(await cdpReady())) {
    throw new BrowserError('Chrome debug port not reachable. Launch Chrome first.', 'cdp-down');
  }
  await openUrl(ADD_SESSION);
  return { opened: true };
}

export async function openMailbox(index) {
  const targets = await listTargets();
  const existing = targets.find((t) => t.type === 'page' && uIndexOf(t.url) === index);
  if (existing?.id) {
    await activateTarget(existing.id);
    return { opened: true, focused: true };
  }
  await openUrl(`${GMAIL}mail/u/${index}/`);
  return { opened: true, focused: false };
}
