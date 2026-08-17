import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '../api/auth';
import { ApiError, refreshSession } from '../api/client';
import { trackEvent } from '../api/usageAnalytics';
import { clearTokens, setTokens } from './tokenStore';

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
  register: (payload: {
    companyName: string;
    displayName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function fromSafeUser(user: authApi.SafeUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    displayName: user.displayName,
  };
}

function fromAuthenticatedUser(user: authApi.AuthenticatedUser): SessionUser {
  return {
    id: user.userId,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    displayName: user.displayName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // The refresh token lives in an httpOnly cookie now — invisible to JS,
    // so there's no client-side way to check "is there a session" before
    // trying. Always attempt a silent refresh on mount and treat failure
    // (no cookie, or an expired/revoked one) as unauthenticated.
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
        setTokens({ accessToken: result.accessToken });
        setUser(fromSafeUser(result.user));
        setStatus('authenticated');
        trackEvent('login', 'auth.login');
      },
      async register(payload) {
        const result = await authApi.register(payload);
        setTokens({ accessToken: result.accessToken });
        setUser(fromSafeUser(result.user));
        setStatus('authenticated');
        trackEvent('login', 'auth.register');
      },
      async logout() {
        // Fired before clearTokens() below — trackEvent reads the current
        // access token synchronously at call time, so ordering here matters:
        // once clearTokens() runs, a subsequent call would go out
        // unauthenticated and get silently dropped (401, swallowed).
        trackEvent('logout', 'auth.logout');
        await authApi.logout().catch(() => undefined);
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
