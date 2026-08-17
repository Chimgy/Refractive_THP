import { MigrationInterface, QueryRunner } from 'typeorm';

// Platform-wide event-type breakdown (login/logout/page_view counts, today)
// — the only slice of usage_metrics_daily actually populated so far
// (usage-events-pull.job.ts). featureAdoption/workflowFunnel/topErrors stay
// empty until real feature_used/workflow_*/error_encountered call sites
// exist client-side (plan §"Build order" Phase 2) — this column is added
// separately, now, specifically so the dashboard only ever shows real data.
export class AddEventTypeCountsToUsageMetricsDaily1786850000000
  implements MigrationInterface
{
  name = 'AddEventTypeCountsToUsageMetricsDaily1786850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usage_metrics_daily" ADD "eventTypeCounts" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_metrics_daily" ADD "totalEvents" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usage_metrics_daily" DROP COLUMN "totalEvents"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_metrics_daily" DROP COLUMN "eventTypeCounts"`,
    );
  }
}
