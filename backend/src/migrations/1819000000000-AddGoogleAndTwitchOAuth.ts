import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * AddGoogleAndTwitchOAuth
 *
 * Adds `googleId` and `twitchId` columns to the `users` table
 * for Google and Twitch OAuth SSO support.
 *
 * Unique partial indexes prevent duplicate provider IDs while
 * allowing multiple NULL values (users who haven't linked).
 *
 * Idempotent: guards DDL statements to allow safe re-runs.
 */
export class AddGoogleAndTwitchOAuth1819000000000 implements MigrationInterface {
  name = 'AddGoogleAndTwitchOAuth1819000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) {
      return;
    }

    // Add googleId column
    const hasGoogleId = table.columns.some(c => c.name === 'googleId');
    if (!hasGoogleId) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'googleId',
          type: 'varchar',
          isNullable: true,
        })
      );
    }

    // Add twitchId column
    const hasTwitchId = table.columns.some(c => c.name === 'twitchId');
    if (!hasTwitchId) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'twitchId',
          type: 'varchar',
          isNullable: true,
        })
      );
    }

    // Unique partial index on googleId (WHERE googleId IS NOT NULL)
    const hasGoogleIdx = table.indices.some(i => i.name === 'IDX_users_googleId');
    if (!hasGoogleIdx) {
      await queryRunner.createIndex(
        'users',
        new TableIndex({
          name: 'IDX_users_googleId',
          columnNames: ['googleId'],
          isUnique: true,
          where: '"googleId" IS NOT NULL',
        })
      );
    }

    // Unique partial index on twitchId (WHERE twitchId IS NOT NULL)
    const hasTwitchIdx = table.indices.some(i => i.name === 'IDX_users_twitchId');
    if (!hasTwitchIdx) {
      await queryRunner.createIndex(
        'users',
        new TableIndex({
          name: 'IDX_users_twitchId',
          columnNames: ['twitchId'],
          isUnique: true,
          where: '"twitchId" IS NOT NULL',
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) {
      return;
    }

    if (table.indices.some(i => i.name === 'IDX_users_twitchId')) {
      await queryRunner.dropIndex('users', 'IDX_users_twitchId');
    }

    if (table.indices.some(i => i.name === 'IDX_users_googleId')) {
      await queryRunner.dropIndex('users', 'IDX_users_googleId');
    }

    if (table.columns.some(c => c.name === 'twitchId')) {
      await queryRunner.dropColumn('users', 'twitchId');
    }

    if (table.columns.some(c => c.name === 'googleId')) {
      await queryRunner.dropColumn('users', 'googleId');
    }
  }
}
