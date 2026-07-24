const PALETTE = [
  '#7C6CFB', '#22D3EE', '#34D399', '#FBBF24', '#F87171',
  '#F472B6', '#60A5FA', '#A78BFA', '#4ADE80', '#FB923C',
];

export function hue(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string): string {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
}
