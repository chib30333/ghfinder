const $ = (id) => document.getElementById(id);
const logEl = $("log");

function log(text, cls) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
  logEl.innerHTML = "";
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.action !== "progress") return;
  if (msg.type === "start") {
    if (msg.items > msg.tabs) {
      log(`⚠ ${msg.items} entries but only ${msg.tabs} Gmail tab(s) — sending first ${msg.count}.`, "err");
    } else if (msg.tabs > msg.items) {
      log(`ℹ ${msg.tabs} Gmail tabs, ${msg.items} entries — using first ${msg.count} tab(s).`, "muted");
    }
    log(`Sending to ${msg.count} tab(s)…`, "muted");
  } else if (msg.type === "tab") {
    if (msg.ok) log(`✓ Tab ${msg.index + 1}: sent to ${msg.email}`, "ok");
    else log(`✗ Tab ${msg.index + 1} (${msg.email || "?"}): ${msg.error}`, "err");
  } else if (msg.type === "done") {
    const okCount = msg.results.filter((r) => r.ok).length;
    log(`Done. ${okCount}/${msg.results.length} sent.`, "muted");
    $("start").disabled = false;
  }
});

$("start").addEventListener("click", async () => {
  clearLog();
  let items;
  try {
    items = JSON.parse($("items").value);
    if (!Array.isArray(items)) throw new Error("Top level must be a JSON array.");
  } catch (e) {
    log("Invalid JSON: " + e.message, "err");
    return;
  }
  if (!items.length) {
    log("List is empty.", "err");
    return;
  }
  $("start").disabled = true;
  try {
    await chrome.runtime.sendMessage({ action: "start", items });
  } catch (e) {
    log("Failed to start: " + (e.message || e), "err");
    $("start").disabled = false;
  }
});

$("loadSame").addEventListener("click", async () => {
  const subject = prompt("Subject for all tabs:", "Hello");
  if (subject === null) return;
  const message = prompt("Message body for all tabs:", "Hi,\n\nThanks");
  if (message === null) return;
  const tabs = await chrome.tabs.query({ url: "https://mail.google.com/*" });
  const items = tabs.map(() => ({ email: "", subject, message }));
  $("items").value = JSON.stringify(items, null, 2);
  log(`Prepared ${items.length} entries (recipient left as-is per tab).`, "muted");
});
