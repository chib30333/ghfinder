# @ghfinder/sender

Automated **multi-account Gmail outreach**. Connects to a running Chrome over
CDP, reads recipients (email + name) from the shared SQLite DB via
`@ghfinder/core`, opens Gmail **Compose**, and types **To / Subject / Body**
character-by-character. Optionally clicks **Send**, spreading recipients
round-robin across every signed-in account.

This is the standalone process the local API (`apps/server`) spawns for the
`POST /api/campaigns/send/start` job. The old browser-extension variant now
lives separately in [`apps/extension`](../extension).

## Why "connect over CDP" instead of launching Chrome?

This machine runs as the built-in **Administrator** (elevated). Playwright's
normal `chromium.launch()` fails here — elevated Chrome relaunches itself to
de-elevate and severs the debug pipe. So we drive a Chrome that is **already
running** on a debug **port** instead.

## Setup

```powershell
npm install          # from the repo root — hoists playwright-core for this app
```

`@ghfinder/core` owns the database path (`config.dbPath`, default
`data/ghfinder.sqlite`, overridable with the `GHFINDER_DB` env var) and reads
`GITHUB_TOKEN` from the repo-root `.env`, same as the CLI and server.

**Chrome launches automatically.** When nothing is listening on the debug port,
the sender starts Chrome using your **main Chrome profile** (so Gmail is already
signed in) and opens Gmail.

> ⚠️ **Close all your everyday Chrome windows first.** Chrome only opens the
> debug port when no other Chrome is already using that profile. If Chrome is
> already running, the launch silently forwards to the existing window and the
> port never opens — the sender detects this and tells you to close Chrome.

To start Chrome yourself instead (e.g. a different profile):

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="$env:LOCALAPPDATA\Google\Chrome\User Data" `
  --profile-directory="Default" `
  --no-first-run --no-default-browser-check `
  https://mail.google.com/
```

## Usage (from the repo root)

```powershell
node apps/sender/src/index.mjs                  # first recipient, fills the draft, does NOT send
node apps/sender/src/index.mjs --send           # first recipient, also clicks Send
node apps/sender/src/index.mjs --index 2        # use the 3rd recipient with an email (0-based)
node apps/sender/src/index.mjs --send --count 5 # first 5 recipients, send each
node apps/sender/src/index.mjs --send --all     # every recipient, spread over all accounts
node apps/sender/src/index.mjs --send --all --index 10        # all, starting at #10
node apps/sender/src/index.mjs --send --all --per-account 400 # cap 400 msgs/account this run
node apps/sender/src/index.mjs --send --all --accounts 0,1,2  # only use accounts /u/0/../u/2/
```

Or via the workspace scripts: `npm run -w @ghfinder/sender draft` / `send`, or
from the repo root `npm run send -- --all --per-account 400`.

Options:

| Flag        | Default                   | Meaning                                       |
| ----------- | ------------------------- | --------------------------------------------- |
| `--send`    | off                       | Actually send. Without it, draft only.        |
| `--index N` | `0`                       | Starting recipient (0-based) among those w/ email |
| `--count N` | `1`                       | How many recipients to process from `--index` |
| `--all`     | off                       | Process every recipient from `--index` onward |
| `--accounts LIST` | (auto-discover)     | Comma-separated `/u/N/` indexes to send from  |
| `--per-account N` | `0` (unlimited)     | Max messages per account this run             |
| `--no-sweep` | off                      | Skip the bounce prune **and** the block-account exclusion |
| `--sweep-only` | off                    | Prune bounced addresses and exit (no sending) |
| `--cdp URL` | `http://127.0.0.1:9222`   | CDP endpoint of the running Chrome            |
| `--no-launch` | off                     | Don't auto-start Chrome; require it already running |
| `--chrome PATH` | (auto-detected)       | Path to `chrome.exe` for auto-launch          |
| `--user-data-dir DIR` | main profile dir  | Chrome user-data dir to launch                |
| `--profile-directory NAME` | `Default`    | Which profile inside the user-data dir        |

> The database path is no longer a flag — it comes from `@ghfinder/core`. Set
> `GHFINDER_DB` in the environment to point at a different SQLite file.

### Multi-account rotation

Recipients are spread **round-robin** across every Gmail account signed into the
debug Chrome. On startup the sender auto-discovers accounts by reading the open
`https://mail.google.com/mail/u/<N>/` tabs (recipient #1 → `/u/0/`, #2 → the next
account, and so on, wrapping around). Each account keeps its own Compose tab.

- `--accounts 0,1,2` restricts sending to specific `/u/N/` indexes instead of
  auto-discovering all of them.
- `--per-account N` caps how many messages each account sends this run; once
  every account hits the cap the run stops early. Use it to stay under Gmail's
  daily send limits (free accounts allow ~500 recipients/day).

> The account indexes (`/u/0/`, `/u/1/`, …) are assigned by Gmail in the order
> you signed in, and they persist in the profile. Keep the debug Chrome open
> while the sender runs.

### Bounce & block hygiene (runs by default; `--no-sweep` to skip)

Before composing anything, a `--send` run sweeps each account's own inbox:

- **Bounces** — searches for Mail-Delivery-Subsystem failures and deletes the
  undeliverable address from the DB so it's never re-fetched.
- **Blocks** — searches for a recent "Message blocked … has been blocked" notice
  (Gmail throttling that account's outgoing mail). **Any account with such a
  notice in the last day is excluded from the whole run's rotation.** The notice
  lingers in the inbox all day, so every subsequent run that day re-detects it —
  the account stays excluded for the rest of the day, then rejoins automatically.
  If *every* account is blocked, the run aborts with a clear message rather than
  sending from a throttled account.

Pass `--no-sweep` to skip both, or `--sweep-only` to prune bounces and exit
without sending. Block detection only runs together with `--send`.

### Rate limiting

When processing more than one recipient, the sender waits a **random 5–10
seconds** between each message (no wait after the last one) to keep sending
human-paced and within Gmail's limits. Each recipient gets a fresh Compose
window.

The message built for recipient *U* is:

- **To:** `U.email`
- **Subject:** `hello {U.name}` (falls back to `login` if name is null)
- **Body:** `hello` (placeholder — wire the real template in `composeOne`)

The sender **detaches** from Chrome when done — it never closes your browser.
