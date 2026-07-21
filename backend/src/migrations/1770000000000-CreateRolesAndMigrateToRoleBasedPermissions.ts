import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Roles Table and Migrate to Role-Based Permissions System
 *
 * This migration transforms the hardcoded string-based role system into a database-backed
 * role and permissions system, enabling dynamic role management and granular permissions.
 *
 * Changes:
 * 1. Creates `roles` table with support for system and organization-specific roles
 * 2. Seeds system roles (admin, user) and default organization roles (owner, admin, member, guest)
 * 3. Adds roleId column to organization_memberships
 * 4. Migrates existing string role values to role IDs
 * 5. Removes old string-based role column
 *
 * Migration Path:
 * - Old: organization_memberships.role = 'owner' | 'admin' | 'member' | 'guest' (string)
 * - New: organization_memberships.roleId -> roles.id (UUID reference)
 *
 * Backward Compatibility: Down migration restores string-based roles
 */
export class CreateRolesAndMigrateToRoleBasedPermissions1770000000000 implements MigrationInterface {
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
    const roleIdColumn = await this.resolveColumnName(
      queryRunner,
      'organization_memberships',
      'roleId'
    );
    const rolesTableExists = await queryRunner.hasTable('roles');

    // Modern schema already includes role-based memberships with role backup.
    if (roleBackupColumn && roleIdColumn && rolesTableExists) {
      return;
    }

