export const TELEMETRY_INGEST_QUEUE = 'telemetry-ingest';

// Everything the processor needs to run the six-way write fan-out, captured
// at request time — ip/country/userAgent are request-scoped (headers), not
// something a queued job can go back and re-read once the request has ended.
export interface TelemetryIngestJobData {
  payload: Record<string, unknown>;
  projectId: string;
  userAgent: string | null;
  ip: string;
  country: string | null;
}
