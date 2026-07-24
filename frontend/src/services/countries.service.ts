import { apiClient } from './api/client';

export type QueryMode = 'city' | 'city-state';

export interface Region {
  id: string;
  label: string;
}
export interface Country {
  code: string;
  name: string;
  region: string;
  // Real loaded count once the country's cities are in the work list, else the
  // curated/CSV preview size.
  cityCount: number;
  // Raw number of this country's cities currently in the work list (0 = none loaded).
  loaded?: number;
}
export interface CountriesResponse {
  regions: Region[];
  countries: Country[];
}

export interface LoadCountryResult {
  inserted: number;
  total: number;
  country: string;
  queryMode: QueryMode;
  // Present only on the "all cities" load: which list was actually seeded —
  // 'remote'/'gazetteer' = full list, 'curated' = fell back to the major hubs.
  source?: 'remote' | 'gazetteer' | 'curated';
}

export function fetchCountries(): Promise<CountriesResponse> {
  return apiClient<CountriesResponse>('/api/countries');
}

export function loadCountryCities(code: string, queryMode: QueryMode): Promise<LoadCountryResult> {
  return apiClient<LoadCountryResult>('/api/cities/load-country', {
    method: 'POST',
    body: JSON.stringify({ code, queryMode }),
  });
}

// Seed EVERY city of the country (full remote gazetteer), not just the curated
// hubs — backs the "Search all cities" button.
export function loadAllCountryCities(code: string, queryMode: QueryMode): Promise<LoadCountryResult> {
  return apiClient<LoadCountryResult>('/api/cities/load-country-all', {
    method: 'POST',
    body: JSON.stringify({ code, queryMode }),
  });
}
