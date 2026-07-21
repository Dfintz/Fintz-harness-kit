import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration to create notifications table
 * Stores in-app notifications delivered to users.
 */
export class CreateNotificationsTable1764860000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existingTable = await queryRunner.getTable('notifications');
    if (existingTable) {
      logger.warn('notifications table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'notifications',
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
          },
          {
            name: 'senderId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'varchar',
            default: "'info'",
            isNullable: false,
          },
          {
            name: 'priority',
            type: 'varchar',
            default: "'normal'",
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'read',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'readAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Index on userId (most queries filter by recipient)
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_userId',
        columnNames: ['userId'],
      })
    );

    // Composite index for "unread notifications per user" endpoint
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_userId_read',
        columnNames: ['userId', 'read'],
      })
    );

    // Composite index for "recent notifications" listing (userId + createdAt DESC)
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_userId_createdAt',
        columnNames: ['userId', 'createdAt'],
      })
    );

    // Index on type for filtering by notification category
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_type',
        columnNames: ['type'],
      })
    );

    // Foreign key: userId → users.id (CASCADE delete)
    await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_notifications_userId"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE
        `);

    // Foreign key: senderId → users.id (SET NULL)
    await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_notifications_senderId"
            FOREIGN KEY ("senderId") REFERENCES "users"("id")
            ON DELETE SET NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notifications', true);
  }
}