    // =========================================================================
    // Step 1: Create roles table
    // =========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(50) NOT NULL,
        description text,
        "organizationId" varchar(255),
        "isSystemRole" boolean NOT NULL DEFAULT false,
        priority integer NOT NULL DEFAULT 0,
        permissions text,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_role_organization FOREIGN KEY ("organizationId")
          REFERENCES organizations(id) ON DELETE CASCADE
      )
    `);

    // Create unique index: role name must be unique within organization scope
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_roles_name_org
      ON roles (name, COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'))
    `);

    // Create index for organization lookups
    await queryRunner.query(`
      CREATE INDEX idx_roles_organization ON roles ("organizationId")
    `);

    // Create index for system role lookups
    await queryRunner.query(`
      CREATE INDEX idx_roles_system ON roles ("isSystemRole")
    `);

    // =========================================================================
    // Step 2: Seed system roles (global, not organization-specific)
    // =========================================================================
    await queryRunner.query(`
      INSERT INTO roles (name, description, "organizationId", "isSystemRole", priority, permissions)
      VALUES
        (
          'admin',
          'Platform administrator with full system access',
          NULL,
          true,
          1000,
          '["system:*"]'
        ),
        (
          'user',
          'Standard authenticated user',
          NULL,
          true,
          10,
          '["profile:read", "profile:write"]'
        )
    `);

    // =========================================================================
    // Step 3: Seed default organization roles for ALL existing organizations
    // =========================================================================
    // For each organization, create: owner, admin, member, guest roles
    await queryRunner.query(`
      INSERT INTO roles (name, description, "organizationId", "isSystemRole", priority, permissions)
      SELECT
        'owner',
        'Organization creator with full control',
        o.id,
        false,
        100,
        '["org:*", "member:*", "event:*", "fleet:*", "intel:*", "resource:*", "settings:*"]'
      FROM organizations o
    `);

    await queryRunner.query(`
      INSERT INTO roles (name, description, "organizationId", "isSystemRole", priority, permissions)
      SELECT
        'admin',
        'Organization administrator with elevated privileges',
        o.id,
        false,
        90,
        '["org:read", "org:write", "member:invite", "member:remove", "member:edit", "event:*", "fleet:*", "intel:*", "resource:*", "settings:read"]'
      FROM organizations o
    `);

    await queryRunner.query(`
      INSERT INTO roles (name, description, "organizationId", "isSystemRole", priority, permissions)
      SELECT
        'member',
        'Standard organization member',
        o.id,
        false,
        10,
        '["org:read", "member:read", "event:read", "event:rsvp", "fleet:read", "intel:read", "resource:read"]'
      FROM organizations o
    `);

    await queryRunner.query(`
      INSERT INTO roles (name, description, "organizationId", "isSystemRole", priority, permissions)
      SELECT
        'guest',
        'Limited access member for public content only',
        o.id,
        false,
        1,
        '["org:read", "event:read"]'
      FROM organizations o
    `);

    // =========================================================================
    // Step 4: Add roleId column to organization_memberships
    // =========================================================================
    await queryRunner.query(`
      ALTER TABLE organization_memberships
      ADD COLUMN IF NOT EXISTS "roleId" uuid
    `);

    // =========================================================================
    // Step 5: Migrate existing string roles to role IDs
    // =========================================================================
    // For each membership, find the matching role ID based on:
    // - role name (owner, admin, member, guest)
    // - organizationId match
    await queryRunner.query(`
      UPDATE organization_memberships om
      SET "roleId" = r.id
      FROM roles r
      WHERE r.name = LOWER(COALESCE(om.role, 'member'))
        AND r."organizationId" = om."organizationId"
        AND r."isSystemRole" = false
    `);

    // Handle any memberships that didn't match (default to 'member' role)
    await queryRunner.query(`
      UPDATE organization_memberships om
      SET "roleId" = r.id
      FROM roles r
      WHERE om."roleId" IS NULL
        AND r.name = 'member'
        AND r."organizationId" = om."organizationId"
        AND r."isSystemRole" = false
    `);

    // =========================================================================
    // Step 6: Make roleId NOT NULL and add foreign key
    // =========================================================================
    await queryRunner.query(`
      ALTER TABLE organization_memberships
      ALTER COLUMN "roleId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE organization_memberships
      ADD CONSTRAINT fk_membership_role
      FOREIGN KEY ("roleId") REFERENCES roles(id) ON DELETE RESTRICT
    `);

    // Create index for role lookups
    await queryRunner.query(`
      CREATE INDEX idx_memberships_role ON organization_memberships ("roleId")
    `);

    // =========================================================================
    // Step 7: Drop old string-based role column
    // =========================================================================
    // Backup to roleBackup for safety (can be dropped in a future migration)
    await queryRunner.query(`
      ALTER TABLE organization_memberships
      RENAME COLUMN role TO "roleBackup"
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN organization_memberships."roleBackup" IS
      'Deprecated: Original string-based role. Kept temporarily for rollback safety. Will be removed in future migration.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // Rollback: Restore string-based roles
    // =========================================================================

    // Step 1: Restore role column from roleBackup if it exists
    const hasRoleBackup = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'organization_memberships'
        AND column_name = 'roleBackup'
    `);

    if (hasRoleBackup.length > 0) {
      await queryRunner.query(`
        ALTER TABLE organization_memberships
        RENAME COLUMN "roleBackup" TO role
      `);
    } else {
      // If roleBackup doesn't exist, recreate role column from roleId
      await queryRunner.query(`
        ALTER TABLE organization_memberships
        ADD COLUMN IF NOT EXISTS role varchar DEFAULT 'member'
      `);

      // Populate from roles table
      await queryRunner.query(`
        UPDATE organization_memberships om
        SET role = r.name
        FROM roles r
        WHERE om."roleId" = r.id
      `);

      await queryRunner.query(`
        ALTER TABLE organization_memberships
        ALTER COLUMN role SET NOT NULL
      `);
    }

    // Step 2: Drop foreign key and index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_memberships_role
    `);

    await queryRunner.query(`
      ALTER TABLE organization_memberships
      DROP CONSTRAINT IF EXISTS fk_membership_role
    `);

    // Step 3: Drop roleId column
    await queryRunner.query(`
      ALTER TABLE organization_memberships
      DROP COLUMN IF EXISTS "roleId"
    `);

    // Step 4: Drop roles table indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_roles_system`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_roles_organization`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_roles_name_org`);

    // Step 5: Drop roles table
    await queryRunner.query(`DROP TABLE IF EXISTS roles CASCADE`);
  }
}
