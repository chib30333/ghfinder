#!/usr/bin/env node

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config, recipients, loadTemplate, toEntry, isValidEmail, looksLikeOrg, deleteUser, markEmailed, deleteByEmail } from '@ghfinder/core';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const SEND = process.argv.includes('--send');
const ALL = process.argv.includes('--all');
const NO_LAUNCH = process.argv.includes('--no-launch');
const INDEX = parseInt(arg('index', '0'), 10);
const COUNT = parseInt(arg('count', '1'), 10);
const CDP = arg('cdp', 'http://127.0.0.1:9222');

const ACCOUNTS_ARG = arg('accounts', '');
const PER_ACCOUNT = parseInt(arg('per-account', '0'), 10);

// Messages each account (by /u/slot/ index) already sent earlier today, passed as
// "3=14,9=14". Subtracted from PER_ACCOUNT so a resumed day only tops each account
// up to the cap instead of sending a fresh full batch.
const SENT_OFFSETS = new Map();
for (const pair of arg('sent-offsets', '').split(',')) {
  const [rawSlot, rawN] = pair.split('=');
  const slot = parseInt(rawSlot, 10);
  const n = parseInt(rawN, 10);
  if (Number.isInteger(slot) && Number.isInteger(n) && n > 0) SENT_OFFSETS.set(slot, n);
}

const LOCALAPPDATA = process.env.LOCALAPPDATA || '';
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
];
const CHROME_EXE = arg('chrome', CHROME_CANDIDATES.find((p) => fs.existsSync(p)));
const USER_DATA_DIR = arg(
  'user-data-dir',
  path.join(LOCALAPPDATA, 'Google', 'Chrome', 'User Data')
);
const PROFILE_DIR = arg('profile-directory', 'Default');
const DEBUG_PORT = parseInt(new URL(CDP).port || '9222', 10);

const DELAY_MIN_MS = 5000;
const DELAY_MAX_MS = 10000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () =>
  Math.floor(DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));

// Per-keystroke delay while typing into Gmail fields (ms). Randomised per key so
// the composing looks like a fast, human expert typist (~120–240 WPM) while
// still being clearly visible over CDP.
const TYPE_MIN_MS = 10;
const TYPE_MAX_MS = 20;
const typeDelay = () =>
  Math.floor(TYPE_MIN_MS + Math.random() * (TYPE_MAX_MS - TYPE_MIN_MS));

async function cdpReady() {
  try {
    const res = await fetch(`${CDP}/json/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function launchChrome() {
  if (!CHROME_EXE || !fs.existsSync(CHROME_EXE)) {
    throw new Error(
      'Could not find chrome.exe. Pass --chrome "C:\\path\\to\\chrome.exe".'
    );
  }
  console.log(`Launching Chrome (profile "${PROFILE_DIR}") on port ${DEBUG_PORT}...`);
  const child = spawn(
    CHROME_EXE,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      `--profile-directory=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--restore-last-session=false',
      'https://mail.google.com/',
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

async function connectToChrome() {
  if (await cdpReady()) {
    console.log(`Attached to Chrome already running on ${CDP}.`);
    return chromium.connectOverCDP(CDP);
  }

  if (NO_LAUNCH) {
    throw new Error(`Nothing is listening on ${CDP} and --no-launch was set.`);
  }

  launchChrome();

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await sleep(500);
    if (await cdpReady()) {
      console.log('Chrome is up.');
      return chromium.connectOverCDP(CDP);
    }
  }
  throw new Error(
    `Chrome did not expose the debug port within 30s.\n` +
      `Most likely cause: Chrome was ALREADY running with this profile, so the\n` +
      `new process just forwarded to it and the port never opened.\n` +
      `Fix: close ALL Chrome windows completely, then re-run.`
  );
}

const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;

// Bounce detection. Delivery-failure notices come from the Mail Delivery
// Subsystem; the failed recipient appears right after "…wasn't delivered to".
// We search the inbox for these and delete the dead address from the DB.
const BOUNCE_SEARCH = 'from:mailer-daemon';
const BOUNCE_ADDR_RE =
  /delivered to[:\s]+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;
const isDaemonAddr = (a) =>
  a.includes('mailer-daemon') || a.endsWith('@google.com') || a.endsWith('@googlemail.com');

// Block detection. When Gmail throttles an account's outgoing mail (reputation /
// spam flag), it drops a "Message blocked … has been blocked" notice into THAT
// account's own inbox. Sending more from a blocked account the same day just
// bounces every message and hardens the flag, so an account with such a notice
// in the last day is pulled from the rotation for the whole run. The search
// finds the notice by its heading; the confirm regex deliberately matches only
// body wording NOT present in the query, so an echoed search term can't false-
// positive every account.
const BLOCK_SEARCH = '"message blocked" newer_than:1d';
const BLOCK_CONFIRM_RE = /been blocked|was blocked/i;

const uIndexOf = (url) => {
  const m = url.match(/\/mail\/u\/(\d+)\//);
  return m ? parseInt(m[1], 10) : null;
};

async function discoverAccounts(context) {
  if (ACCOUNTS_ARG) {
    return ACCOUNTS_ARG.split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n))
      .map((index) => ({ index, email: null }));
  }
  const seen = new Map();
  for (const p of context.pages()) {
    const idx = uIndexOf(p.url());
    if (idx === null || seen.has(idx)) continue;
    let email = null;
    try {
      email = (await p.title()).match(EMAIL_RE)?.[1] ?? null;
    } catch {}
    seen.set(idx, email);
  }
  return [...seen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, email]) => ({ index, email }));
}

