import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DailyActiveUserLog } from '../ingestion/entities/daily-active-user-log.entity';
import {
  KeyCount,
  UsageMetricsDaily,
} from '../ingestion/entities/usage-metrics-daily.entity';

export type ActiveSummary = {
  dau: number;
  wau: number;
  mau: number;
};

export type TodayUsage = {
  eventTypeCounts: KeyCount[];
  totalEvents: number;
  actionsPerUser: string | null;
};

export type UsageSummary = {
  users: ActiveSummary;
  teams: ActiveSummary;
  today: TodayUsage;
};

@Injectable()
export class MetricsQueryService {
  constructor(
    @InjectRepository(DailyActiveUserLog)
    private readonly dailyActiveUserLogRepository: Repository<DailyActiveUserLog>,
    @InjectRepository(UsageMetricsDaily)
    private readonly usageMetricsDailyRepository: Repository<UsageMetricsDaily>,
  ) {}

  async getUsageSummary(): Promise<UsageSummary> {
    const [users, teams, today] = await Promise.all([
      this.getActiveUsersSummary(),
      this.getActiveTeamsSummary(),
      this.getTodayUsage(),
    ]);
    return { users, teams, today };
  }

  // DAU/WAU/MAU computed at query time as COUNT(DISTINCT userId) over a
  // rolling window — never read from a pre-summed column (plan §"Key
  // decisions" item 2; daily_active_user_log's whole design exists to make
  // this the only correct way to answer "how many active users").
  private async getActiveUsersSummary(): Promise<ActiveSummary> {
    const [dau, wau, mau] = await Promise.all([
      this.countDistinctSince('userId', 1),
      this.countDistinctSince('userId', 7),
      this.countDistinctSince('userId', 30),
    ]);
    return { dau, wau, mau };
  }

  // Same rolling-window logic, over companyId instead of userId — "active
  // teams" is free to compute from the exact same table since companyId is
  // already denormalized onto every row.
  private async getActiveTeamsSummary(): Promise<ActiveSummary> {
    const [dau, wau, mau] = await Promise.all([
      this.countDistinctSince('companyId', 1),
      this.countDistinctSince('companyId', 7),
      this.countDistinctSince('companyId', 30),
    ]);
    return { dau, wau, mau };
  }

  private async countDistinctSince(
    column: 'userId' | 'companyId',
    days: number,
  ): Promise<number> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const sinceDay = since.toISOString().slice(0, 10);

    const result = await this.dailyActiveUserLogRepository
      .createQueryBuilder('log')
      .select(`COUNT(DISTINCT log.${column})`, 'count')
      .where('log.day >= :sinceDay', { sinceDay })
      .getRawOne<{ count: string }>();

    return Number(result?.count ?? 0);
  }

  // Platform-wide (companyId IS NULL) row for today — the only slice of
  // usage_metrics_daily populated so far (usage-events-pull.job.ts). No row
  // yet (first pull of the day hasn't landed) reads as all-zero/empty, not
  // an error.
  private async getTodayUsage(): Promise<TodayUsage> {
    const today = new Date().toISOString().slice(0, 10);
    const row = await this.usageMetricsDailyRepository.findOne({
      where: { periodStart: today, companyId: IsNull() },
    });
    return {
      eventTypeCounts: row?.eventTypeCounts ?? [],
      totalEvents: row?.totalEvents ?? 0,
      actionsPerUser: row?.actionsPerUser ?? null,
    };
  }
}
