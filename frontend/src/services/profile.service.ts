import type { AuthUser, Profile } from '@/types';


const PROFILE_KEY = 'ghfinder.profile.v1';

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function emptyProfile(user?: AuthUser | null): Profile {
  return {
    name: user?.name ?? '',
    fullName: user?.name ?? '',
    email: user?.email ?? '',
    phone: '',
    location: '',
    company: '',
    website: '',
    bio: '',
    avatar: null,
  };
}

export function loadProfile(user: AuthUser | null): Profile {
  const base = emptyProfile(user);
  if (!hasStorage()) return base;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return base;
    const stored = JSON.parse(raw) as Partial<Profile>;
    return { ...base, ...stored };
  } catch {
    return base;
  }
}

export function saveProfile(profile: Profile): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
  }
}
