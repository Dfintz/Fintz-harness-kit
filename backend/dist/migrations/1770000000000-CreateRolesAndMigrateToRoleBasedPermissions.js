"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRolesAndMigrateToRoleBasedPermissions1770000000000 = void 0;
class CreateRolesAndMigrateToRoleBasedPermissions1770000000000 {
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
        const roleIdColumn = await this.resolveColumnName(queryRunner, 'organization_memberships', 'roleId');
        const rolesTableExists = await queryRunner.hasTable('roles');
        if (roleBackupColumn && roleIdColumn && rolesTableExists) {
            return;
        }
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
        await queryRunner.query(`
      CREATE UNIQUE INDEX idx_roles_name_org
      ON roles (name, COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'))
    `);
        await queryRunner.query(`
      CREATE INDEX idx_roles_organization ON roles ("organizationId")
    `);
        await queryRunner.query(`
      CREATE INDEX idx_roles_system ON roles ("isSystemRole")
    `);
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
        await queryRunner.query(`
      ALTER TABLE organization_memberships
      ADD COLUMN IF NOT EXISTS "roleId" uuid
    `);
        await queryRunner.query(`
      UPDATE organization_memberships om
      SET "roleId" = r.id
      FROM roles r
      WHERE r.name = LOWER(COALESCE(om.role, 'member'))
        AND r."organizationId" = om."organizationId"
        AND r."isSystemRole" = false
    `);
        await queryRunner.query(`
      UPDATE organization_memberships om
      SET "roleId" = r.id
      FROM roles r
      WHERE om."roleId" IS NULL
        AND r.name = 'member'
        AND r."organizationId" = om."organizationId"
        AND r."isSystemRole" = false
    `);
        await queryRunner.query(`
      ALTER TABLE organization_memberships
      ALTER COLUMN "roleId" SET NOT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE organization_memberships
      ADD CONSTRAINT fk_membership_role
      FOREIGN KEY ("roleId") REFERENCES roles(id) ON DELETE RESTRICT
    `);
        await queryRunner.query(`
      CREATE INDEX idx_memberships_role ON organization_memberships ("roleId")
    `);
        await queryRunner.query(`
      ALTER TABLE organization_memberships
      RENAME COLUMN role TO "roleBackup"
    `);
        await queryRunner.query(`
      COMMENT ON COLUMN organization_memberships."roleBackup" IS
      'Deprecated: Original string-based role. Kept temporarily for rollback safety. Will be removed in future migration.'
    `);
    }
    async down(queryRunner) {
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
        }
        else {
            await queryRunner.query(`
        ALTER TABLE organization_memberships
        ADD COLUMN IF NOT EXISTS role varchar DEFAULT 'member'
      `);
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
        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_memberships_role
    `);
        await queryRunner.query(`
      ALTER TABLE organization_memberships
      DROP CONSTRAINT IF EXISTS fk_membership_role
    `);
        await queryRunner.query(`
      ALTER TABLE organization_memberships
      DROP COLUMN IF EXISTS "roleId"
    `);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_roles_system`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_roles_organization`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_roles_name_org`);
        await queryRunner.query(`DROP TABLE IF EXISTS roles CASCADE`);
    }
}
exports.CreateRolesAndMigrateToRoleBasedPermissions1770000000000 = CreateRolesAndMigrateToRoleBasedPermissions1770000000000;
//# sourceMappingURL=1770000000000-CreateRolesAndMigrateToRoleBasedPermissions.js.map