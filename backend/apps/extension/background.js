
async function getGmailTabs() {
  const tabs = await chrome.tabs.query({ url: "https://mail.google.com/*" });
  return tabs.sort((a, b) => (a.windowId - b.windowId) || (a.index - b.index));
}

async function sendToTab(tab, data) {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (e) {
  }
  return chrome.tabs.sendMessage(tab.id, { action: "sendEmail", data });
}

function report(update) {
  chrome.runtime.sendMessage({ action: "progress", ...update }).catch(() => {});
}

async function run(items) {
  const tabs = await getGmailTabs();
  const count = Math.min(tabs.length, items.length);

  report({ type: "start", tabs: tabs.length, items: items.length, count });

  const results = [];
  for (let i = 0; i < count; i++) {
    const tab = tabs[i];
    const data = items[i];
    try {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
      await new Promise((r) => setTimeout(r, 400));

      const res = await sendToTab(tab, data);
      const ok = res && res.ok;
      results.push({ index: i, email: data.email, ok, error: res && res.error });
      report({ type: "tab", index: i, email: data.email, ok, error: res && res.error });
    } catch (err) {
      const error = String(err && err.message ? err.message : err);
      results.push({ index: i, email: data.email, ok: false, error });
      report({ type: "tab", index: i, email: data.email, ok: false, error });
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  report({ type: "done", results });
  return results;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "start") {
    run(msg.items || [])
      .then((results) => sendResponse({ ok: true, results }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true;
  }
});
