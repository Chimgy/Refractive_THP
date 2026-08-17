import { MigrationInterface, QueryRunner } from 'typeorm';

// Real edge-observed HTTP status counts (2xx/3xx/4xx/5xx) from Cloudflare's
// edgeResponseStatus dimension — see edgelog-metric.entity.ts and
// telemetry-cloudflare-pull.processor.ts. Unlike coloCode/
// edgeTimeToFirstByteMs, this dimension isn't Cloudflare-plan-gated.
export class AddStatusCountsToEdgeLogMetrics1786820000000 implements MigrationInterface {
  name = 'AddStatusCountsToEdgeLogMetrics1786820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "edgelog_metrics" ADD "status2xxCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "edgelog_metrics" ADD "status3xxCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "edgelog_metrics" ADD "status4xxCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "edgelog_metrics" ADD "status5xxCount" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "edgelog_metrics" DROP COLUMN "status5xxCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "edgelog_metrics" DROP COLUMN "status4xxCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "edgelog_metrics" DROP COLUMN "status3xxCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "edgelog_metrics" DROP COLUMN "status2xxCount"`,
    );
  }
}
