import { MigrationInterface, QueryRunner } from "typeorm";

// Two real gaps closed here, not just new metrics:
// 1. session_end already sends a true wall-clock durationMs alongside
//    activeMs, but the aggregation pipeline only ever kept activeMs
//    (sessionDurationAvgMs/P50 despite the name) — durationMs was captured
//    client-side and discarded server-side. sessionWall* columns are the
//    real wall-clock counterpart, sourced independently (telemetry-
//    aggregation.service.ts's session_end handling, sessionWallKey).
// 2. vitals events already send domContentLoaded/loadComplete on every
//    cold navigation, but nothing aggregated them — domContentLoadedColdP50/
//    loadCompleteColdP50 are the first read of that data, riding along on
//    the existing cold-nav sample (navColdKey's extended composite format).
export class AddSessionWallAndNavPhasesToSdkTelemetryMetrics1786820000000 implements MigrationInterface {
    name = 'AddSessionWallAndNavPhasesToSdkTelemetryMetrics1786820000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" ADD "sessionWallAvgMs" numeric`);
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" ADD "sessionWallP50" numeric`);
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" ADD "sessionWallCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" ADD "domContentLoadedColdP50" numeric`);
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" ADD "loadCompleteColdP50" numeric`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "loadCompleteColdP50"`);
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "domContentLoadedColdP50"`);
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "sessionWallCount"`);
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "sessionWallP50"`);
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "sessionWallAvgMs"`);
    }

}
