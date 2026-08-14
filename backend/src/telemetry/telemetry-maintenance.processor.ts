import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { TelemetrySnapshotPartitionService } from './telemetry-snapshot-partition.service';
import {
  MAINTENANCE_INTERVAL_MS,
  TELEMETRY_MAINTENANCE_JOB_ID,
  TELEMETRY_MAINTENANCE_QUEUE,
} from './telemetry-maintenance.queue';

// Daily housekeeping for raw_telemetry_snapshots' partitions — separate
// cadence and concern from the 5-minute metrics rollup, so it's a separate
// queue rather than piggybacking on that one.
@Processor(TELEMETRY_MAINTENANCE_QUEUE)
export class TelemetryMaintenanceProcessor
  extends WorkerHost
  implements OnModuleInit
{
  constructor(
    @InjectQueue(TELEMETRY_MAINTENANCE_QUEUE)
    private readonly queue: Queue,
    private readonly partitions: TelemetrySnapshotPartitionService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(TELEMETRY_MAINTENANCE_JOB_ID, {
      every: MAINTENANCE_INTERVAL_MS,
    });
  }

  async process(_job: Job): Promise<void> {
    await this.partitions.ensureUpcomingPartitionsExist();
    await this.partitions.dropExpiredPartitions();
  }
}
