import { MigrationInterface, QueryRunner } from 'typeorm';

// First-party product-analytics tables (internal telemetry pipeline —
// external_data.md's counterpart for Refractive_THP's own users rather than
// tenants' end-visitors). usage_events: behavioral events (login, page
// views, feature/workflow usage, user-facing errors), always authenticated
// so companyId/userId are NOT NULL. rum_events: web-vitals/RUM samples from
// the product's own frontend, nullable companyId/userId since vitals can
// report before auth resolves. Both are read-only-pulled by internal-backend
// hourly via a dedicated least-privilege role (see
// AddInternalReadonlyRole1786840100000, the migration right after this one).
export class AddUsageAnalyticsTables1786840000000 implements MigrationInterface {
  name = 'AddUsageAnalyticsTables1786840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "usage_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL, "userId" uuid NOT NULL, "eventType" character varying NOT NULL, "eventName" character varying NOT NULL, "route" character varying, "metadata" jsonb NOT NULL DEFAULT '{}', "country" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_usage_events_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_usage_events_company_created" ON "usage_events" ("companyId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_usage_events_user_created" ON "usage_events" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_usage_events_type_created" ON "usage_events" ("eventType", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_events" ADD CONSTRAINT "FK_usage_events_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_events" ADD CONSTRAINT "FK_usage_events_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "rum_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyId" uuid, "userId" uuid, "route" character varying NOT NULL, "metric" character varying NOT NULL, "value" numeric, "deviceType" character varying, "browser" character varying, "connectionType" character varying, "country" character varying, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_rum_events_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rum_events_metric_created" ON "rum_events" ("metric", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rum_events_route_metric_created" ON "rum_events" ("route", "metric", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "rum_events" ADD CONSTRAINT "FK_rum_events_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rum_events" ADD CONSTRAINT "FK_rum_events_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rum_events" DROP CONSTRAINT "FK_rum_events_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rum_events" DROP CONSTRAINT "FK_rum_events_company"`,
    );
    await queryRunner.query(`DROP TABLE "rum_events"`);

    await queryRunner.query(
      `ALTER TABLE "usage_events" DROP CONSTRAINT "FK_usage_events_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_events" DROP CONSTRAINT "FK_usage_events_company"`,
    );
    await queryRunner.query(`DROP TABLE "usage_events"`);
  }
}
