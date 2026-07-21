import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Notification Preferences Table
 *
 * Creates the notification_preferences table for storing per-user
 * notification channel/category toggles and digest frequency.
 *
 * Related Entity: NotificationPreferences
 */
export class CreateNotificationPreferencesTable1763000000002 implements MigrationInterface {
  name = 'CreateNotificationPreferencesTable1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existingTable = await queryRunner.getTable('notification_preferences');
    if (existingTable) {
      logger.warn('notification_preferences table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'notification_preferences',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'varchar',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'muteAll',
            type: 'boolean',
            default: false,
          },
          {
            name: 'channels',
            type: 'jsonb',
            default: `'{"inApp":true,"email":false,"discord":true}'`,
          },
          {
            name: 'categories',
            type: 'jsonb',
            default: `'{"fleet":true,"activity":true,"organization":true,"trade":true,"social":true,"security":true,"system":true}'`,
          },
          {
            name: 'digestFrequency',
            type: 'varchar',
            length: '10',
            default: `'daily'`,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Unique index on userId
    await queryRunner.createIndex(
      'notification_preferences',
      new TableIndex({
        name: 'IDX_notification_preferences_userId',
        columnNames: ['userId'],
        isUnique: true,
      })
    );

    // Foreign key to users table
    await queryRunner.createForeignKey(
      'notification_preferences',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_notification_preferences_userId',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'notification_preferences',
      'FK_notification_preferences_userId'
    );
    await queryRunner.dropIndex('notification_preferences', 'IDX_notification_preferences_userId');
    await queryRunner.dropTable('notification_preferences');
  }
}
