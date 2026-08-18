import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGithubRepoLinks1787045563467 implements MigrationInterface {
  name = 'AddGithubRepoLinks1787045563467';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "github_repo_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "owner" character varying NOT NULL, "repo" character varying NOT NULL, "installationId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_github_repo_links_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_github_repo_links_project" ON "github_repo_links" ("projectId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_github_repo_links_project"`);
    await queryRunner.query(`DROP TABLE "github_repo_links"`);
  }
}
