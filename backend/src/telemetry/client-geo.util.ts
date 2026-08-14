import type { Request } from 'express';

// Cloudflare's edge resolves this from the same terminated TCP connection as
// `CF-Connecting-IP` — same trust reasoning: the client can't set or spoof
// it, Cloudflare overwrites it on the way in. Two-letter ISO 3166-1 alpha-2
// code, "T1" for Tor exit nodes, "XX" when Cloudflare couldn't resolve one.
// Cloudflare-specific: this is null for any request not passing through
// Cloudflare's edge (local dev without the tunnel, or a future non-CF
// front end — see project-plan.md section 3, CloudFront has an equivalent header).
export function getClientCountry(req: Request): string | null {
  return req.get('cf-ipcountry') || null;
}
