import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IsNull, Repository } from 'typeorm';
import { CustomerDbReadService } from '../customer-db/customer-db-read.service';
import { DailyActiveUserLog } from './entities/daily-active-user-log.entity';
import {
  KeyCount,
  UsageMetricsDaily,
} from './entities/usage-metrics-daily.entity';
import { IngestionWatermarkService } from './ingestion-watermark.service';

const JOB_NAME = 'usage-events-pull';

type UsageEventRow = {
  companyId: string;
  userId: string;
  eventType: string;
  createdAt: Date;
};

// Hourly pull of customerDB's usage_events into daily_active_user_log — the
// DAU/WAU/MAU source of truth (plan §"Key decisions" items 2, 9). Only ever
// consumes [lastPulledAt, cutoff) where cutoff is floored to the start of
// the current UTC hour, never up to `now()` — otherwise a still-filling
// hour would be partially, non-reproducibly consumed.
@Injectable()
export class UsageEventsPullJob {
  private readonly logger = new Logger(UsageEventsPullJob.name);

  constructor(
    private readonly customerDb: CustomerDbReadService,
    private readonly watermark: IngestionWatermarkService,
    @InjectRepository(DailyActiveUserLog)
    private readonly dailyActiveUserLogRepository: Repository<DailyActiveUserLog>,
    @InjectRepository(UsageMetricsDaily)
    private readonly usageMetricsDailyRepository: Repository<UsageMetricsDaily>,
  ) {}

  // Public + no-arg so it's directly callable from IngestionController's
  // manual-trigger endpoint (dev/verification use — plan §"Build order"
  // Phase 1 step 8: trigger twice against the same hour, confirm the second
  // run is a no-op via the ON CONFLICT DO NOTHING below).
  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const cutoff = floorToHour(new Date());
    const since = await this.watermark.getLastPulledAt(
      JOB_NAME,
      new Date(cutoff.getTime() - 60 * 60 * 1000),
    );

    if (since >= cutoff) {
      this.logger.log(
        `${JOB_NAME}: watermark already at cutoff, nothing to do`,
      );
      return;
    }

    this.logger.log(
      `${JOB_NAME}: pulling [${since.toISOString()}, ${cutoff.toISOString()})`,
    );

    let events: UsageEventRow[];
    try {
      const result = await this.customerDb.query<UsageEventRow>(
        `SELECT "companyId", "userId", "eventType", "createdAt" FROM usage_events WHERE "createdAt" >= $1 AND "createdAt" < $2`,
        [since, cutoff],
      );
      events = result.rows;
    } catch (err) {
      // Watermark deliberately NOT advanced on failure — next run retries
      // the same window instead of silently skipping it.
      this.logger.error(
        `${JOB_NAME}: pull from customerDB failed, watermark not advanced`,
        err instanceof Error ? err.stack : String(err),
      );
      return;
    }

    // Dedupe to one row per (day, companyId, userId), keeping the earliest
    // createdAt seen — the insert below relies on this being pre-deduped
    // since a single VALUES list can't ON CONFLICT against itself.
    const byUserDay = new Map<
      string,
      { day: string; companyId: string; userId: string; firstEventAt: Date }
    >();
    // Platform-wide event-type tally, bucketed by day (a pull window can
    // straddle a UTC midnight) — the only breakdown actually populated in
    // usage_metrics_daily today (plan §"Build order" Phase 2 note: real
    // feature/workflow breakdowns wait for real call sites; this is just
    // counting the event types that already exist).
    const eventTypeCountsByDay = new Map<string, Map<string, number>>();
    for (const event of events) {
      const day = toUtcDateString(event.createdAt);
      const key = `${day}:${event.companyId}:${event.userId}`;
      const existing = byUserDay.get(key);
      if (!existing || event.createdAt < existing.firstEventAt) {
        byUserDay.set(key, {
          day,
          companyId: event.companyId,
          userId: event.userId,
          firstEventAt: event.createdAt,
        });
      }

      const dayCounts =
        eventTypeCountsByDay.get(day) ?? new Map<string, number>();
      dayCounts.set(event.eventType, (dayCounts.get(event.eventType) ?? 0) + 1);
      eventTypeCountsByDay.set(day, dayCounts);
    }

    const rows = Array.from(byUserDay.values());
    if (rows.length > 0) {
      await this.dailyActiveUserLogRepository
        .createQueryBuilder()
        .insert()
        .into(DailyActiveUserLog)
        .values(rows)
        .orIgnore()
        .execute();
    }

    for (const [day, dayCounts] of eventTypeCountsByDay) {
      await this.mergeEventTypeCounts(day, dayCounts);
    }

    await this.watermark.advance(JOB_NAME, cutoff);
    this.logger.log(
      `${JOB_NAME}: pulled ${events.length} events, ${rows.length} distinct user-days, watermark advanced to ${cutoff.toISOString()}`,
    );
  }

  // Read-modify-write against the platform-wide (companyId IS NULL) row for
  // `day` — safe because this job only ever runs one instance at a time
  // (single cron/manual trigger, never concurrent), same assumption the
  // rest of this pipeline already makes.
  private async mergeEventTypeCounts(
    day: string,
    newCounts: Map<string, number>,
  ): Promise<void> {
    const existing = await this.usageMetricsDailyRepository.findOne({
      where: { periodStart: day, companyId: IsNull() },
    });

    const merged = new Map<string, number>(
      (existing?.eventTypeCounts ?? []).map((row) => [row.key, row.count]),
    );
    let addedThisRun = 0;
    for (const [eventType, count] of newCounts) {
      merged.set(eventType, (merged.get(eventType) ?? 0) + count);
      addedThisRun += count;
    }

    const eventTypeCounts: KeyCount[] = Array.from(merged.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
    const totalEvents = (existing?.totalEvents ?? 0) + addedThisRun;

    const dau = await this.dailyActiveUserLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.userId)', 'count')
      .where('log.day = :day', { day })
      .getRawOne<{ count: string }>();
    const dauCount = Number(dau?.count ?? 0);
    const actionsPerUser =
      dauCount > 0 ? (totalEvents / dauCount).toFixed(2) : null;

    await this.usageMetricsDailyRepository.save({
      ...(existing ?? { periodStart: day, companyId: null }),
      eventTypeCounts,
      totalEvents,
      actionsPerUser,
    });
  }
}

function floorToHour(date: Date): Date {
  const floored = new Date(date);
  floored.setUTCMinutes(0, 0, 0);
  return floored;
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
