import { MigrationInterface, QueryRunner } from 'typeorm';

// Least-privilege Postgres role for internal-backend's hourly read-only pull
// (plan §"Key decisions" item 8) — SELECT only on the two tables the
// internal ingestion pipeline actually needs (usage_events, rum_events), not
// the whole schema. Deliberately no default-privileges future-grant clause:
// a table added later needs an explicit follow-up grant migration, same
// fail-closed-by-default style as allowedOrigins on Project.
//
// Password comes from INTERNAL_READONLY_DB_PASSWORD, injected via
// docker-compose.yml's `backend.environment` exactly like every other secret
// this app reads (see database/data-source.ts — no dotenv step, this app
// relies on process.env directly with a fallback default, same pattern used
// here). Roles are cluster-wide, not per-database, so CREATE ROLE is guarded
// by an existence check to stay idempotent if this ever needs to re-run
// against an existing cluster.
export class AddInternalReadonlyRole1786840100000 implements MigrationInterface {
  name = 'AddInternalReadonlyRole1786840100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const password =
      process.env.INTERNAL_READONLY_DB_PASSWORD ?? 'dev-only-readonly-secret';

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'internal_readonly') THEN
          CREATE ROLE internal_readonly LOGIN;
        END IF;
      END
      $$;
    `);
    // Outside the existence-guard so a password rotation (env var changed,
    // migration re-run against a cluster where the role already exists)
    // still takes effect.
    await queryRunner.query(
      `ALTER ROLE internal_readonly WITH PASSWORD '${password.replace(/'/g, "''")}'`,
    );

    await queryRunner.query(
      `GRANT CONNECT ON DATABASE "${queryRunner.connection.options.database as string}" TO internal_readonly`,
    );
    await queryRunner.query(
      `GRANT USAGE ON SCHEMA public TO internal_readonly`,
    );
    await queryRunner.query(
      `GRANT SELECT ON "usage_events", "rum_events" TO internal_readonly`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE SELECT ON "usage_events", "rum_events" FROM internal_readonly`,
    );
    await queryRunner.query(
      `REVOKE USAGE ON SCHEMA public FROM internal_readonly`,
    );
    await queryRunner.query(
      `REVOKE CONNECT ON DATABASE "${queryRunner.connection.options.database as string}" FROM internal_readonly`,
    );
    await queryRunner.query(`DROP ROLE IF EXISTS internal_readonly`);
  }
}
