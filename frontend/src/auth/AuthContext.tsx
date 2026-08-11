import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { ApiError, refreshSession } from '../api/client';
import { clearTokens, getTokens, setTokens } from './tokenStore';

export type SessionUser = {
  id: string;
  email: string;
  role: authApi.UserRole;
  companyId: string;
  displayName: string | null;
};

type Status = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: Status;
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { companyName: string; displayName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function fromSafeUser(user: authApi.SafeUser): SessionUser {
  return { id: user.id, email: user.email, role: user.role, companyId: user.companyId, displayName: user.displayName };
}

function fromAuthenticatedUser(user: authApi.AuthenticatedUser): SessionUser {
  return { id: user.userId, email: user.email, role: user.role, companyId: user.companyId, displayName: user.displayName };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // A stored refresh token from a previous session — silently re-auth
    // before rendering anything that assumes we know who's signed in. The
    // access token never survives a reload (memory-only), so go straight to
    // refreshSession() instead of calling /auth/me first and watching it 401.
    const { refreshToken } = getTokens();
    if (!refreshToken) {
      setStatus('unauthenticated');
      return;
    }
    refreshSession()
      .then((accessToken) => {
        if (!accessToken) throw new Error('refresh failed');
        return authApi.me();
      })
      .then((me) => {
        setUser(fromAuthenticatedUser(me));
        setStatus('authenticated');
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setStatus('unauthenticated');
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(email, password) {
        const result = await authApi.login(email, password);
        setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
        setUser(fromSafeUser(result.user));
        setStatus('authenticated');
      },
      async register(payload) {
        const result = await authApi.register(payload);
        setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
        setUser(fromSafeUser(result.user));
        setStatus('authenticated');
      },
      async logout() {
        const { refreshToken } = getTokens();
        if (refreshToken) {
          await authApi.logout(refreshToken).catch(() => undefined);
        }
        clearTokens();
        setUser(null);
        setStatus('unauthenticated');
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function authErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
