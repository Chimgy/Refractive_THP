import { MigrationInterface, QueryRunner } from 'typeorm';

// Correlation key from raw_telemetry_snapshots back to
// telemetry_error_fingerprints — populated at ingest time in
// TelemetrySnapshotsService.capture() with the same sha256 fingerprint hash
// TelemetryErrorsService upserts, so a fingerprint row can be traced back to
// its full raw context without guessing a time window. GIN index on the
// array supports `errorFingerprints @> ARRAY[fingerprint]` containment
// lookups. raw_telemetry_snapshots is a partitioned parent
// (PARTITION BY RANGE ("receivedAt"), synchronize: false — see
// InitialSchema), so this index is created once here and Postgres
// propagates it automatically to every partition attached via
// `CREATE TABLE ... PARTITION OF ...` (telemetry-snapshot-partition.service.ts),
// existing and future.
export class AddErrorFingerprintsToRawTelemetrySnapshots1786810000000 implements MigrationInterface {
  name = 'AddErrorFingerprintsToRawTelemetrySnapshots1786810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "raw_telemetry_snapshots" ADD "errorFingerprints" text array`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_raw_telemetry_snapshots_error_fingerprints" ON "raw_telemetry_snapshots" USING GIN ("errorFingerprints")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_raw_telemetry_snapshots_error_fingerprints"`,
    );
    await queryRunner.query(
      `ALTER TABLE "raw_telemetry_snapshots" DROP COLUMN "errorFingerprints"`,
    );
  }
}
