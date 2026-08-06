import type { Tone } from './common';

export interface City {
  id: number;
  city: string;
  state: string;
  status: 'done' | 'active' | 'pending' | 'skipped';
  found: number;
  updated: string;
  updatedAt: string | null;
}

export interface CrawlBar {
  city: string;
  found: string;
  pct: number;
  tone: Tone;
}

export interface ActivityItem {
  icon: string;
  tone: Tone;
  text: string;
  time: string;
}
