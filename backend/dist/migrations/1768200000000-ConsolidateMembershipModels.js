"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsolidateMembershipModels1768200000000 = void 0;
class ConsolidateMembershipModels1768200000000 {
    async resolveColumnName(queryRunner, tableName, preferredName) {
        const rows = await queryRunner.query(`SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`, [tableName, preferredName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const roleBackupColumn = await this.resolveColumnName(queryRunner, 'organization_memberships', 'roleBackup');
        if (roleBackupColumn) {
            await queryRunner.query(`DROP TABLE IF EXISTS user_organizations`);
            return;
        }
        await queryRunner.query(`
      ALTER TABLE organization_memberships
      ADD COLUMN IF NOT EXISTS "securityLevel" integer NOT NULL DEFAULT 1
    `);
        await queryRunner.query(`
      INSERT INTO organization_memberships (
        "userId",
        "organizationId",
        "role",
        "securityLevel",
        "joinedAt",
        "isActive",
        "permissions",
        "createdAt",
        "updatedAt"
      )
      SELECT
        uo."userId",
        uo."organizationId",
        COALESCE(uo."role", 'member') as role,
        COALESCE(uo."securityLevel", 1) as "securityLevel",
        uo."joinedAt",
        TRUE as "isActive",
        CASE WHEN uo."customPermissions" IS NULL OR uo."customPermissions" = ''
             THEN NULL
             ELSE uo."customPermissions"
        END as permissions,
        NOW() as "createdAt",
        NOW() as "updatedAt"
      FROM user_organizations uo
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_memberships om
        WHERE om."userId" = uo."userId"
          AND om."organizationId" = uo."organizationId"
      )
    `);
        await queryRunner.query(`
      DROP TABLE IF EXISTS user_organizations
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_organizations (
        "userId" varchar NOT NULL,
        "organizationId" varchar NOT NULL,
        "role" varchar DEFAULT 'member',
        "securityLevel" integer DEFAULT 1,
        "customPermissions" text,
        "joinedAt" timestamp DEFAULT NOW(),
        PRIMARY KEY ("userId", "organizationId")
      )
    `);
        await queryRunner.query(`
      INSERT INTO user_organizations (
        "userId", "organizationId", "role", "securityLevel", "customPermissions", "joinedAt"
      )
      SELECT
        om."userId",
        om."organizationId",
        COALESCE(om."role", 'member'),
        COALESCE(om."securityLevel", 1),
        CASE WHEN om."permissions" IS NULL OR om."permissions" = ''
             THEN NULL
             ELSE om."permissions"
        END,
        COALESCE(om."joinedAt", NOW())
      FROM organization_memberships om
      WHERE om."isActive" = TRUE
    `);
        await queryRunner.query(`
      ALTER TABLE organization_memberships
      DROP COLUMN IF EXISTS "securityLevel"
    `);
    }
}
exports.ConsolidateMembershipModels1768200000000 = ConsolidateMembershipModels1768200000000;
//# sourceMappingURL=1768200000000-ConsolidateMembershipModels.js.map