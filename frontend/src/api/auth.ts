import { request } from './client';

export type UserRole = 'admin' | 'member';

// Shape returned inline by /auth/login and /auth/register.
export type SafeUser = {
  id: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyName: string | null;
  displayName: string | null;
  isActive: boolean;
};

// Shape returned by /auth/me — the JWT-validated user (see JwtStrategy),
// plus companyName looked up server-side from the companies table.
export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyName: string | null;
  displayName: string | null;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
};

export function login(email: string, password: string): Promise<AuthResult> {
  return request<AuthResult>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function register(payload: {
  companyName: string;
  displayName: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  return request<AuthResult>('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function me(): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/me');
}
