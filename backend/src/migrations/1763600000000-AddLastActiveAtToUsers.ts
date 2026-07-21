import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Add lastActiveAt to users table
 *
 * Adds a lastActiveAt timestamp field to track when users were last active
 * in the system. This enables active member tracking for organizations.
 *
 * Active members are defined as users who have been active within the last 30 days.
 */
export class AddLastActiveAtToUsers1763600000000 implements MigrationInterface {
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
    // Check if users table exists
    const table = await queryRunner.getTable('users');
    if (!table) {
      logger.warn('users table does not exist, skipping migration');
      return;
    }

    // Check if column already exists (may be from base migration or previous migration run)
    const lastActiveAtColumn = await this.resolveColumnName(queryRunner, 'users', 'lastActiveAt');
    if (lastActiveAtColumn) {
      logger.info('  lastActiveAt column already exists, skipping');
      return;
    }

    // Add lastActiveAt column to users table
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lastActiveAt',
        type: 'timestamp',
        isNullable: true,
        comment: 'Timestamp of last user activity for active member tracking',
      })
    );

    // Initialize lastActiveAt with lastLoginAt for existing users
    // This provides a reasonable starting point for activity tracking
    const lastLoginAtColumn = await this.resolveColumnName(queryRunner, 'users', 'lastLoginAt');
    if (lastLoginAtColumn) {
      await queryRunner.query(`
                UPDATE users 
                SET "lastActiveAt" = "${lastLoginAtColumn}" 
                WHERE "${lastLoginAtColumn}" IS NOT NULL
            `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the lastActiveAt column if rolling back
    await queryRunner.dropColumn('users', 'lastActiveAt');
  }
}
