import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Add Tunnel Message Editing Support
 *
 * Adds isEdited and editedAt columns to tunnel_messages
 * to track when relayed messages are edited in Discord.
 * Relay ID mapping (channelId → webhookMessageId) is stored in Redis with TTL.
 */
export class AddTunnelMessageEditing1862200000000 implements MigrationInterface {
  name = 'AddTunnelMessageEditing1862200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tunnel_messages');
    if (!table) {
      logger.warn('tunnel_messages table not found — skipping migration');
      return;
    }

    if (!table.findColumnByName('isEdited')) {
      await queryRunner.addColumn(
        'tunnel_messages',
        new TableColumn({
          name: 'isEdited',
          type: 'boolean',
          default: false,
          isNullable: false,
        })
      );
      logger.info('Added isEdited column to tunnel_messages');
    }

    if (!table.findColumnByName('editedAt')) {
      await queryRunner.addColumn(
        'tunnel_messages',
        new TableColumn({
          name: 'editedAt',
          type: 'timestamp',
          isNullable: true,
        })
      );
      logger.info('Added editedAt column to tunnel_messages');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tunnel_messages');
    if (!table) {
      return;
    }

    if (table.findColumnByName('editedAt')) {
      await queryRunner.dropColumn('tunnel_messages', 'editedAt');
    }
    if (table.findColumnByName('isEdited')) {
      await queryRunner.dropColumn('tunnel_messages', 'isEdited');
    }
  }
}
