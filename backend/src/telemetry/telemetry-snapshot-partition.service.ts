import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const TABLE = 'raw_telemetry_snapshots';
// Current + previous month kept; anything older is dropped wholesale. Next
// month's partition is pre-created too, since Postgres has no default
// catch-all partition — an insert with no matching partition just fails.
const RETENTION_MONTHS = 1;

function partitionName(year: number, month: number): string {
  return `${TABLE}_${year}_${String(month + 1).padStart(2, '0')}`;
}

function monthBounds(year: number, month: number): [string, string] {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function addMonths(
  year: number,
  month: number,
  delta: number,
): [number, number] {
  const total = year * 12 + month + delta;
  return [Math.floor(total / 12), ((total % 12) + 12) % 12];
}

// Manages raw_telemetry_snapshots' monthly RANGE partitions via raw SQL —
// TypeORM's `synchronize` has no concept of declarative partitioning (see
// the entity's own comment), so this is deliberately outside the ORM's
// schema-sync path, the same way the historical backfill and one-off
// Project row were manual SQL rather than a formal migration (no migration
// tooling exists in this project yet).
@Injectable()
export class TelemetrySnapshotPartitionService {
  private readonly logger = new Logger(TelemetrySnapshotPartitionService.name);

  constructor(private readonly dataSource: DataSource) {}

  async ensureUpcomingPartitionsExist(): Promise<void> {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    for (const [y, m] of [[year, month], addMonths(year, month, 1)] as const) {
      const name = partitionName(y, m);
      const [from, to] = monthBounds(y, m);
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS "${name}" PARTITION OF "${TABLE}" FOR VALUES FROM ('${from}') TO ('${to}')`,
      );
    }
  }

  async dropExpiredPartitions(): Promise<void> {
    const now = new Date();
    const [y, m] = addMonths(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      -(RETENTION_MONTHS + 1),
    );
    const name = partitionName(y, m);
    await this.dataSource.query(`DROP TABLE IF EXISTS "${name}"`);
    this.logger.log(
      `Dropped expired raw snapshot partition (if present): ${name}`,
    );
  }
}
