

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(selectorFns, timeout = 8000) {
  const start = Date.now();
  const fns = Array.isArray(selectorFns) ? selectorFns : [selectorFns];
  while (Date.now() - start < timeout) {
    for (const fn of fns) {
      const el = fn();
      if (el) return el;
    }
    await sleep(150);
  }
  return null;
}

function setNativeValue(el, value) {
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = desc && desc.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fireKey(el, key, keyCode) {
  const opts = { bubbles: true, cancelable: true, key, code: key, keyCode, which: keyCode };
  el.dispatchEvent(new KeyboardEvent("keydown", opts));
  el.dispatchEvent(new KeyboardEvent("keypress", opts));
  el.dispatchEvent(new KeyboardEvent("keyup", opts));
}


function getComposeRoot() {
  const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]')).filter((d) =>
    d.querySelector('input[name="subjectbox"], div[aria-label="Message Body"]')
  );
  if (dialogs.length) return dialogs[dialogs.length - 1];
  if (document.querySelector('input[name="subjectbox"], div[aria-label="Message Body"]')) {
    return document;
  }
  return null;
}

function findToInput(root) {
  return (
    root.querySelector('input[aria-label="To recipients"]') ||
    root.querySelector('input[aria-label^="To"]') ||
    root.querySelector('input[peoplekit-id]') ||
    root.querySelector('textarea[name="to"]') ||
    root.querySelector('input[name="to"]')
  );
}

function findSubjectInput(root) {
  return root.querySelector('input[name="subjectbox"]');
}

function findBody(root) {
  return (
    root.querySelector('div[aria-label="Message Body"]') ||
    root.querySelector('div[role="textbox"][contenteditable="true"]')
  );
}

function findSendButton(root) {
  return (
    root.querySelector('div[role="button"][aria-label^="Send"]') ||
    root.querySelector('div[role="button"][data-tooltip^="Send"]') ||
    root.querySelector('div[data-tooltip^="Send"]')
  );
}


async function sendEmail({ email, subject, message }) {
  const root = await waitFor([getComposeRoot], 8000);
  if (!root) throw new Error("No open compose window found in this tab.");

  if (email) {
    const to = await waitFor([() => findToInput(root)], 6000);
    if (!to) throw new Error("Could not find the 'To' field.");
    to.focus();
    setNativeValue(to, email);
    await sleep(200);
    fireKey(to, "Enter", 13);
    await sleep(200);
  }

  if (typeof subject === "string" && subject.length) {
    const subj = findSubjectInput(root);
    if (subj) {
      subj.focus();
      setNativeValue(subj, subject);
      await sleep(150);
    }
  }

  if (typeof message === "string") {
    const body = await waitFor([() => findBody(root)], 6000);
    if (!body) throw new Error("Could not find the message body.");
    body.focus();
    body.innerHTML = message
      .split("\n")
      .map((line) => (line === "" ? "<br>" : escapeHtml(line)))
      .join("<br>");
    body.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await sleep(200);
  }

  const sendBtn = findSendButton(root);
  if (sendBtn) {
    sendBtn.click();
  } else {
    const body = findBody(root) || document.activeElement;
    body.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Enter",
        keyCode: 13,
        which: 13,
        ctrlKey: true,
      })
    );
  }

  await sleep(600);
  return { ok: true };
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "sendEmail") {
    sendEmail(msg.data)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true;
  }
  if (msg && msg.action === "ping") {
    sendResponse({ ok: true });
    return true;
  }
});