// Raise a tab to the foreground of its Chrome window so the operator can watch the
// compose/send happen live. page.bringToFront() drives CDP's Page.bringToFront; we
// ALSO hit the DevTools /json/activate endpoint because, connected over CDP, that
// call alone doesn't reliably switch the visibly-active tab in a real Chrome tab
// strip. Best-effort — a failure to raise the tab must never abort a send.
async function bringTabToFront(context, page) {
  try {
    await page.bringToFront();
  } catch { }
  try {
    const session = await context.newCDPSession(page);
    const info = await session.send('Target.getTargetInfo');
    await session.detach().catch(() => {});
    const id = info?.targetInfo?.targetId;
    if (id) {
      await fetch(`${CDP}/json/activate/${id}`, { signal: AbortSignal.timeout(2000) }).catch(() => {});
    }
  } catch { }
}

async function pageForAccount(context, index, cache) {
  let page = cache.get(index);
  if (!page) {
    page = context.pages().find((p) => uIndexOf(p.url()) === index);
    if (!page) {
      page = await context.newPage();
      await page.goto(`https://mail.google.com/mail/u/${index}/`);
    }
    await page.getByRole('button', { name: 'Compose' }).waitFor({ timeout: 30000 });
    cache.set(index, page);
  }
  // Bring this account's tab to the front on EVERY use, not just the first. The
  // cache short-circuit used to return early here, so once the bounce sweep had
  // cached every account, the send loop raised no tab at all and all composing
  // ran on a hidden background tab.
  await bringTabToFront(context, page);
  return page;
}

async function typeText(locator, text) {
  // Type one character at a time with a randomised per-key pause (TYPE_MIN_MS..
  // TYPE_MAX_MS), pressing Enter for newlines (Gmail's body is a contenteditable,
  // so a raw pressSequentially would swallow the template's paragraph breaks).
  const chars = [...String(text)];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '\n') {
      await locator.press('Enter');
    } else {
      await locator.pressSequentially(chars[i]);
    }
    await sleep(typeDelay());
  }
}

async function composeOne(page, user, tpl) {
  const to = String(user.email).trim();
  // Render the operator's saved template (subject + body + footer), filling
  // {{firstName}} per recipient — the same content shown in the UI preview.
  const { subject, message } = toEntry(user, tpl);

  console.log(`\n> ${user.name ?? user.login} <${to}>`);
  console.log(`  Subject: ${subject}`);

  await page.getByRole('button', { name: 'Compose' }).click();

  const toBox = page.getByRole('combobox', { name: 'To recipients' });
  await toBox.waitFor({ state: 'visible' });
  await typeText(toBox, to);

  await typeText(page.getByRole('textbox', { name: 'Subject' }), subject);
  await typeText(page.getByRole('textbox', { name: 'Message Body' }), message);

  if (SEND) {
    const sendBtn = page.getByRole('button', { name: /^Send/ });
    await sendBtn.waitFor({ state: 'visible' });
    await sendBtn.click();
    await page.getByText('Message sent', { exact: false }).waitFor({ timeout: 15000 });
    // Persist the send so this address (and any duplicate rows) never gets a
    // second message on a future run — `recipients` filters on emailed_at.
    markEmailed(to);
    console.log('  Sent.');
  } else {
    console.log('  Draft filled. Not sent (pass --send to send).');
  }
}

