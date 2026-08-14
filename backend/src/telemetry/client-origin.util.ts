import type { Request } from 'express';

// POST always includes Origin per the fetch spec (unlike GET/HEAD, where
// it's cross-origin-only) — sendBeacon and the fetch fallback both send it.
// Referer is a fallback for anything unusual enough not to, trimmed down to
// just the origin so it compares the same way.
export function getRequestOrigin(req: Request): string | null {
  const origin = req.get('origin');
  if (origin) return origin;

  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
