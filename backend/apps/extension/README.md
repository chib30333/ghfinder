# @ghfinder/extension — Gmail Multi-Tab Sender (Chrome extension)

Fills the **already-open compose window** in each of your Gmail tabs from a list
you paste, clicks **Send**, then moves on to the next tab.

This is the browser-based alternative to [`apps/sender`](../sender) (the CDP Node
sender the API drives). It runs entirely inside Chrome — no Node, no database. It
is not part of the npm dependency graph; the `package.json` here exists only so
the folder is a first-class workspace member.

## Files

| File | Role |
|------|------|
| `manifest.json` | Extension manifest (MV3) |
| `content.js` | Runs in each Gmail tab: finds the compose fields, types To / Subject / Body, clicks Send |
| `background.js` | Iterates the open Gmail tabs in order and hands each one its list entry |
| `popup.html` / `popup.js` | The toolbar UI where you paste the list and start |

## Install

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `apps/extension` folder.
4. Pin the extension so its icon shows in the toolbar.

## Use

1. Open one Gmail tab per email you want to send, and **open the compose
   window in each tab** (click *Compose*).
2. Click the extension icon.
3. Paste your list as a JSON array — one object per tab, **in tab order
   (left → right, first window first):**

   ```json
   [
     { "email": "alice@example.com", "subject": "Hello", "message": "Hi Alice,\nThis is a test.\n\nThanks" },
     { "email": "bob@example.com",   "subject": "Hello", "message": "Hi Bob,\nSecond message." }
   ]
   ```

   - `email` — recipient. Leave as `""` if the tab already has the recipient filled.
   - `subject` — optional; omit or `""` to leave the subject untouched.
   - `message` — body. `\n` becomes a line break.

4. Click **Send to all tabs**. Progress (✓ / ✗ per tab) shows in the popup.

> **Same message to everyone?** Click *Same message to all…*, enter a subject
> and body, and it builds one entry per open Gmail tab (recipient left as-is,
> so type it per tab or set it in the list).

## Notes & limitations

- Entry #1 → Gmail tab #1, #2 → tab #2, etc. If you have more entries than tabs,
  the extras are skipped (the popup warns you).
- Gmail's DOM changes occasionally. If a field isn't found, the popup shows the
  error for that tab; update the selectors in `content.js`
  (`findToInput` / `findSubjectInput` / `findBody` / `findSendButton`).
- The extension activates each tab in turn so its compose window is live before
  filling — expect the browser to flip through the tabs while it runs.
- This automates *your own* logged-in Gmail. Use it responsibly, only for
  recipients who have opted in, and within Gmail's sending limits and terms.
