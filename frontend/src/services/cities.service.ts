import type { City } from '@/types';
import { timeAgo } from '@/lib/format';
import { apiClient, qs } from './api/client';

interface CityRow {
  id: number;
  city: string;
  state: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
  updated_at: string | null;
  leads_found: number;
}
interface CitiesResponse {
  rows: CityRow[];
  total: number;
  limit: number;
  offset: number;
}

function mapCity(c: CityRow): City {
  return {
    id: c.id,
    city: c.city,
    state: c.state,
    status: c.status,
    found: c.leads_found ?? 0,
    updated: timeAgo(c.updated_at),
  };
}

export async function fetchCities(
  opts: { status?: string; state?: string; limit?: number } = {},
): Promise<City[]> {
  const res = await apiClient<CitiesResponse>(
    `/api/cities${qs({ status: opts.status, state: opts.state, limit: opts.limit ?? 100 })}`,
  );
  return (res.rows ?? []).map(mapCity);
}

export async function fetchCrawledCities(limit = 120): Promise<City[]> {
  const [active, done] = await Promise.all([
    fetchCities({ status: 'active', limit: 20 }),
    fetchCities({ status: 'done', limit }),
  ]);
  const doneSorted = done.slice().sort((a, b) => b.found - a.found);
  return [...active, ...doneSorted];
}

export interface CountryCities {
  cities: City[];
  total: number;
}

export interface CountryCitiesQuery {
  limit?: number;
  offset?: number;
  search?: string;
}

// One page of the cities seeded for a country, regardless of crawl status —
// used by the Discovery page after a country load. Rows come back in the
// crawler's own work order (city id), so groups are stable across pages and the
// operator can crawl one group of 100, then advance to the next. `total` is the
// full count for that country (e.g. the US spans ~29.8k rows) so the table can
// page through server-side without ever loading everything at once.
export async function fetchCitiesByCountry(
  country: string,
  { limit = 100, offset = 0, search }: CountryCitiesQuery = {},
): Promise<CountryCities> {
  const res = await apiClient<CitiesResponse>(
    `/api/cities${qs({ country, limit, offset, search: search?.trim() || undefined })}`,
  );
  return { cities: (res.rows ?? []).map(mapCity), total: res.total ?? 0 };
}

export interface LoadCitiesResult {
  inserted: number;
  queryMode: 'city' | 'city-state';
}

export function loadCities(queryMode: 'city' | 'city-state'): Promise<LoadCitiesResult> {
  return apiClient<LoadCitiesResult>('/api/cities/load', {
    method: 'POST',
    body: JSON.stringify({ queryMode }),
  });
}

// Mark a city skipped: it drops out of the crawl work list and, if it's the one
// currently being crawled, the crawler aborts it and advances to the next city.
export function skipCity(id: number): Promise<{ skipped: boolean; id: number }> {
  return apiClient<{ skipped: boolean; id: number }>(`/api/cities/${id}/skip`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export type CityStatus = 'pending' | 'active' | 'done' | 'skipped';

// Set a city's crawl status directly (Done / Active / Skip / Pending) from the
// cities table. 'skipped' behaves like skipCity above; 'done'/'active' override
// the crawl state; 'pending' returns the city to the work list.
export function setCityStatus(
  id: number,
  status: CityStatus,
): Promise<{ updated: boolean; id: number; status: CityStatus }> {
  return apiClient<{ updated: boolean; id: number; status: CityStatus }>(`/api/cities/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export function listEnrichmentOptions(): string[] {
  return [
    'Scan README for email',
    'Scan recent commits for email',
    'Extract Telegram links',
    'Extract Discord links',
  ];
}
