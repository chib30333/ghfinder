export interface AuthUser {
  name: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: number;
}
