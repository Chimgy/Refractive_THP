import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity';
import { RawTelemetrySnapshot } from './entities/raw-telemetry-snapshot.entity';
import { TelemetryErrorFingerprint } from './entities/telemetry-error-fingerprint.entity';
import { TelemetryMetric } from './entities/telemetry-metric.entity';
import { TELEMETRY_INGEST_QUEUE } from './telemetry-ingest.queue';
import { TelemetryIngestProcessor } from './telemetry-ingest.processor';
import { TELEMETRY_MAINTENANCE_QUEUE } from './telemetry-maintenance.queue';
import { TelemetryMaintenanceProcessor } from './telemetry-maintenance.processor';
import { TELEMETRY_ROLLUP_QUEUE } from './telemetry-rollup.queue';
import { TelemetryRollupProcessor } from './telemetry-rollup.processor';
import { TelemetryAggregationService } from './telemetry-aggregation.service';
import { TelemetryOriginGuardService } from './telemetry-origin-guard.service';
import { TelemetryRateLimitService } from './telemetry-rate-limit.service';
import { TelemetrySnapshotPartitionService } from './telemetry-snapshot-partition.service';
import { TelemetryController } from './telemetry.controller';
import { TelemetryErrorsService } from './telemetry-errors.service';
import { TelemetryMetricsQueryService } from './telemetry-metrics-query.service';
import { TelemetrySnapshotsService } from './telemetry-snapshots.service';
import { TelemetryUniquesService } from './telemetry-uniques.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RawTelemetrySnapshot,
      TelemetryErrorFingerprint,
      TelemetryMetric,
      // Only for TelemetryOriginGuardService's and TelemetryRollupProcessor's
      // own repository lookups — this module does NOT import ProjectsModule
      // (which imports TelemetryModule for TelemetryUniquesService;
      // importing back would be circular).
      Project,
    ]),
    BullModule.registerQueue({
      name: TELEMETRY_INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        // Bounded history, same "don't accumulate forever" instinct as the
        // Redis counter TTLs — completed jobs kept an hour (enough to eyeball
        // recent throughput), failed jobs a day (enough to triage before
        // they're gone).
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    }),
    BullModule.registerQueue({
      name: TELEMETRY_ROLLUP_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    }),
    BullModule.registerQueue({
      name: TELEMETRY_MAINTENANCE_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    }),
  ],
  controllers: [TelemetryController],
  providers: [
    TelemetrySnapshotsService,
    TelemetryAggregationService,
    TelemetryUniquesService,
    TelemetryErrorsService,
    TelemetryMetricsQueryService,
    TelemetryOriginGuardService,
    TelemetryRateLimitService,
    TelemetrySnapshotPartitionService,
    TelemetryIngestProcessor,
    TelemetryRollupProcessor,
    TelemetryMaintenanceProcessor,
  ],
  exports: [TelemetryUniquesService, TelemetryMetricsQueryService],
})
export class TelemetryModule {}
