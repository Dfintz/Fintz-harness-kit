import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix foreign key cascade behaviors across all entities.
 *
 * Critical fixes:
 * - LegalHold → User: CASCADE → RESTRICT (prevent deleting users under legal hold)
 * - DeletionRequest → User: CASCADE → SET NULL (preserve GDPR audit trail)
 * - ExportRequest → User: CASCADE → SET NULL (preserve GDPR audit trail)
 *
 * Also adds explicit onDelete to 29 @ManyToOne relationships that previously
 * relied on database defaults (NO ACTION).
 */
export class FixForeignKeyCascades1770300000001 implements MigrationInterface {
  name = 'FixForeignKeyCascades1770300000000';

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

  private async dropNotNullIfColumnExists(
    queryRunner: QueryRunner,
    table: string,
    column: string
  ): Promise<void> {
    const actualColumn = await this.resolveColumnName(queryRunner, table, column);
    if (!actualColumn) {
      return;
    }

    await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${actualColumn}" DROP NOT NULL`);
  }

  private async setNotNullIfColumnExists(
    queryRunner: QueryRunner,
    table: string,
    column: string
  ): Promise<void> {
    const actualColumn = await this.resolveColumnName(queryRunner, table, column);
    if (!actualColumn) {
      return;
    }

    await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${actualColumn}" SET NOT NULL`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // CRITICAL: LegalHold → User: CASCADE → RESTRICT
    // Prevents user deletion while legal hold is active
    // ============================================================
    await this.replaceForeignKey(queryRunner, 'legal_holds', 'userId', 'users', 'id', 'RESTRICT');

    // ============================================================
    // CRITICAL: DeletionRequest → User: CASCADE → SET NULL
    // Preserves GDPR deletion audit trail after user removal
    // ============================================================
    await this.dropNotNullIfColumnExists(queryRunner, 'deletion_requests', 'userId');
    await this.replaceForeignKey(
      queryRunner,
      'deletion_requests',
      'userId',
      'users',
      'id',
      'SET NULL'
    );

    // ============================================================
    // CRITICAL: ExportRequest → User: CASCADE → SET NULL
    // Preserves GDPR export audit trail after user removal
    // ============================================================
    await this.dropNotNullIfColumnExists(queryRunner, 'export_requests', 'userId');
    await this.replaceForeignKey(
      queryRunner,
      'export_requests',
      'userId',
      'users',
      'id',
      'SET NULL'
    );

    // ============================================================
    // FleetMember → User: CASCADE
    // ============================================================
    await this.replaceForeignKey(queryRunner, 'fleet_members', 'userId', 'users', 'id', 'CASCADE');

    // ============================================================
    // OrganizationMembership → User: CASCADE, Organization: CASCADE, Role: RESTRICT
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'organization_memberships',
      'userId',
      'users',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'organization_memberships',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'organization_memberships',
      'roleId',
      'roles',
      'id',
      'RESTRICT'
    );

