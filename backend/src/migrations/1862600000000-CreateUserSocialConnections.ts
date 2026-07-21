import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create user_social_connections table for friend / follower / block relationships.
 *
 * Phase 3.2 of the system gaps remediation plan (PR #1107 follow-up).
 *
 * One row per directional connection. Friendships use the requester→target row
 * with status transitions (pending → accepted/rejected) — reciprocity is derived
 * in queries, not duplicated in storage.
 */
export class CreateUserSocialConnections1862600000000 implements MigrationInterface {
  name = 'CreateUserSocialConnections1862600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_social_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "targetUserId" uuid NOT NULL,
        "connectionType" varchar(32) NOT NULL DEFAULT 'friend',
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "metadata" jsonb,
        CONSTRAINT "PK_user_social_connections" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_social_connections_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_social_connections_target"
          FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_user_social_connections_not_self" CHECK ("userId" <> "targetUserId")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_social_connections_pair_type"
        ON "user_social_connections" ("userId", "targetUserId", "connectionType")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_social_connections_target_status"
        ON "user_social_connections" ("targetUserId", "connectionType", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_social_connections_user_status"
        ON "user_social_connections" ("userId", "connectionType", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_social_connections_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_social_connections_target_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_user_social_connections_pair_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_social_connections"`);
  }
}
