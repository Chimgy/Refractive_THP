import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDevicesLocalesToTelemetryMetrics1786769453161 implements MigrationInterface {
  name = 'AddDevicesLocalesToTelemetryMetrics1786769453161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telemetry_metrics" ADD "devices" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "telemetry_metrics" ADD "locales" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telemetry_metrics" DROP COLUMN "locales"`,
    );
    await queryRunner.query(
      `ALTER TABLE "telemetry_metrics" DROP COLUMN "devices"`,
    );
  }
}
