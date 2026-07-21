import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create `failed_dm_deliveries` table.
 *
 * Backs `FailedDmDelivery` entity — persistent retry queue for Discord DMs that
 * failed on the live attempt. Indexed on `nextRetryAt` (job scan), `expiresAt`
 * (TTL cleanup), and `recipientDiscordId` (per-user diagnostics).
 */
export class CreateFailedDmDeliveryTable1863100000000 implements MigrationInterface {
  name = 'CreateFailedDmDeliveryTable1863100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.getTable('failed_dm_deliveries');
    if (existing) {
      logger.warn('failed_dm_deliveries table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'failed_dm_deliveries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'recipientDiscordId', type: 'varchar', isNullable: false },
          { name: 'eventType', type: 'varchar', length: '64', isNullable: false },
          { name: 'guildId', type: 'varchar', isNullable: true },
          { name: 'content', type: 'text', isNullable: true },
          { name: 'embedJson', type: 'jsonb', isNullable: false },
          { name: 'attemptCount', type: 'int', default: 1, isNullable: false },
          { name: 'nextRetryAt', type: 'timestamp', isNullable: false },
          { name: 'lastError', type: 'text', isNullable: true },
          { name: 'expiresAt', type: 'timestamp', isNullable: false },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'failed_dm_deliveries',
      new TableIndex({
        name: 'IDX_failed_dm_deliveries_nextRetryAt',
        columnNames: ['nextRetryAt'],
      })
    );

    await queryRunner.createIndex(
      'failed_dm_deliveries',
      new TableIndex({
        name: 'IDX_failed_dm_deliveries_expiresAt',
        columnNames: ['expiresAt'],
      })
    );

    await queryRunner.createIndex(
      'failed_dm_deliveries',
      new TableIndex({
        name: 'IDX_failed_dm_deliveries_recipient',
        columnNames: ['recipientDiscordId'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('failed_dm_deliveries', 'IDX_failed_dm_deliveries_recipient');
    await queryRunner.dropIndex('failed_dm_deliveries', 'IDX_failed_dm_deliveries_expiresAt');
    await queryRunner.dropIndex('failed_dm_deliveries', 'IDX_failed_dm_deliveries_nextRetryAt');
    await queryRunner.dropTable('failed_dm_deliveries');
  }
}
