const CDP = process.env.GHFINDER_CDP || 'http://127.0.0.1:9222';
const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;

const uIndexOf = (url) => {
  const m = url.match(/\/mail\/u\/(\d+)\//);
  return m ? Number(m[1]) : null;
};

export async function getGmailAccounts() {
  let targets;
  try {
    const res = await fetch(`${CDP}/json`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { cdp: 'down', endpoint: CDP, accounts: [] };
    targets = await res.json();
  } catch {
    return { cdp: 'down', endpoint: CDP, accounts: [] };
  }

  const byIndex = new Map();
  for (const t of targets) {
    if (t.type !== 'page' || !t.url || !t.url.includes('mail.google.com')) continue;
    const idx = uIndexOf(t.url);
    if (idx === null || byIndex.has(idx)) continue;
    byIndex.set(idx, {
      index: idx,
      email: (t.title || '').match(EMAIL_RE)?.[1] ?? null,
      title: t.title ?? null,
      url: t.url,
    });
  }

  const accounts = [...byIndex.values()].sort((a, b) => a.index - b.index);
  return { cdp: 'up', endpoint: CDP, accounts };
}
