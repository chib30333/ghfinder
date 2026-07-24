import type { Stats } from '@/types';
import { apiClient } from './api/client';

interface StatsRow {
  cities_total: number;
  cities_done: number;
  cities_active: number;
  cities_pending: number;
  seg_total: number;
  users_total: number;
  users_with_email: number;
  users_with_social: number;
}

export async function fetchStats(): Promise<Stats> {
  const r = await apiClient<StatsRow>('/api/stats');
  return {
    citiesTotal: r.cities_total ?? 0,
    citiesDone: r.cities_done ?? 0,
    citiesActive: r.cities_active ?? 0,
    citiesPending: r.cities_pending ?? 0,
    segmentsTotal: r.seg_total ?? 0,
    usersTotal: r.users_total ?? 0,
    usersWithEmail: r.users_with_email ?? 0,
    usersWithSocial: r.users_with_social ?? 0,
  };
}
