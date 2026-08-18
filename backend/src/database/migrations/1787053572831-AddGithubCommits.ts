import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGithubCommits1787053572831 implements MigrationInterface {
  name = 'AddGithubCommits1787053572831';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "github_commits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "sha" character varying NOT NULL, "authorLogin" character varying, "authorName" character varying NOT NULL, "branch" character varying NOT NULL, "committedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_github_commits_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_github_commits_project_sha" ON "github_commits" ("projectId", "sha")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_github_commits_project_sha"`);
    await queryRunner.query(`DROP TABLE "github_commits"`);
  }
}
