import type { AuthView, Screen } from '@/types';

export const SCREEN_PATH: Record<Screen, string> = {
  dashboard: '/dashboard',
  discovery: '/discovery',
  countries: '/countries',
  cities: '/cities',
  leads: '/leads',
  campaigns: '/campaigns',
  accounts: '/accounts',
  exports: '/exports',
  settings: '/settings',
  profile: '/account',
};

export const AUTH_PATH: Record<AuthView, string> = {
  signin: '/login',
  signup: '/signup',
  forgot: '/forgot-password',
  sent: '/reset-sent',
  reset: '/reset-password',
};

export const HOME_PATH = SCREEN_PATH.dashboard;
export const LOGIN_PATH = AUTH_PATH.signin;

function invert<K extends string>(map: Record<K, string>): Record<string, K> {
  return Object.fromEntries((Object.entries(map) as [K, string][]).map(([k, p]) => [p, k]));
}

const PATH_SCREEN = invert(SCREEN_PATH);
const PATH_AUTH = invert(AUTH_PATH);

const norm = (path: string) => (path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path);

export function screenFor(path: string): Screen | undefined {
  return PATH_SCREEN[norm(path)];
}

export function authViewFor(path: string): AuthView | undefined {
  return PATH_AUTH[norm(path)];
}

export function redirectFor(path: string, authed: boolean): string | null {
  if (authed) return screenFor(path) ? null : HOME_PATH;
  return authViewFor(path) ? null : LOGIN_PATH;
}
