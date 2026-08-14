import { createHash } from 'crypto';

// Opaque per-visitor id for HyperLogLog (external_data.md section 2 — HLL and this
// hash are one unit of work, HLL needs something opaque to add).
// SHA256(ip + UA + daily-rotating-salt): the salt itself is
// SHA256(secret + date), so the same IP+UA on the same day always collapses
// to the same id (what PFADD needs to dedupe a visitor across their
// session's several POSTs), but rotates the next day so the hash can't be
// used to link the same visitor across days even by someone holding the
// secret. Raw IP is never persisted anywhere — see the removed column note
// on TelemetrySnapshot.
export function hashVisitor(
  secret: string,
  ip: string,
  userAgent: string,
  date: string,
): string {
  const dailySalt = createHash('sha256')
    .update(`${secret}:${date}`)
    .digest('hex');
  return createHash('sha256')
    .update(`${ip}:${userAgent}:${dailySalt}`)
    .digest('hex');
}