    // ============================================================
    // GuildOrganization → Organization: CASCADE
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'guild_organizations',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );

    // ============================================================
    // UserSession → User: CASCADE
    // ============================================================
    await this.replaceForeignKey(queryRunner, 'user_sessions', 'userId', 'users', 'id', 'CASCADE');

    // ============================================================
    // Organization → Organization (parent): SET NULL
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'organizations',
      'parentOrgId',
      'organizations',
      'id',
      'SET NULL'
    );

    // ============================================================
    // OrganizationAnalytics → Organization: CASCADE
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'organization_analytics',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );

    // ============================================================
    // OrganizationTemplate → OrganizationTemplate (forkedFrom): SET NULL
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'organization_templates',
      'forkedFrom',
      'organization_templates',
      'id',
      'SET NULL'
    );

    // ============================================================
    // Intel Domain — IntelApproval
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'intel_approvals',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_approvals',
      'intelEntryId',
      'intel_entries',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_approvals',
      'requestedBy',
      'users',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_approvals',
      'completedBy',
      'users',
      'id',
      'SET NULL'
    );

    // ============================================================
    // Intel Domain — IntelEntry
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'intel_entries',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_entries',
      'createdBy',
      'users',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_entries',
      'updatedBy',
      'users',
      'id',
      'SET NULL'
    );

    // ============================================================
    // Intel Domain — IntelOfficer
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'intel_officers',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(queryRunner, 'intel_officers', 'userId', 'users', 'id', 'CASCADE');
    await this.replaceForeignKey(
      queryRunner,
      'intel_officers',
      'appointedBy',
      'users',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_officers',
      'revokedBy',
      'users',
      'id',
      'SET NULL'
    );

    // ============================================================
    // Intel Domain — IntelAuditLog
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'intel_audit_logs',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_audit_logs',
      'userId',
      'users',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_audit_logs',
      'intelEntryId',
      'intel_entries',
      'id',
      'SET NULL'
    );

    // ============================================================
    // Intel Domain — IntelShare
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'intel_shares',
      'intelEntryId',
      'intel_entries',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_shares',
      'sourceOrganizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_shares',
      'targetOrganizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(queryRunner, 'intel_shares', 'sharedBy', 'users', 'id', 'CASCADE');
    await this.replaceForeignKey(
      queryRunner,
      'intel_shares',
      'acceptedBy',
      'users',
      'id',
      'SET NULL'
    );
    await this.replaceForeignKey(
      queryRunner,
      'intel_shares',
      'revokedBy',
      'users',
      'id',
      'SET NULL'
    );

    // ============================================================
    // MirrorAction → ModerationIncident: SET NULL
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'mirror_actions',
      'sourceIncidentId',
      'moderation_incidents',
      'id',
      'SET NULL'
    );

    // ============================================================
    // PublicJobListing → Organization: CASCADE
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'public_job_listings',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );

    // ============================================================
    // RSI Domain
    // ============================================================
    await this.replaceForeignKey(
      queryRunner,
      'rsi_sync_audit_logs',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(
      queryRunner,
      'rsi_sync_schedules',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );
    await this.replaceForeignKey(queryRunner, 'rsi_user_links', 'userId', 'users', 'id', 'CASCADE');
    await this.replaceForeignKey(
      queryRunner,
      'rsi_user_links',
      'organizationId',
      'organizations',
      'id',
      'CASCADE'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * WARNING: This down migration may fail if users were deleted while the up migration was applied,
     * as those deletion_requests and export_requests will have userId = NULL.
     *
     * Recovery options if down() fails:
     * 1. Delete orphaned records:
     *    - DELETE FROM deletion_requests WHERE userId IS NULL;
     *    - DELETE FROM export_requests WHERE userId IS NULL;
     * 2. Backfill with placeholder user:
     *    - UPDATE deletion_requests SET userId = '<deleted-user-id>' WHERE userId IS NULL;
     *    - UPDATE export_requests SET userId = '<deleted-user-id>' WHERE userId IS NULL;
     * 3. Accept that the migration is irreversible in production
     *
     * In production, consider this migration intentionally irreversible.
     */

    // Revert critical fixes back to CASCADE
    await this.replaceForeignKey(queryRunner, 'legal_holds', 'userId', 'users', 'id', 'CASCADE');

    await this.replaceForeignKey(
      queryRunner,
      'deletion_requests',
      'userId',
      'users',
      'id',
      'CASCADE'
    );
    // This will fail if any deletion_requests have userId = NULL
    await this.setNotNullIfColumnExists(queryRunner, 'deletion_requests', 'userId');

    await this.replaceForeignKey(
      queryRunner,
      'export_requests',
      'userId',
      'users',
      'id',
      'CASCADE'
    );
    // This will fail if any export_requests have userId = NULL
    await this.setNotNullIfColumnExists(queryRunner, 'export_requests', 'userId');

    // Revert all other FKs to NO ACTION (TypeORM default when no onDelete specified)
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

  /**
   * Helper to drop existing FK constraint on a column and create a new one
   * with the specified onDelete behavior.
   */
  private async replaceForeignKey(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    refTable: string,
    refColumn: string,
    onDelete: string
  ): Promise<void> {
    // Skip if the table doesn't exist yet (e.g. optional features not migrated)
    const tableExists = await queryRunner.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      )`,
      [table]
    );
    if (!tableExists[0]?.exists) {
      return;
    }

    const actualColumn = await this.resolveColumnName(queryRunner, table, column);
    const actualRefColumn = await this.resolveColumnName(queryRunner, refTable, refColumn);
    if (!actualColumn || !actualRefColumn) {
      return;
    }

    // Find the existing FK constraint name
    const fkConstraints = await queryRunner.query(
      `SELECT tc.constraint_name
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_name = $1
               AND LOWER(kcu.column_name) = LOWER($2)`,
      [table, actualColumn]
    );

    // Drop existing FK(s) on this column
    for (const fk of fkConstraints) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk.constraint_name}"`);
    }

    // Create new FK with correct onDelete
    const constraintName = `FK_${table}_${column}`;
    await queryRunner.query(
      `ALTER TABLE "${table}"
             ADD CONSTRAINT "${constraintName}"
             FOREIGN KEY ("${actualColumn}")
             REFERENCES "${refTable}"("${actualRefColumn}")
             ON DELETE ${onDelete}`
    );
  }
}
