import type { Request } from 'express';

// `req.ip` — Express's own X-Forwarded-For resolution, hop-aware via
// `app.set('trust proxy', 1)` in main.ts. With exactly one trusted reverse
// proxy in front (Cloudflare's edge, whether via Tunnel or classic proxied
// DNS), this resolves to the address that edge appended, not anything the
// client itself can set — same trust reasoning as `CF-IPCountry` in
// client-geo.util.ts, but via a standard header instead of a
// Cloudflare-specific one, so it keeps working unmodified if this ever
// moves behind CloudFront+ALB instead (bump the trust-proxy hop count to
// 2 at that point). Falls back to the raw socket peer for local dev
// without any proxy in front.
export function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
