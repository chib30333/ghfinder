import type { ActivityItem, City, CrawlBar, Tone } from '@/types';
import { fmt } from '@/lib/format';


const BAR_TONE: Record<City['status'], Tone> = {
  done: 'success',
  active: 'warning',
  pending: 'neutral',
  skipped: 'neutral',
};

export function deriveCrawlBars(cities: City[], max = 6): CrawlBar[] {
  const withLeads = cities.filter((c) => c.found > 0 || c.status === 'active');
  const peak = withLeads.reduce((m, c) => Math.max(m, c.found), 1);
  return withLeads.slice(0, max).map((c) => ({
    city: `${c.city}, ${c.state}`,
    found: fmt(c.found),
    pct: c.status === 'done' ? 100 : Math.max(6, Math.round((c.found / peak) * 100)),
    tone: BAR_TONE[c.status],
  }));
}

export function deriveActivity(cities: City[], max = 6): ActivityItem[] {
  return cities.slice(0, max).map((c) =>
    c.status === 'active'
      ? { icon: 'globe', tone: 'warning' as Tone, text: `Crawling ${c.city}, ${c.state}…`, time: c.updated }
      : { icon: 'users', tone: 'accent' as Tone, text: `${fmt(c.found)} leads found in ${c.city}, ${c.state}`, time: c.updated },
  );
}
