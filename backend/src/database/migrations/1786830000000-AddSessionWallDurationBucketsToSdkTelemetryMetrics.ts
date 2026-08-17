import { MigrationInterface, QueryRunner } from "typeorm";

// Distribution of wall-clock session durations for the "Session start / end
// + duration" widget's histogram — see SESSION_WALL_DURATION_BUCKETS in
// telemetry-rollup.processor.ts for the fixed bucket boundaries.
export class AddSessionWallDurationBucketsToSdkTelemetryMetrics1786830000000 implements MigrationInterface {
    name = 'AddSessionWallDurationBucketsToSdkTelemetryMetrics1786830000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" ADD "sessionWallDurationBuckets" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sdk_telemetry_metrics" DROP COLUMN "sessionWallDurationBuckets"`);
    }

}
