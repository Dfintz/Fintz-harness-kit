import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Add sharingLevel and sharedWithUsers to user_ships
 *
 * Adds the new sharingLevel enum column and sharedWithUsers array column
 * to replace the deprecated availableForOrg boolean field.
 *
 * Migration strategy:
 * 1. Add sharingLevel column (default: 'personal')
 * 2. Add sharedWithUsers column
 * 3. Migrate data: availableForOrg=true -> sharingLevel='organization'
 * 4. Add index on sharingLevel for performance
 */
export class AddSharingLevelToUserShips1763400000000 implements MigrationInterface {
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
    // Check if user_ships table exists
    const table = await queryRunner.getTable('user_ships');
    if (!table) {
      logger.warn('user_ships table does not exist, skipping migration');
      return;
    }

    // Check if columns already exist
    const sharingLevelColumn = await this.resolveColumnName(
      queryRunner,
      'user_ships',
      'sharingLevel'
    );
    if (sharingLevelColumn) {
      logger.warn('sharingLevel column already exists, skipping migration');
      return;
    }

    // Create enum type for sharing level
    await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE ship_sharing_level AS ENUM ('personal', 'shared_users', 'organization', 'alliance');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

    // Add sharingLevel column
    await queryRunner.addColumn(
      'user_ships',
      new TableColumn({
        name: 'sharingLevel',
        type: 'ship_sharing_level',
        default: "'personal'",
        isNullable: false,
      })
    );

    // Add sharedWithUsers column
    await queryRunner.addColumn(
      'user_ships',
      new TableColumn({
        name: 'sharedWithUsers',
        type: 'text',
        isNullable: true,
      })
    );

    // Migrate existing data: set sharingLevel='organization' where availableForOrg=true
    const availableForOrgColumn = await this.resolveColumnName(
      queryRunner,
      'user_ships',
      'availableForOrg'
    );
    if (availableForOrgColumn) {
      await queryRunner.query(`
                UPDATE user_ships 
                SET "sharingLevel" = 'organization' 
                WHERE "${availableForOrgColumn}" = true
            `);
    }

    // Add index for sharingLevel queries
    await queryRunner.createIndex(
      'user_ships',
      new TableIndex({
        name: 'IDX_USER_SHIPS_SHARING_LEVEL',
        columnNames: ['sharingLevel'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.dropIndex('user_ships', 'IDX_USER_SHIPS_SHARING_LEVEL');

    // Drop columns
    await queryRunner.dropColumn('user_ships', 'sharedWithUsers');
    await queryRunner.dropColumn('user_ships', 'sharingLevel');

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS ship_sharing_level`);
  }
}
