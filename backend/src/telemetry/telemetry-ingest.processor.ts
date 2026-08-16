import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  TELEMETRY_INGEST_QUEUE,
  TelemetryIngestJobData,
} from './telemetry-ingest.queue';
import { TelemetryAggregationService } from './telemetry-aggregation.service';
import { TelemetryErrorsService } from './telemetry-errors.service';
import { TelemetrySnapshotsService } from './telemetry-snapshots.service';
import { TelemetryUniquesService } from './telemetry-uniques.service';

// The actual write fan-out, moved off the request path (this is item 5 —
// external_data.md section 2/6). The controller now only validates and
// enqueues; this is where the raw snapshot, error fingerprints, unique
// visitor, and Redis-native aggregate writes actually land, on whatever
// schedule BullMQ's worker gets to it. There's no per-event Postgres table
// anymore (see the aggregation-layer redesign in external_data.md) —
// TelemetryRollupProcessor reads what TelemetryAggregationService writes
// here and turns it into summary rows on its own 5-minute cadence.
//
// Per-destination failures are still isolated via allSettled + logging (the
// stopgap fix from the audit), but now failure also throws at the end so
// BullMQ retries the *whole job* with backoff. That's a real, known
// trade-off, not an oversight: a retry re-runs every destination, including
// ones that already succeeded — Postgres inserts duplicate a row, Redis
// counters/error counts over-count. Accepted for now because it's the same
// category of "duplicate-tolerant, collapsed at read time" design already
// used for session_end's repeated tab-hide fires (external_data.md section 1)
// — and because true per-destination retry would mean splitting this into
// six separate queues, which isn't worth it without real failure data to
// justify it.
//
// concurrency defaults to 1 in BullMQ if not set here — confirmed the hard
// way: a 125-request burst left 80 jobs sitting in `wait` with only one
// `active` at a time. Each job is lightweight I/O (a couple Postgres
// writes, a few Redis commands), so processing them one-at-a-time is pure
// self-inflicted latency, not a resource limit. 10 is a first guess (same
// "no real load to size it against" caveat as the rate limit), matched to
// the DB/Redis connection pools comfortably absorbing that many concurrent
// jobs without needing their own tuning yet.
@Processor(TELEMETRY_INGEST_QUEUE, { concurrency: 10 })
export class TelemetryIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(TelemetryIngestProcessor.name);

  constructor(
    private readonly snapshots: TelemetrySnapshotsService,
    private readonly aggregation: TelemetryAggregationService,
    private readonly uniques: TelemetryUniquesService,
    private readonly errors: TelemetryErrorsService,
  ) {
    super();
  }

  async process(job: Job<TelemetryIngestJobData>): Promise<void> {
    const { payload, projectId, userAgent, ip, country } = job.data;

    const destinations: [string, Promise<void>][] = [
      ['snapshots', this.snapshots.capture(payload, { projectId, userAgent })],
      [
        'aggregation',
        this.aggregation.recordBatch(payload, { projectId, country }),
      ],
      ['uniques', this.uniques.recordVisit({ projectId, ip, userAgent })],
      ['errors', this.errors.recordBatch(payload, { projectId })],
      ['country', this.aggregation.recordCountry({ projectId, country })],
    ];

    const results = await Promise.allSettled(destinations.map(([, p]) => p));
    let anyFailed = false;
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        anyFailed = true;
        this.logger.error(
          `Telemetry write failed for destination "${destinations[i][0]}" (projectId=${projectId}, jobId=${job.id}, attempt=${job.attemptsMade + 1}): ${String(result.reason)}`,
        );
      }
    });

    if (anyFailed) {
      throw new Error(
        `Telemetry ingest job ${job.id} had at least one failed destination — see logged errors above`,
      );
    }
  }
}
