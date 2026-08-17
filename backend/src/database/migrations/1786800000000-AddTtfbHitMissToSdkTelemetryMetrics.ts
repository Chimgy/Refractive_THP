import { MigrationInterface, QueryRunner } from 'typeorm';

// Real per-visitor TTFB HIT/MISS — see sdk-telemetry-metric.entity.ts's
// ttfbHit*/ttfbMiss* columns. Client-measured (telemetry-script.ts reads a
// Server-Timing entry a Cloudflare Transform Rule mirrors cf-cache-status
// into), not from Cloudflare's GraphQL API — edgeTimeToFirstByteMs there
// turned out to require a Cloudflare Pro plan.
export class AddTtfbHitMissToSdkTelemetryMetrics1786800000000 implements MigrationInterface {
  name = 'AddTtfbHitMissToSdkTelemetryMetrics1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbHitP50" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbHitP75" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbHitP99" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbHitCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbMissP50" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbMissP75" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbMissP99" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbMissCount" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbMissCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbMissP99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbMissP75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbMissP50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbHitCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbHitP99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbHitP75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbHitP50"`,
    );
  }
}
