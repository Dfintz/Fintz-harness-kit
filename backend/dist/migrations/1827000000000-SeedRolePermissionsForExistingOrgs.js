"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedRolePermissionsForExistingOrgs1827000000000 = void 0;
const logger_1 = require("../utils/logger");
class SeedRolePermissionsForExistingOrgs1827000000000 {
    name = 'SeedRolePermissionsForExistingOrgs1827000000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, tableName, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [tableName, desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    defaultPermissions = {
        admin: [
            { resource: 'settings', actions: ['ALL'] },
            { resource: 'fleet', actions: ['ALL'] },
            { resource: 'member', actions: ['ALL'] },
            { resource: 'event', actions: ['ALL'] },
            { resource: 'analytics', actions: ['ALL'] },
        ],
        senior_officer: [
            { resource: 'fleet', actions: ['VIEW', 'CREATE', 'EDIT', 'MANAGE'] },
            { resource: 'member', actions: ['VIEW'] },
            { resource: 'event', actions: ['VIEW', 'CREATE', 'EDIT'] },
            { resource: 'analytics', actions: ['VIEW'] },
        ],
        fleet_commander: [
            { resource: 'fleet', actions: ['VIEW', 'CREATE', 'EDIT', 'MANAGE'] },
            { resource: 'member', actions: ['VIEW'] },
            { resource: 'event', actions: ['VIEW', 'CREATE', 'EDIT'] },
            { resource: 'analytics', actions: ['VIEW'] },
        ],
        officer: [
            { resource: 'fleet', actions: ['VIEW', 'CREATE'] },
            { resource: 'member', actions: ['VIEW'] },
            { resource: 'event', actions: ['VIEW', 'CREATE'] },
            { resource: 'analytics', actions: ['VIEW'] },
        ],
        member: [
            { resource: 'fleet', actions: ['VIEW'] },
            { resource: 'member', actions: ['VIEW'] },
            { resource: 'event', actions: ['VIEW', 'CREATE'] },
        ],
        recruit: [
            { resource: 'fleet', actions: ['VIEW'] },
            { resource: 'member', actions: ['VIEW'] },
            { resource: 'event', actions: ['VIEW'] },
        ],
    };
    async up(queryRunner) {
        const rolesOrganizationIdColumnName = await this.resolveColumnName(queryRunner, 'roles', 'organizationId');
        const orgPermissionsOrganizationIdColumnName = await this.resolveColumnName(queryRunner, 'organization_permissions', 'organizationId');
        const orgPermissionsRoleIdColumnName = await this.resolveColumnName(queryRunner, 'organization_permissions', 'roleId');
        const orgPermissionsIsActiveColumnName = await this.resolveColumnName(queryRunner, 'organization_permissions', 'isActive');
        const orgPermissionsCreatedAtColumnName = await this.resolveColumnName(queryRunner, 'organization_permissions', 'createdAt');
        const orgPermissionsUpdatedAtColumnName = await this.resolveColumnName(queryRunner, 'organization_permissions', 'updatedAt');
        if (!rolesOrganizationIdColumnName ||
            !orgPermissionsOrganizationIdColumnName ||
            !orgPermissionsRoleIdColumnName ||
            !orgPermissionsIsActiveColumnName ||
            !orgPermissionsCreatedAtColumnName ||
            !orgPermissionsUpdatedAtColumnName) {
            return;
        }
        const roles = await queryRunner.query(`SELECT id, name, ${this.quoteIdentifier(rolesOrganizationIdColumnName)} AS "organizationId"
         FROM roles
         WHERE ${this.quoteIdentifier(rolesOrganizationIdColumnName)} IS NOT NULL`);
        let created = 0;
        for (const role of roles) {
            const permissions = this.defaultPermissions[role.name.toLowerCase()];
            if (!permissions) {
                continue;
            }
            for (const perm of permissions) {
                const existing = await queryRunner.query(`SELECT id FROM organization_permissions
           WHERE ${this.quoteIdentifier(orgPermissionsOrganizationIdColumnName)} = $1
             AND ${this.quoteIdentifier(orgPermissionsRoleIdColumnName)} = $2
             AND resource = $3
             AND ${this.quoteIdentifier(orgPermissionsIsActiveColumnName)} = true`, [role.organizationId, role.id, perm.resource]);
                if (existing.length > 0) {
                    continue;
                }
                await queryRunner.query(`INSERT INTO organization_permissions (
            id,
            ${this.quoteIdentifier(orgPermissionsOrganizationIdColumnName)},
            ${this.quoteIdentifier(orgPermissionsRoleIdColumnName)},
            resource,
            actions,
            scope,
            ${this.quoteIdentifier(orgPermissionsIsActiveColumnName)},
            priority,
            inheritable,
            inherited,
            reason,
            ${this.quoteIdentifier(orgPermissionsCreatedAtColumnName)},
            ${this.quoteIdentifier(orgPermissionsUpdatedAtColumnName)}
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, 'organization',
            true, 1, true, false, $5, NOW(), NOW()
          )`, [
                    role.organizationId,
                    role.id,
                    perm.resource,
                    JSON.stringify(perm.actions),
                    `Seeded from default ${role.name} permissions`,
                ]);
                created++;
            }
        }
        logger_1.logger.info(`Seeded ${created} role permission rows for existing organizations`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DELETE FROM organization_permissions WHERE reason LIKE 'Seeded from default %'`);
    }
}
exports.SeedRolePermissionsForExistingOrgs1827000000000 = SeedRolePermissionsForExistingOrgs1827000000000;
//# sourceMappingURL=1827000000000-SeedRolePermissionsForExistingOrgs.js.map