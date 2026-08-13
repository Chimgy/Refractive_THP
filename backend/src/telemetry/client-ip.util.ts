import type { Request } from 'express';

// Prefer the header Cloudflare's edge sets from the actual TCP connection it
// terminated (`CF-Connecting-IP`) — not spoofable by the client, since
// Cloudflare overwrites it on the way in, same trust reasoning as
// `CF-IPCountry` elsewhere in this doc. Deliberately no `X-Forwarded-For`
// fallback: its value/order is client-controllable unless Express's
// `trust proxy` is set to strip untrusted hops, which it isn't here. Falls
// back to the raw socket peer for local dev without the tunnel in front.
export function getClientIp(req: Request): string {
  return req.get('cf-connecting-ip') ?? req.socket.remoteAddress ?? 'unknown';
}
