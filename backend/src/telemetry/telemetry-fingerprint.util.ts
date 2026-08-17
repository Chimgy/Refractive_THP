import { createHash } from 'crypto';

// Shared by TelemetryErrorsService (upserts telemetry_error_fingerprints)
// and TelemetrySnapshotsService (tags raw_telemetry_snapshots with the same
// hash for correlation) — both run in parallel off the same ingest payload
// in telemetry-ingest.processor.ts, so they must produce identical hashes
// for the same error event.
export function fingerprint(
  message: string,
  file: string | null,
  line: number | null,
  col: number | null,
): string {
  return createHash('sha256')
    .update(`${message}:${file ?? ''}:${line ?? ''}:${col ?? ''}`)
    .digest('hex');
}
