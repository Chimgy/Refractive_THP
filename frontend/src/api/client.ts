import { clearTokens, getTokens, setTokens } from '../auth/tokenStore';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
};

async function rawRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { accessToken } = getTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include', // sends the httpOnly refresh cookie automatically
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message = payload?.message ?? res.statusText;
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : message,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Exchanges the httpOnly refresh cookie for a fresh access token. Logs the
// session out locally if the refresh token itself has expired or been revoked.
//
// Refresh tokens rotate on use, so two concurrent callers (React StrictMode's
// double-invoked effects in dev, two 401s firing at once) must not each fire
// their own /auth/refresh: the second one would present an already-rotated
// token, get rejected, and clear the perfectly good session the first call
// just established. Sharing one in-flight promise makes every concurrent
// caller await the same result. (True multi-tab races are a known, accepted
// gap — each tab has its own module state.)
let refreshPromise: Promise<string | null> | null = null;

export function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<string | null> {
  try {
    const result = await rawRequest<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
    });
    setTokens({ accessToken: result.accessToken });
    return result.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

// One 401 retry after a silent refresh — covers an access token that expired
// mid-session. /auth/refresh itself never retries, to avoid looping.
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    const isAuthPath =
      path === '/auth/refresh' ||
      path === '/auth/login' ||
      path === '/auth/register';
    if (err instanceof ApiError && err.status === 401 && !isAuthPath) {
      const refreshed = await refreshSession();
      if (refreshed) return rawRequest<T>(path, options);
    }
    throw err;
  }
}
