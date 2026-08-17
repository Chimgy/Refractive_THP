const API_BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

// Simpler than frontend/src/api/client.ts on purpose: no bearer token, no
// 401-refresh-retry loop. Auth here is Cloudflare Access, which attaches its
// own signed JWT via a header on every request before it ever reaches
// internal-backend (CloudflareAccessGuard) — there is no client-side session
// to manage or refresh.
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
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

  if (res.status === 202 || res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
