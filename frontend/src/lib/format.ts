export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Time left until `untilSec` (unix seconds), measured from `nowMs`.
 * `precise` adds the seconds component — the compact form is for the top-bar
 * meter, the precise one for the popover where the exact rollover matters.
 */
export function countdown(untilSec: number, nowMs: number, precise = false): string {
  if (!untilSec) return '—';
  const left = Math.max(0, Math.round((untilSec * 1000 - nowMs) / 1000));
  if (left === 0) return 'now';
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const sec = left % 60;
  if (h) return precise ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
  if (m) return precise ? `${m}m ${String(sec).padStart(2, '0')}s` : `${m}m`;
  return `${sec}s`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function bytes(n: number): string {
  if (!n || n < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
