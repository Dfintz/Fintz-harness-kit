import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Consolidate Membership Models
 * - Adds securityLevel to organization_memberships
 * - Migrates data from user_organizations into organization_memberships (if missing)
 * - Drops user_organizations table
 */
export class ConsolidateMembershipModels1768200000000 implements MigrationInterface {
  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    preferredName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [tableName, preferredName]
    );

    return rows[0]?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roleBackupColumn = await this.resolveColumnName(
      queryRunner,
      'organization_memberships',
      'roleBackup'
    );

    // Modern schema already consolidates memberships; only clean up legacy table if present.
    if (roleBackupColumn) {
      await queryRunner.query(`DROP TABLE IF EXISTS user_organizations`);
      return;
    }

    // 1) Ensure securityLevel column exists on organization_memberships
    await queryRunner.query(`
      ALTER TABLE organization_memberships
      ADD COLUMN IF NOT EXISTS "securityLevel" integer NOT NULL DEFAULT 1
    `);

    // 2) Migrate data from user_organizations to organization_memberships when not already present
    // Map customPermissions -> permissions; store joinedAt and set isActive true by default
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

    // 3) Drop legacy table (if exists)
    await queryRunner.query(`
      DROP TABLE IF EXISTS user_organizations
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate legacy table minimally to allow down migration, without data restoration
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

    // Optionally move data back (best-effort): copy active memberships
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

    // Remove securityLevel column to revert schema
    await queryRunner.query(`
      ALTER TABLE organization_memberships
      DROP COLUMN IF EXISTS "securityLevel"
    `);
  }
}
