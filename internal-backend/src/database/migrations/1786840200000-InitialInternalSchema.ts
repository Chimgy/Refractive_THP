import { MigrationInterface, QueryRunner } from 'typeorm';

// First migration ever run against internal_thp — unlike backend's
// InitialSchema, there is no prior `synchronize: true` dev pass that could
// have silently created the uuid-ossp extension, so it's created explicitly
// here rather than assumed present.
export class InitialInternalSchema1786840200000 implements MigrationInterface {
  name = 'InitialInternalSchema1786840200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TABLE "ingestion_state" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "jobName" character varying NOT NULL, "lastPulledAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ingestion_state_job_name" UNIQUE ("jobName"), CONSTRAINT "PK_ingestion_state_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "daily_active_user_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "day" date NOT NULL, "companyId" uuid NOT NULL, "userId" uuid NOT NULL, "firstEventAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_daily_active_user_log_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_daily_active_user_log_day_company_user" ON "daily_active_user_log" ("day", "companyId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_daily_active_user_log_company_day" ON "daily_active_user_log" ("companyId", "day")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_daily_active_user_log_user_day" ON "daily_active_user_log" ("userId", "day")`,
    );

    await queryRunner.query(
      `CREATE TABLE "usage_metrics_daily" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "periodStart" date NOT NULL, "companyId" uuid, "newUsers" integer NOT NULL DEFAULT 0, "returningUsers" integer NOT NULL DEFAULT 0, "featureAdoption" jsonb NOT NULL DEFAULT '[]', "workflowFunnel" jsonb NOT NULL DEFAULT '[]', "topErrors" jsonb NOT NULL DEFAULT '[]', "actionsPerUser" numeric, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_usage_metrics_daily_id" PRIMARY KEY ("id"))`,
    );
    // NULLS NOT DISTINCT (Postgres 16, already pinned in docker-compose.yml)
    // — without it, Postgres' default NULL <> NULL semantics would let
    // multiple companyId-IS-NULL (platform-wide) rows coexist for the same
    // periodStart. Not expressible via TypeORM's @Index decorator, so this
    // constraint exists only here, not mirrored in the entity (see
    // usage-metrics-daily.entity.ts's comment).
    await queryRunner.query(
      `ALTER TABLE "usage_metrics_daily" ADD CONSTRAINT "UQ_usage_metrics_daily_period_company" UNIQUE NULLS NOT DISTINCT ("periodStart", "companyId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "vitals_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL, "metric" character varying NOT NULL, "dimension" character varying NOT NULL, "value" character varying NOT NULL, "p50" numeric, "p75" numeric, "p95" numeric, "sampleCount" integer NOT NULL DEFAULT 0, "jsErrorCount" integer NOT NULL DEFAULT 0, "resourceErrorCount" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_vitals_metrics_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_vitals_metrics_period_metric_dimension_value" ON "vitals_metrics" ("periodStart", "metric", "dimension", "value")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vitals_metrics_metric_period" ON "vitals_metrics" ("metric", "periodStart")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "vitals_metrics"`);
    await queryRunner.query(`DROP TABLE "usage_metrics_daily"`);
    await queryRunner.query(`DROP TABLE "daily_active_user_log"`);
    await queryRunner.query(`DROP TABLE "ingestion_state"`);
  }
}
