import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Add Multi-Tenancy Support to EventAttendanceConfirmation
 *
 * This migration adds organizationId to the event_attendance_confirmations table,
 * enabling tenant isolation for attendance tracking.
 *
 * Strategy:
 * 1. Add organizationId column (nullable first)
 * 2. Add sharedWithOrgs column for cross-tenant sharing
 * 3. Migrate existing data (derive from event's organizationId)
 * 4. Make organizationId NOT NULL
 * 5. Add indexes for tenant-scoped queries
 * 6. Add foreign key constraint
 *
 * Rollback: Fully supported - removes all tenant-related changes
 */
export class AddOrganizationIdToEventAttendanceConfirmation1760791393000 implements MigrationInterface {
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
    logger.info('Starting multi-tenancy migration for event_attendance_confirmations...');

    // Check if table exists first
    const table = await queryRunner.getTable('event_attendance_confirmations');
    if (!table) {
      logger.warn('event_attendance_confirmations table does not exist, skipping migration');
      logger.info('   (Table will be created by TypeORM synchronize or future migration)');
      return;
    }

    // Check if organizationId already exists
    const orgIdColumn = await this.resolveColumnName(
      queryRunner,
      'event_attendance_confirmations',
      'organizationId'
    );
    if (orgIdColumn) {
      logger.warn(`organizationId column already exists as ${orgIdColumn}, skipping migration`);
      return;
    }

    // ========== STEP 1: Add organizationId column (nullable) ==========
    logger.info('Step 1: Adding organizationId column...');
    await queryRunner.addColumn(
      'event_attendance_confirmations',
      new TableColumn({
        name: 'organizationId',
        type: 'varchar',
        length: '255',
        isNullable: true,
      })
    );

    // ========== STEP 2: Add sharedWithOrgs column ==========
    logger.info('Step 2: Adding sharedWithOrgs column...');
    await queryRunner.addColumn(
      'event_attendance_confirmations',
      new TableColumn({
        name: 'sharedWithOrgs',
        type: 'text',
        isNullable: true,
        isArray: true,
        default: "'{}'",
        comment: 'Array of organization IDs this confirmation is shared with',
      })
    );

    // ========== STEP 3: Migrate existing data ==========
    logger.info('Step 3: Migrating existing data...');

    // Option 1: Derive organizationId from the event (Activity)
    // Most confirmations should link to an activity/event
    await queryRunner.query(`
            UPDATE event_attendance_confirmations eac
            SET organizationId = a.organizationId
            FROM activities a
            WHERE eac.eventId = a.id
              AND a.organizationId IS NOT NULL
              AND eac.organizationId IS NULL
        `);

    // Option 2: For orphaned records (no matching event), use user's active org
    await queryRunner.query(`
            UPDATE event_attendance_confirmations eac
            SET organizationId = u.activeOrgId
            FROM users u
            WHERE eac.userId = u.id
              AND u.activeOrgId IS NOT NULL
              AND eac.organizationId IS NULL
        `);

    // Option 3: Create default organization for any remaining orphaned confirmations
    await queryRunner.query(`
            INSERT INTO organizations (id, name, type, status, level, path, createdAt, updatedAt)
            VALUES (
                'default-org',
                'Default Organization',
                'root',
                'active',
                0,
                'default-org',
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO NOTHING
        `);

    // Assign orphaned confirmations to default org
    await queryRunner.query(`
            UPDATE event_attendance_confirmations
            SET organizationId = 'default-org'
            WHERE organizationId IS NULL
        `);

    // ========== STEP 4: Make organizationId NOT NULL ==========
    logger.info('Step 4: Making organizationId NOT NULL...');
    await queryRunner.changeColumn(
      'event_attendance_confirmations',
      'organizationId',
      new TableColumn({
        name: 'organizationId',
        type: 'varchar',
        length: '255',
        isNullable: false,
      })
    );

    // ========== STEP 5: Create indexes for tenant-scoped queries ==========
    logger.info('Step 5: Creating indexes...');

    // Composite index: organizationId + eventId (most common query)
    await queryRunner.createIndex(
      'event_attendance_confirmations',
      new TableIndex({
        name: 'idx_event_attendance_org_event',
        columnNames: ['organizationId', 'eventId'],
      })
    );

    // Composite index: organizationId + userId
    await queryRunner.createIndex(
      'event_attendance_confirmations',
      new TableIndex({
        name: 'idx_event_attendance_org_user',
        columnNames: ['organizationId', 'userId'],
      })
    );

    // Composite index: organizationId + status
    await queryRunner.createIndex(
      'event_attendance_confirmations',
      new TableIndex({
        name: 'idx_event_attendance_org_status',
        columnNames: ['organizationId', 'status'],
      })
    );

    // Simple index on organizationId for foreign key
    await queryRunner.createIndex(
      'event_attendance_confirmations',
      new TableIndex({
        name: 'idx_event_attendance_org_id',
        columnNames: ['organizationId'],
      })
    );

    // ========== STEP 6: Add foreign key constraint ==========
    logger.info('Step 6: Adding foreign key constraint...');
    await queryRunner.createForeignKey(
      'event_attendance_confirmations',
      new TableForeignKey({
        name: 'fk_event_attendance_organization',
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT', // Prevent org deletion if confirmations exist
        onUpdate: 'CASCADE',
      })
    );

    logger.info('✅ Migration completed successfully!');
    logger.info('Summary:');

    const stats = await queryRunner.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT organizationId) as orgs,
                COUNT(DISTINCT eventId) as events
            FROM event_attendance_confirmations
        `);

    logger.info(`- Total confirmations: ${stats[0]?.total || 0}`);
    logger.info(`- Organizations: ${stats[0]?.orgs || 0}`);
    logger.info(`- Events tracked: ${stats[0]?.events || 0}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    logger.info('Rolling back multi-tenancy migration for event_attendance_confirmations...');

    // Remove foreign key
    logger.info('Removing foreign key constraint...');
    await queryRunner.dropForeignKey(
      'event_attendance_confirmations',
      'fk_event_attendance_organization'
    );

    // Remove indexes
    logger.info('Removing indexes...');
    await queryRunner.dropIndex('event_attendance_confirmations', 'idx_event_attendance_org_id');
    await queryRunner.dropIndex(
      'event_attendance_confirmations',
      'idx_event_attendance_org_status'
    );
    await queryRunner.dropIndex('event_attendance_confirmations', 'idx_event_attendance_org_user');
    await queryRunner.dropIndex('event_attendance_confirmations', 'idx_event_attendance_org_event');

    // Remove columns
    logger.info('Removing columns...');
    await queryRunner.dropColumn('event_attendance_confirmations', 'sharedWithOrgs');
    await queryRunner.dropColumn('event_attendance_confirmations', 'organizationId');

    logger.info('✅ Rollback completed successfully!');
  }
}
