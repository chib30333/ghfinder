
export const FLOOR_YEAR = 2007;

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const NEXT_GRANULARITY = {
  all: 'year',
  year: 'month',
  month: 'week',
  week: 'day',
  day: null,
};

export function canSplit(granularity) {
  return NEXT_GRANULARITY[granularity] != null;
}

function dayChunks(from, to, size) {
  const out = [];
  const end = parse(to);
  const cur = parse(from);
  while (cur <= end) {
    const start = new Date(cur);
    const stop = new Date(cur);
    stop.setUTCDate(stop.getUTCDate() + size - 1);
    if (stop > end) stop.setTime(end.getTime());
    out.push({ from: fmt(start), to: fmt(stop) });
    cur.setUTCDate(cur.getUTCDate() + size);
  }
  return out;
}

export function childWindows({ granularity, date_from, date_to }, currentYear) {
  switch (granularity) {
    case 'all': {
      const out = [];
      for (let y = FLOOR_YEAR; y <= currentYear; y++) {
        out.push({ from: `${y}-01-01`, to: `${y}-12-31`, granularity: 'year' });
      }
      return out;
    }
    case 'year': {
      const y = Number(date_from.slice(0, 4));
      const out = [];
      for (let m = 1; m <= 12; m++) {
        out.push({
          from: `${y}-${pad(m)}-01`,
          to: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}`,
          granularity: 'month',
        });
      }
      return out;
    }
    case 'month':
      return dayChunks(date_from, date_to, 7).map((w) => ({ ...w, granularity: 'week' }));
    case 'week':
      return dayChunks(date_from, date_to, 1).map((w) => ({ ...w, granularity: 'day' }));
    default:
      return [];
  }
}
