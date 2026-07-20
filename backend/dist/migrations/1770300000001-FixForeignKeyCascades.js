"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixForeignKeyCascades1770300000001 = void 0;
class FixForeignKeyCascades1770300000001 {
    name = 'FixForeignKeyCascades1770300000000';
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
    async dropNotNullIfColumnExists(queryRunner, table, column) {
        const actualColumn = await this.resolveColumnName(queryRunner, table, column);
        if (!actualColumn) {
            return;
        }
        await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${actualColumn}" DROP NOT NULL`);
    }
    async setNotNullIfColumnExists(queryRunner, table, column) {
        const actualColumn = await this.resolveColumnName(queryRunner, table, column);
        if (!actualColumn) {
            return;
        }
        await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${actualColumn}" SET NOT NULL`);
    }
    async up(queryRunner) {
        await this.replaceForeignKey(queryRunner, 'legal_holds', 'userId', 'users', 'id', 'RESTRICT');
        await this.dropNotNullIfColumnExists(queryRunner, 'deletion_requests', 'userId');
        await this.replaceForeignKey(queryRunner, 'deletion_requests', 'userId', 'users', 'id', 'SET NULL');
        await this.dropNotNullIfColumnExists(queryRunner, 'export_requests', 'userId');
        await this.replaceForeignKey(queryRunner, 'export_requests', 'userId', 'users', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'fleet_members', 'userId', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'organization_memberships', 'userId', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'organization_memberships', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'organization_memberships', 'roleId', 'roles', 'id', 'RESTRICT');
        await this.replaceForeignKey(queryRunner, 'guild_organizations', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'user_sessions', 'userId', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'organizations', 'parentOrgId', 'organizations', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'organization_analytics', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'organization_templates', 'forkedFrom', 'organization_templates', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'intel_approvals', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_approvals', 'intelEntryId', 'intel_entries', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_approvals', 'requestedBy', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_approvals', 'completedBy', 'users', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'intel_entries', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_entries', 'createdBy', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_entries', 'updatedBy', 'users', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'intel_officers', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_officers', 'userId', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_officers', 'appointedBy', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_officers', 'revokedBy', 'users', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'intel_audit_logs', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_audit_logs', 'userId', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_audit_logs', 'intelEntryId', 'intel_entries', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'intel_shares', 'intelEntryId', 'intel_entries', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_shares', 'sourceOrganizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_shares', 'targetOrganizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_shares', 'sharedBy', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'intel_shares', 'acceptedBy', 'users', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'intel_shares', 'revokedBy', 'users', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'mirror_actions', 'sourceIncidentId', 'moderation_incidents', 'id', 'SET NULL');
        await this.replaceForeignKey(queryRunner, 'public_job_listings', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'rsi_sync_audit_logs', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'rsi_sync_schedules', 'organizationId', 'organizations', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'rsi_user_links', 'userId', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'rsi_user_links', 'organizationId', 'organizations', 'id', 'CASCADE');
    }
    async down(queryRunner) {
        await this.replaceForeignKey(queryRunner, 'legal_holds', 'userId', 'users', 'id', 'CASCADE');
        await this.replaceForeignKey(queryRunner, 'deletion_requests', 'userId', 'users', 'id', 'CASCADE');
        await this.setNotNullIfColumnExists(queryRunner, 'deletion_requests', 'userId');
        await this.replaceForeignKey(queryRunner, 'export_requests', 'userId', 'users', 'id', 'CASCADE');
        await this.setNotNullIfColumnExists(queryRunner, 'export_requests', 'userId');
        const noActionFks = [
            { table: 'fleet_members', col: 'userId', ref: 'users' },
            { table: 'organization_memberships', col: 'userId', ref: 'users' },
            { table: 'organization_memberships', col: 'organizationId', ref: 'organizations' },
            { table: 'organization_memberships', col: 'roleId', ref: 'roles' },
            { table: 'guild_organizations', col: 'organizationId', ref: 'organizations' },
            { table: 'user_sessions', col: 'userId', ref: 'users' },
            { table: 'organizations', col: 'parentOrgId', ref: 'organizations' },
            { table: 'organization_analytics', col: 'organizationId', ref: 'organizations' },
            { table: 'organization_templates', col: 'forkedFrom', ref: 'organization_templates' },
            { table: 'intel_approvals', col: 'organizationId', ref: 'organizations' },
            { table: 'intel_approvals', col: 'intelEntryId', ref: 'intel_entries' },
            { table: 'intel_approvals', col: 'requestedBy', ref: 'users' },
            { table: 'intel_approvals', col: 'completedBy', ref: 'users' },
            { table: 'intel_entries', col: 'organizationId', ref: 'organizations' },
            { table: 'intel_entries', col: 'createdBy', ref: 'users' },
            { table: 'intel_entries', col: 'updatedBy', ref: 'users' },
            { table: 'intel_officers', col: 'organizationId', ref: 'organizations' },
            { table: 'intel_officers', col: 'userId', ref: 'users' },
            { table: 'intel_officers', col: 'appointedBy', ref: 'users' },
            { table: 'intel_officers', col: 'revokedBy', ref: 'users' },
            { table: 'intel_audit_logs', col: 'organizationId', ref: 'organizations' },
            { table: 'intel_audit_logs', col: 'userId', ref: 'users' },
            { table: 'intel_audit_logs', col: 'intelEntryId', ref: 'intel_entries' },
            { table: 'intel_shares', col: 'intelEntryId', ref: 'intel_entries' },
            { table: 'intel_shares', col: 'sourceOrganizationId', ref: 'organizations' },
            { table: 'intel_shares', col: 'targetOrganizationId', ref: 'organizations' },
            { table: 'intel_shares', col: 'sharedBy', ref: 'users' },
            { table: 'intel_shares', col: 'acceptedBy', ref: 'users' },
            { table: 'intel_shares', col: 'revokedBy', ref: 'users' },
            { table: 'mirror_actions', col: 'sourceIncidentId', ref: 'moderation_incidents' },
            { table: 'public_job_listings', col: 'organizationId', ref: 'organizations' },
            { table: 'rsi_sync_audit_logs', col: 'organizationId', ref: 'organizations' },
            { table: 'rsi_sync_schedules', col: 'organizationId', ref: 'organizations' },
            { table: 'rsi_user_links', col: 'userId', ref: 'users' },
            { table: 'rsi_user_links', col: 'organizationId', ref: 'organizations' },
        ];
        for (const fk of noActionFks) {
            await this.replaceForeignKey(queryRunner, fk.table, fk.col, fk.ref, 'id', 'NO ACTION');
        }
    }
    async replaceForeignKey(queryRunner, table, column, refTable, refColumn, onDelete) {
        const tableExists = await queryRunner.query(`SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      )`, [table]);
        if (!tableExists[0]?.exists) {
            return;
        }
        const actualColumn = await this.resolveColumnName(queryRunner, table, column);
        const actualRefColumn = await this.resolveColumnName(queryRunner, refTable, refColumn);
        if (!actualColumn || !actualRefColumn) {
            return;
        }
        const fkConstraints = await queryRunner.query(`SELECT tc.constraint_name
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_name = $1
               AND LOWER(kcu.column_name) = LOWER($2)`, [table, actualColumn]);
        for (const fk of fkConstraints) {
            await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk.constraint_name}"`);
        }
        const constraintName = `FK_${table}_${column}`;
        await queryRunner.query(`ALTER TABLE "${table}"
             ADD CONSTRAINT "${constraintName}"
             FOREIGN KEY ("${actualColumn}")
             REFERENCES "${refTable}"("${actualRefColumn}")
             ON DELETE ${onDelete}`);
    }
}
exports.FixForeignKeyCascades1770300000001 = FixForeignKeyCascades1770300000001;
//# sourceMappingURL=1770300000001-FixForeignKeyCascades.js.map