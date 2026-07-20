"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserSocialConnections1862600000000 = void 0;
class CreateUserSocialConnections1862600000000 {
    name = 'CreateUserSocialConnections1862600000000';
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_social_connections_user_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_social_connections_target_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_user_social_connections_pair_type"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_social_connections"`);
    }
}
exports.CreateUserSocialConnections1862600000000 = CreateUserSocialConnections1862600000000;
//# sourceMappingURL=1862600000000-CreateUserSocialConnections.js.map