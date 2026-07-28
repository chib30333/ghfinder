import { apiClient } from './api/client';

/** One GitHub rate-limit window (core, search, or graphql). */
export interface RateWindow {
  limit: number;
  remaining: number;
  used: number;
  /** Unix seconds at which the window rolls over. */
  reset: number;
}

export interface RateLimit {
  ok: boolean;
  /** Present only when ok is false: 'bad_token' | 'unreachable' | 'http_<n>'. */
  reason?: string;
  core: RateWindow | null;
  search: RateWindow | null;
  graphql: RateWindow | null;
  /** Epoch ms the server took the snapshot. */
  checkedAt: number;
}

export const EMPTY_RATE_LIMIT: RateLimit = {
  ok: false,
  core: null,
  search: null,
  graphql: null,
  checkedAt: 0,
};

export function fetchRateLimit(): Promise<RateLimit> {
  return apiClient<RateLimit>('/api/rate-limit');
}

/** Human reason for the meter's degraded states. */
export function rateLimitReason(reason: string | undefined): string {
  if (reason === 'bad_token') return 'GITHUB_TOKEN is invalid, expired, or revoked.';
  if (reason === 'unreachable') return 'Could not reach api.github.com.';
  if (reason?.startsWith('http_')) return `GitHub answered HTTP ${reason.slice(5)}.`;
  return 'Rate limit unavailable.';
}
