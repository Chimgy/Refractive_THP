import { MigrationInterface, QueryRunner } from 'typeorm';

// Renames telemetry_metrics -> sdk_telemetry_metrics (makes explicit
// everything there comes from the embed script/SDK, not Cloudflare — see
// entities/sdk-telemetry-metric.entity.ts), adds the DNS/TCP cold-vs-reused,
// LCP cold-vs-cached, and P99 columns to it, and creates two new tables:
// edgelog_metrics (Cloudflare-sourced edge data — deliberately separate
// from sdk_telemetry_metrics, see entities/edgelog-metric.entity.ts for
// why) and cloudflare_zone_links (per-project Cloudflare API credentials,
// encrypted at rest — see cloudflare-token-crypto.util.ts).
export class AddEdgeMetricsAndSdkRename1786790000000 implements MigrationInterface {
  name = 'AddEdgeMetricsAndSdkRename1786790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telemetry_metrics" RENAME TO "sdk_telemetry_metrics"`,
    );

    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpP99" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbP99" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "ttfbCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "dnsColdP50" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "dnsColdP75" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "dnsColdP99" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "tcpColdP50" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "tcpColdP75" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "tcpColdP99" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "navColdCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "navColdCountries" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "navReusedCountries" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpColdP50" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpColdP75" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpColdP99" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpColdCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpCachedP50" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpCachedP75" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpCachedP99" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" ADD "lcpCachedCount" integer NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(
      `CREATE TABLE "edgelog_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "source" character varying NOT NULL, "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL, "periodSeconds" integer NOT NULL, "cacheHitAvgMs" numeric, "cacheHitCount" integer NOT NULL DEFAULT '0', "cacheMissAvgMs" numeric, "cacheMissCount" integer NOT NULL DEFAULT '0', "originResponseAvgMs" numeric, "edgeLocations" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_edgelog_metrics_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_edgelog_metrics_project_period_source" ON "edgelog_metrics" ("projectId", "periodStart", "source")`,
    );

    await queryRunner.query(
      `CREATE TABLE "cloudflare_zone_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "zoneId" character varying NOT NULL, "apiTokenEncrypted" text NOT NULL, "apiTokenIv" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cloudflare_zone_links_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cloudflare_zone_links_project" ON "cloudflare_zone_links" ("projectId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cloudflare_zone_links_project"`,
    );
    await queryRunner.query(`DROP TABLE "cloudflare_zone_links"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_edgelog_metrics_project_period_source"`,
    );
    await queryRunner.query(`DROP TABLE "edgelog_metrics"`);

    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpCachedCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpCachedP99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpCachedP75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpCachedP50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpColdCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpColdP99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpColdP75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpColdP50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "navReusedCountries"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "navColdCountries"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "navColdCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "tcpColdP99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "tcpColdP75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "tcpColdP50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "dnsColdP99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "dnsColdP75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "dnsColdP50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "ttfbP99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "lcpP99"`,
    );

    await queryRunner.query(
      `ALTER TABLE "sdk_telemetry_metrics" RENAME TO "telemetry_metrics"`,
    );
  }
}
