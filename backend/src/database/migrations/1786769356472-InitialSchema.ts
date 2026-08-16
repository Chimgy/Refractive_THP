import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1786769356472 implements MigrationInterface {
    name = 'InitialSchema1786769356472'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b28b07d25e4324eee577de5496d" UNIQUE ("slug"), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'member', "isActive" boolean NOT NULL DEFAULT true, "displayName" character varying, "deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "company_invites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'member', "createdByUserId" uuid NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8d9caed3b91b30dc5ac446e9e2a" UNIQUE ("tokenHash"), CONSTRAINT "PK_8a1b2e7559f337d1f32401d3c99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "allowedOrigins" text NOT NULL DEFAULT '', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_837f73e37f7433e200611d9384" ON "projects"  ("companyId", "slug") `);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "isRevoked" boolean NOT NULL DEFAULT false, "revokedAt" TIMESTAMP, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c25bc63d248ca90e8dcc1d92d06" UNIQUE ("tokenHash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "telemetry_error_fingerprints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" character varying, "fingerprint" character varying NOT NULL, "message" text NOT NULL, "file" character varying, "line" integer, "col" integer, "count" integer NOT NULL DEFAULT '1', "firstSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee18b3857adea61b4fe409a2b05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e5679f2099fb08736126446dcd" ON "telemetry_error_fingerprints"  ("projectId", "fingerprint") `);
        await queryRunner.query(`CREATE TABLE "telemetry_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL, "periodSeconds" integer NOT NULL, "pageViews" integer NOT NULL DEFAULT '0', "sessions" integer NOT NULL DEFAULT '0', "topPages" jsonb NOT NULL, "taggedClicks" jsonb NOT NULL, "countries" jsonb NOT NULL, "scrollDepth" jsonb NOT NULL, "utmSources" jsonb NOT NULL, "eventTypeCounts" jsonb NOT NULL, "lcpP50" numeric, "lcpP75" numeric, "ttfbP50" numeric, "ttfbP75" numeric, "dwellAvgMs" numeric, "dwellP50" numeric, "sessionDurationAvgMs" numeric, "sessionDurationP50" numeric, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2b411182a63946301bd2ff0524b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_361204254bd7035d94772cba49" ON "telemetry_metrics"  ("projectId", "periodStart") `);
        // raw_telemetry_snapshots is `synchronize: false` (declarative partitioning
        // isn't something TypeORM's schema diff understands), so it's absent from
        // the auto-generated diff above — added by hand here to match what's
        // actually running, confirmed against a live pg_dump of dev. Monthly child
        // partitions themselves are NOT created here; those are managed at runtime
        // by TelemetrySnapshotPartitionService.ensureUpcomingPartitionsExist().
        await queryRunner.query(`CREATE TABLE "raw_telemetry_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" character varying, "payload" jsonb NOT NULL, "userAgent" character varying, "receivedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "raw_telemetry_snapshots_pkey" PRIMARY KEY ("id", "receivedAt")) PARTITION BY RANGE ("receivedAt")`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_6f9395c9037632a31107c8a9e58" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "company_invites" ADD CONSTRAINT "FK_e13fe4c1efb3b5e8b5e225e8ddc" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "company_invites" ADD CONSTRAINT "FK_24a9083452fd79bbb5ba83490c9" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_87fa45e3f4517658b98e5c55b9c" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_87fa45e3f4517658b98e5c55b9c"`);
        await queryRunner.query(`ALTER TABLE "company_invites" DROP CONSTRAINT "FK_24a9083452fd79bbb5ba83490c9"`);
        await queryRunner.query(`ALTER TABLE "company_invites" DROP CONSTRAINT "FK_e13fe4c1efb3b5e8b5e225e8ddc"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_6f9395c9037632a31107c8a9e58"`);
        await queryRunner.query(`DROP TABLE "raw_telemetry_snapshots"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_361204254bd7035d94772cba49"`);
        await queryRunner.query(`DROP TABLE "telemetry_metrics"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e5679f2099fb08736126446dcd"`);
        await queryRunner.query(`DROP TABLE "telemetry_error_fingerprints"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_837f73e37f7433e200611d9384"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TABLE "company_invites"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "companies"`);
    }

}
