import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Drops the orphan `security_events` table.
 *
 * Context (see docs/MIGRATION_AUDIT.md §1.2):
 * - Table was created by `1729350000000-CreateAdminPortalTables` and is also defined
 *   independently in `backend/schema/complete-schema.sql`.
 * - No TypeORM entity, no repository, no service ever writes to it. The two
 *   near-misses (`AdminSecurityLogService` and `AuditService.logSecurityEvent`) are
 *   both in-memory only — the former's storage is an explicit circular buffer with
 *   the inline comment "replace with database in production".
 * - Production count was verified to be zero before this migration was applied.
 *
 * Reversal recreates the table + 5 indexes mirroring the original definition so the
 * migration is fully reversible if a future iteration decides to persist security
 * events to PostgreSQL.
 */
export class DropSecurityEventsTable1863600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('security_events');
    if (!table) {
      logger.warn('security_events table does not exist, skipping drop');
      return;
    }
    // dropTable drops associated indexes automatically.
    await queryRunner.dropTable('security_events');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.getTable('security_events');
    if (existing) {
      logger.warn('security_events table already exists, skipping recreate');
      return;
    }

    logger.info('Recreating security_events table (migration rollback)');

    await queryRunner.createTable(
      new Table({
        name: 'security_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'timestamp',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          { name: 'type', type: 'varchar', length: '100', isNullable: false },
          { name: 'severity', type: 'varchar', length: '50', isNullable: false },
          { name: 'user_hash', type: 'varchar', length: '64', isNullable: true },
          { name: 'action', type: 'text', isNullable: false },
          { name: 'outcome', type: 'varchar', length: '50', isNullable: false },
          { name: 'ip_address', type: 'varchar', length: '50', isNullable: true },
          { name: 'user_agent', type: 'text', isNullable: true },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            default: null,
          },
        ],
      }),
      true
    );

    logger.info('Created security_events table; creating indexes');

    await queryRunner.createIndex(
      'security_events',
      new TableIndex({
        name: 'idx_security_events_timestamp',
        columnNames: ['timestamp'],
      })
    );

    await queryRunner.createIndex(
      'security_events',
      new TableIndex({
        name: 'idx_security_events_type',
        columnNames: ['type'],
      })
    );

    await queryRunner.createIndex(
      'security_events',
      new TableIndex({
        name: 'idx_security_events_severity',
        columnNames: ['severity'],
      })
    );

    await queryRunner.createIndex(
      'security_events',
      new TableIndex({
        name: 'idx_security_events_user_hash',
        columnNames: ['user_hash'],
      })
    );

    await queryRunner.createIndex(
      'security_events',
      new TableIndex({
        name: 'idx_security_events_timestamp_severity',
        columnNames: ['timestamp', 'severity'],
      })
    );

    logger.info('Created 5 security_events indexes (rollback complete)');
  }
}