// Best-effort: discard any compose window a failed send left open, so it does
// not stack on top of the next recipient's Compose. Cleanup must never throw —
// every step is guarded so a stubborn dialog can't abort the run itself.
async function dismissCompose(page) {
  if (!page) return;
  try {
    const discard = page.getByRole('button', { name: 'Discard draft' }).first();
    if (await discard.isVisible().catch(() => false)) {
      await discard.click({ timeout: 3000 });
      return;
    }
  } catch { }
  try { await page.keyboard.press('Escape'); } catch { }
}

// Scan each sending account's inbox for delivery-failure notices and delete the
// undeliverable address from the DB. Bounces arrive asynchronously (minutes after
// a send), so a run prunes the bounces produced by earlier runs. Best-effort: any
// failure is logged and swallowed so a broken sweep never blocks a send.
async function sweepBounces(context, accounts, cache) {
  let removed = 0;
  const handled = new Set();
  for (const acct of accounts) {
    let page;
    try {
      page = await pageForAccount(context, acct.index, cache);
    } catch {
      continue; // account tab not ready — skip its sweep, don't abort
    }

    const q = encodeURIComponent(BOUNCE_SEARCH);
    await page.goto(`https://mail.google.com/mail/u/${acct.index}/#search/${q}`).catch(() => {});
    // Gmail is an SPA; nudge its router in case goto was a same-document hash
    // change, then let the result list settle.
    await page.evaluate((hash) => { window.location.hash = `search/${hash}`; }, q).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1500);

    let text = '';
    try {
      text = await page.getByRole('main').first().innerText();
    } catch {
      text = '';
    }

    const addrs = new Set();
    for (const m of text.matchAll(BOUNCE_ADDR_RE)) {
      const a = m[1].toLowerCase().replace(/[.,;]+$/, '');
      if (!isDaemonAddr(a)) addrs.add(a);
    }

    for (const a of addrs) {
      if (handled.has(a)) continue;
      handled.add(a);
      const n = deleteByEmail(a);
      if (n > 0) {
        removed += n;
        console.log(`[bounce] ${a} — undeliverable, removed ${n} row(s) from DB`);
      }
    }
  }
  return removed;
}

// Scan each sending account's inbox for a recent "Message blocked" notice and
// return the set of account slot indexes that have one. An account in this set
// is being throttled by Gmail today and must be excluded from the run. Because
// the notice lingers in the inbox all day, every run that day re-detects it —
// so the exclusion effectively lasts the day, which is what we want. Best-effort:
// a failed scan for one account is skipped and never aborts the run.
async function sweepBlocks(context, accounts, cache) {
  const blocked = new Set();
  for (const acct of accounts) {
    let page;
    try {
      page = await pageForAccount(context, acct.index, cache);
    } catch {
      continue; // account tab not ready — skip its scan, don't abort
    }

    const q = encodeURIComponent(BLOCK_SEARCH);
    await page.goto(`https://mail.google.com/mail/u/${acct.index}/#search/${q}`).catch(() => {});
    // Gmail is an SPA; nudge its router in case goto was a same-document hash
    // change, then let the result list settle.
    await page.evaluate((hash) => { window.location.hash = `search/${hash}`; }, q).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1500);

    let text = '';
    try {
      text = await page.getByRole('main').first().innerText();
    } catch {
      text = '';
    }

    if (BLOCK_CONFIRM_RE.test(text)) blocked.add(acct.index);
  }
  return blocked;
}

