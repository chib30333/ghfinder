import type { AuthSession, AuthUser } from '@/types';


const USERS_KEY = 'ghfinder.users.v1';
const SESSION_KEY = 'ghfinder.session.v1';
const REMEMBER_TTL = 1000 * 60 * 60 * 24 * 30;
const SESSION_TTL = 1000 * 60 * 60 * 12;
const LATENCY_MS = 420;

export const INVALID_CREDENTIALS = 'Invalid email or password.';

export class AuthError extends Error {
  readonly field?: 'email' | 'password';
  constructor(message: string, field?: 'email' | 'password') {
    super(message);
    this.name = 'AuthError';
    this.field = field;
  }
}

interface StoredUser extends AuthUser {
  hash: string;
}

function demoHash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = (((h << 5) + h) ^ value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const SEED_USERS: StoredUser[] = [
  { name: 'Alex Operator', email: 'operator@ghfinder.io', hash: demoHash('ghfinder') },
];

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

function loadUsers(): StoredUser[] {
  const byEmail = new Map<string, StoredUser>();
  for (const u of SEED_USERS) byEmail.set(normEmail(u.email), u);
  if (hasStorage()) {
    try {
      const raw = window.localStorage.getItem(USERS_KEY);
      const stored = raw ? (JSON.parse(raw) as StoredUser[]) : [];
      for (const u of stored) {
        if (u?.email && u?.hash) byEmail.set(normEmail(u.email), u);
      }
    } catch {
    }
  }
  return [...byEmail.values()];
}

function saveUser(user: StoredUser): void {
  if (!hasStorage()) return;
  const seedEmails = new Set(SEED_USERS.map((u) => normEmail(u.email)));
  const custom = loadUsers().filter(
    (u) => !seedEmails.has(normEmail(u.email)) && normEmail(u.email) !== normEmail(user.email),
  );
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify([...custom, user]));
  } catch {
  }
}

export function loadSession(): AuthSession | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session?.user?.email || typeof session.expiresAt !== 'number') return null;
    if (session.expiresAt <= Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function updateSessionUser(changes: Partial<AuthUser>): void {
  if (!hasStorage()) return;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as AuthSession;
    session.user = { ...session.user, ...changes };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
  }
}

export function clearSession(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
  }
}

function startSession(user: AuthUser, remember: boolean): AuthSession {
  const session: AuthSession = {
    user,
    token: demoHash(`${user.email}:${Date.now()}`),
    expiresAt: Date.now() + (remember ? REMEMBER_TTL : SESSION_TTL),
  };
  if (hasStorage()) {
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
    }
  }
  return session;
}

function settle<T>(produce: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(produce());
      } catch (err) {
        reject(err);
      }
    }, LATENCY_MS);
  });
}

export function signIn(email: string, password: string, remember = true): Promise<AuthSession> {
  return settle(() => {
    const user = loadUsers().find((u) => normEmail(u.email) === normEmail(email));
    if (!user || user.hash !== demoHash(password)) throw new AuthError(INVALID_CREDENTIALS);
    return startSession({ name: user.name, email: user.email }, remember);
  });
}

export function signUp(name: string, email: string, password: string): Promise<AuthSession> {
  return settle(() => {
    const taken = loadUsers().some((u) => normEmail(u.email) === normEmail(email));
    if (taken) throw new AuthError('An account with this email already exists.', 'email');
    const user: StoredUser = { name: name.trim(), email: email.trim(), hash: demoHash(password) };
    saveUser(user);
    return startSession({ name: user.name, email: user.email }, true);
  });
}

export function requestPasswordReset(_email: string): Promise<void> {
  return settle(() => undefined);
}

export function completePasswordReset(email: string, password: string): Promise<void> {
  return settle(() => {
    const user = loadUsers().find((u) => normEmail(u.email) === normEmail(email));
    // Demo flow: the reset is keyed off the email captured in the forgot step.
    // Rewrite the account's password hash if it exists; stay silent otherwise
    // so we never reveal whether an address is registered.
    if (user) saveUser({ name: user.name, email: user.email, hash: demoHash(password) });
  });
}

export function changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  return settle(() => {
    const user = loadUsers().find((u) => normEmail(u.email) === normEmail(email));
    // The caller is authenticated, so re-verify the current password before
    // rewriting the hash — a wrong one is the only failure surfaced.
    if (!user || user.hash !== demoHash(currentPassword)) {
      throw new AuthError('Current password is incorrect.');
    }
    saveUser({ name: user.name, email: user.email, hash: demoHash(newPassword) });
  });
}

export function signInWithGoogle(): Promise<AuthSession> {
  return settle(() => startSession({ name: 'Alex Operator', email: 'operator@ghfinder.io' }, true));
}
