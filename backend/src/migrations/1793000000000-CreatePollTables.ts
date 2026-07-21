import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 25 B-2: Create polls and poll_votes tables.
 *
 * - polls: Organization-scoped polls with JSONB options
 * - poll_votes: Individual vote records with unique constraint
 */
export class CreatePollTables1793000000000 implements MigrationInterface {
  name = 'CreatePollTables1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── polls ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "polls" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" character varying NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "pollType" character varying(20) NOT NULL,
        "visibility" character varying(20) NOT NULL DEFAULT 'members_only',
        "options" jsonb NOT NULL DEFAULT '[]',
        "isAnonymous" boolean NOT NULL DEFAULT false,
        "maxSelections" integer NOT NULL DEFAULT 1,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "createdBy" character varying NOT NULL,
        "createdByName" character varying(100),
        "endsAt" TIMESTAMP,
        "closedBy" character varying,
        "closedAt" TIMESTAMP,
        "allowedRoles" text,
        "sharedWithOrgs" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "deletedBy" character varying,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_polls" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_polls_organizationId_status" ON "polls" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_polls_organizationId_createdAt" ON "polls" ("organizationId", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_polls_status_endsAt" ON "polls" ("status", "endsAt")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_polls_createdBy" ON "polls" ("createdBy")`);

    // ── poll_votes ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "poll_votes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" character varying NOT NULL,
        "pollId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "optionId" character varying NOT NULL,
        "rank" integer,
        "sharedWithOrgs" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "deletedBy" character varying,
        CONSTRAINT "PK_poll_votes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_poll_votes_pollId" FOREIGN KEY ("pollId")
          REFERENCES "polls"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_poll_votes_pollId_userId_optionId" ON "poll_votes" ("pollId", "userId", "optionId")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_poll_votes_pollId" ON "poll_votes" ("pollId")`);
    await queryRunner.query(`CREATE INDEX "IDX_poll_votes_userId" ON "poll_votes" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "poll_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "polls"`);
  }
}