async function main() {
  const SWEEP_ONLY = process.argv.includes('--sweep-only');
  const NO_SWEEP = process.argv.includes('--no-sweep');

  const browser = await connectToChrome();
  const context = browser.contexts()[0];
  if (!context) throw new Error('No browser context found on the CDP endpoint.');

  // If Chrome (or the CDP connection) goes away mid-run, every subsequent Gmail
  // action throws "Target page, context or browser has been closed". Without
  // this guard the run would grind through every remaining recipient failing
  // each one (6-10s apart) for hours. Track the disconnect so the loop can bail.
  let browserAlive = true;
  browser.on('disconnected', () => { browserAlive = false; });

  for (let i = 0; i < 20 && context.pages().length === 0; i++) {
    await sleep(250);
  }

  const accounts = await discoverAccounts(context);
  if (accounts.length === 0) {
    throw new Error(
      'No signed-in Gmail accounts found. Open Gmail tabs (/u/0/, /u/1/, ...) ' +
        'in the debug Chrome, or pass --accounts "0,1,2".'
    );
  }

  const cache = new Map();

  // Prune addresses that already hard-bounced (Mail Delivery Subsystem reported
  // the recipient or domain doesn't exist) before composing anything new, so dead
  // leads are gone and never re-fetched into this batch. Runs by default every
  // send; pass --no-sweep to skip it or --sweep-only to prune and exit.
  if (SWEEP_ONLY || !NO_SWEEP) {
    try {
      const pruned = await sweepBounces(context, accounts, cache);
      console.log(`Bounce sweep: removed ${pruned} undeliverable recipient(s) from the DB.`);
    } catch (e) {
      console.log(`Bounce sweep skipped (${e.message}).`);
    }
  }
  if (SWEEP_ONLY) {
    try { await browser.close(); } catch { }
    return;
  }

  // Pull any account Gmail has recently blocked out of today's rotation. A
  // "Message blocked" notice in an account's own inbox means Gmail is throttling
  // its outgoing mail; sending more from it today only bounces and hardens the
  // flag. Only relevant when actually sending; --no-sweep disables it too.
  let blockedToday = new Set();
  if (SEND && !NO_SWEEP) {
    try {
      blockedToday = await sweepBlocks(context, accounts, cache);
      if (blockedToday.size) {
        const names = accounts
          .filter((a) => blockedToday.has(a.index))
          .map((a) => `/u/${a.index}/ ${a.email ?? ''}`.trim());
        console.log(
          `Block sweep: excluding ${blockedToday.size} account(s) blocked by Gmail in the last day — ${names.join(', ')}.`
        );
      } else {
        console.log('Block sweep: no accounts blocked in the last day.');
      }
    } catch (e) {
      console.log(`Block sweep skipped (${e.message}).`);
    }
  }
  if (blockedToday.size >= accounts.length) {
    throw new Error(
      'Every sending account was blocked by Gmail in the last day — nothing safe to send from today. ' +
        'Add another account or retry tomorrow.'
    );
  }

  const limit = ALL ? -1 : Math.max(1, COUNT);
  const fetched = recipients({ offset: INDEX, limit });
  if (fetched.length === 0) throw new Error(`No recipients with an email at offset ${INDEX}`);

  // Prune junk the crawler harvested before composing anything: a malformed
  // address (a bare "adam.fr" with no @, which Gmail rejects) or a `name` that is
  // an organisation, not a person ("TaylorMade Software, Inc." → "Hi, TaylorMade"
  // into a corporate inbox). Both are skipped for this run AND deleted so they
  // never resurface. Malformed rows delete by login; org rows delete by address so
  // any duplicate logins for the same org go too.
  const users = [];
  let removed = 0;
  for (const u of fetched) {
    if (!isValidEmail(u.email)) {
      removed++;
      console.log(`[skip] ${u.login} — malformed email "${u.email}", removing from DB`);
      try {
        deleteUser(u.login);
      } catch (e) {
        console.log(`  (could not delete ${u.login}: ${e.message})`);
      }
      continue;
    }
    if (looksLikeOrg(u.name)) {
      removed++;
      console.log(`[skip] ${u.login} — "${u.name}" looks like an organisation, not a person; removing from DB`);
      try {
        deleteByEmail(u.email);
      } catch (e) {
        console.log(`  (could not delete ${u.email}: ${e.message})`);
      }
      continue;
    }
    users.push(u);
  }
  if (removed > 0) console.log(`Removed ${removed} recipient(s) (malformed email or company name).`);
  if (users.length === 0) throw new Error('No recipients with a valid, person-named email address in this batch.');

  const tpl = loadTemplate();

  console.log(`DB: ${config.dbPath}`);
  console.log(`Recipients to process: ${users.length} (from offset ${INDEX})`);
  console.log(`Send:  ${SEND ? 'YES (will click Send)' : 'no (draft only)'}`);
  const activeCount = accounts.filter((a) => !blockedToday.has(a.index)).length;
  console.log(`Sending accounts (${activeCount} of ${accounts.length} usable, round-robin):`);
  for (const a of accounts) {
    const flag = blockedToday.has(a.index) ? '  (blocked today — excluded)' : '';
    console.log(`  /u/${a.index}/  ${a.email ?? '(unknown)'}${flag}`);
  }
  if (PER_ACCOUNT > 0) console.log(`Per-account cap: ${PER_ACCOUNT} message(s)/account/day.`);
  // Remaining headroom for THIS run = cap − whatever the account already sent today.
  // Zero (or no) PER_ACCOUNT means uncapped; an account already at the cap gets 0.
  const capFor = (index) =>
    PER_ACCOUNT > 0 ? Math.max(0, PER_ACCOUNT - (SENT_OFFSETS.get(index) ?? 0)) : Infinity;
  if (SENT_OFFSETS.size) {
    const parts = accounts
      .filter((a) => SENT_OFFSETS.has(a.index))
      .map((a) => `/u/${a.index}/ ${SENT_OFFSETS.get(a.index)} sent → ${capFor(a.index)} left`);
    console.log(`Resuming today's caps — ${parts.join(', ')}.`);
  }

  // Counts NEW sends this run per account (0-based) — drives the per-account cap
  // gate below and the run summary. The daily offset is applied via capFor, not here.
  const sentPer = new Map(accounts.map((a) => [a.index, 0]));
  // Consecutive failures PER account, and the set of accounts we've given up on.
  // A single broken account (signed out, crashed tab, hit Gmail's send limit)
  // fails every attempt while the browser stays connected and the OTHER accounts
  // keep succeeding — so a global counter never trips. Track each account's own
  // streak, drop it from the rotation after too many in a row, and stop the whole
  // run only once every account is dropped (or capped, or the browser is gone).
  const failPer = new Map(accounts.map((a) => [a.index, 0]));
  // Seed the drop-set with accounts Gmail blocked today so the rotation never
  // routes to them — they're treated exactly like an account that failed out.
  const dropped = new Set(blockedToday);
  const MAX_ACCOUNT_FAILURES = 5;
  let rr = 0;
  let done = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i++) {
    if (!browserAlive || !browser.isConnected()) {
      console.error(
        '\nChrome/CDP connection lost — stopping the run. Relaunch the debug Chrome ' +
          '(Gmail tabs signed in) and start the send again.'
      );
      break;
    }

    let acct = null;
    for (let t = 0; t < accounts.length; t++) {
      const cand = accounts[(rr + t) % accounts.length];
      if (dropped.has(cand.index)) continue;
      if (sentPer.get(cand.index) < capFor(cand.index)) {
        acct = cand;
        rr = (rr + t + 1) % accounts.length;
        break;
      }
    }
    if (!acct) {
      const allDropped = accounts.every((a) => dropped.has(a.index));
      console.log(
        allDropped
          ? `\nEvery account was excluded (blocked by Gmail or dropped after repeated failures) — stopping.`
          : `\nAll ${accounts.length} accounts hit the per-account cap (${PER_ACCOUNT}). Stopping.`
      );
      break;
    }

    console.log(`\n[${i + 1}/${users.length}] via /u/${acct.index}/ ${acct.email ?? ''}`);
    // Isolate every recipient: a bad address (e.g. a well-formed but dead mailbox
    // Gmail refuses to send, or a Send that never confirms) must not abort the
    // whole batch. Log it, discard the stuck compose, and move to the next one.
    try {
      const page = await pageForAccount(context, acct.index, cache);
      await composeOne(page, users[i], tpl);
      sentPer.set(acct.index, sentPer.get(acct.index) + 1);
      failPer.set(acct.index, 0);
      done++;
    } catch (e) {
      failed++;
      console.log(`  [error] ${users[i].login} <${users[i].email}> — ${e.message}. Skipping to next.`);
      // A gone browser/context fails every send identically — abort immediately.
      if (!browserAlive || !browser.isConnected()) {
        console.error('  Chrome/CDP connection is gone — aborting the run.');
        break;
      }
      const streak = (failPer.get(acct.index) ?? 0) + 1;
      failPer.set(acct.index, streak);
      // Drop a persistently-failing account (its own tab crashed / signed out /
      // hit Gmail's limit) so we stop routing to it and rotate to the others.
      if (streak >= MAX_ACCOUNT_FAILURES) {
        dropped.add(acct.index);
        cache.delete(acct.index);
        console.error(
          `  /u/${acct.index}/ failed ${streak} times in a row — dropping it from this run's rotation.`
        );
        if (accounts.every((a) => dropped.has(a.index))) {
          console.error('  Every account has been dropped after repeated failures — aborting the run.');
          break;
        }
      }
      await dismissCompose(cache.get(acct.index));
    }

    if (i < users.length - 1) {
      const ms = randomDelay();
      console.log(`  Waiting ${(ms / 1000).toFixed(1)}s before next...`);
      await sleep(ms);
    }
  }

  console.log(`\nDone. ${SEND ? 'Sent' : 'Drafted'} ${done} message(s)${failed ? `, ${failed} skipped after errors` : ''}.`);
  console.log('Per-account totals:');
  for (const a of accounts) {
    const flag = blockedToday.has(a.index) ? ' (blocked today — excluded)' : '';
    console.log(`  /u/${a.index}/ ${a.email ?? ''}: ${sentPer.get(a.index)}${flag}`);
  }

  // If we aborted because Chrome went away, closing an already-disconnected
  // browser throws — swallow it so the run still exits cleanly with its summary.
  try { await browser.close(); } catch { }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
