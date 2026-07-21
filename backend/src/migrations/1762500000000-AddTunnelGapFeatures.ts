import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Add Tunnel Gap Features
 *
 * Adds invite codes, bot message relay, max connected servers to tunnels table.
 * Creates tunnel_messages, tunnel_bans, and tunnel_analytics tables for
 * message persistence, moderation, and analytics.
 */
export class AddTunnelGapFeatures1762500000000 implements MigrationInterface {
  name = 'AddTunnelGapFeatures1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== ALTER tunnels TABLE ====================
    const tunnelsTable = await queryRunner.getTable('tunnels');
    if (tunnelsTable) {
      // Add inviteCode column if not exists
      if (!tunnelsTable.findColumnByName('inviteCode')) {
        await queryRunner.addColumn(
          'tunnels',
          new TableColumn({
            name: 'inviteCode',
            type: 'varchar',
            isNullable: true, // nullable initially to populate existing rows
            isUnique: true,
          })
        );
        await queryRunner.createIndex(
          'tunnels',
          new TableIndex({
            name: 'IDX_tunnel_invite_code',
            columnNames: ['inviteCode'],
            isUnique: true,
          })
        );
        logger.info('Added inviteCode column to tunnels table');
      }

      // Add allowBotMessages column if not exists
      if (!tunnelsTable.findColumnByName('allowBotMessages')) {
        await queryRunner.addColumn(
          'tunnels',
          new TableColumn({
            name: 'allowBotMessages',
            type: 'boolean',
            default: true,
          })
        );
        logger.info('Added allowBotMessages column to tunnels table');
      }

      // Add maxConnectedServers column if not exists
      if (!tunnelsTable.findColumnByName('maxConnectedServers')) {
        await queryRunner.addColumn(
          'tunnels',
          new TableColumn({
            name: 'maxConnectedServers',
            type: 'integer',
            default: 0,
          })
        );
        logger.info('Added maxConnectedServers column to tunnels table');
      }
    } else {
      logger.warn('tunnels table not found, skipping column additions');
    }

    // ==================== CREATE tunnel_messages TABLE ====================
    const existingMessages = await queryRunner.getTable('tunnel_messages');
    if (existingMessages) {
      logger.warn('tunnel_messages table already exists, skipping creation');
    } else {
      await queryRunner.createTable(
        new Table({
          name: 'tunnel_messages',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'tunnelId', type: 'uuid', isNullable: false },
            { name: 'authorId', type: 'varchar', isNullable: false },
            { name: 'authorName', type: 'varchar', isNullable: false },
            { name: 'authorAvatar', type: 'varchar', isNullable: true },
            { name: 'sourceGuildId', type: 'varchar', isNullable: true },
            { name: 'sourceChannelId', type: 'varchar', isNullable: true },
            { name: 'discordMessageId', type: 'varchar', isNullable: true },
            { name: 'content', type: 'text', isNullable: true },
            { name: 'attachments', type: 'text', isNullable: true },
            { name: 'embeds', type: 'text', isNullable: true },
            { name: 'stickerIds', type: 'text', isNullable: true },
            { name: 'replyToMessageId', type: 'varchar', isNullable: true },
            { name: 'isBot', type: 'boolean', default: false },
            { name: 'wasBlocked', type: 'boolean', default: false },
            { name: 'blockReason', type: 'varchar', isNullable: true },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      await queryRunner.createForeignKey(
        'tunnel_messages',
        new TableForeignKey({
          name: 'FK_tunnel_messages_tunnel',
          columnNames: ['tunnelId'],
          referencedTableName: 'tunnels',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      await queryRunner.createIndex(
        'tunnel_messages',
        new TableIndex({
          name: 'IDX_tunnel_message_tunnel',
          columnNames: ['tunnelId'],
        })
      );
      await queryRunner.createIndex(
        'tunnel_messages',
        new TableIndex({
          name: 'IDX_tunnel_message_tunnel_timestamp',
          columnNames: ['tunnelId', 'createdAt'],
        })
      );
      await queryRunner.createIndex(
        'tunnel_messages',
        new TableIndex({
          name: 'IDX_tunnel_message_discord_id',
          columnNames: ['discordMessageId'],
        })
      );

      logger.info('Created tunnel_messages table');
    }

    // ==================== CREATE tunnel_bans TABLE ====================
    const existingBans = await queryRunner.getTable('tunnel_bans');
    if (existingBans) {
      logger.warn('tunnel_bans table already exists, skipping creation');
    } else {
      await queryRunner.createTable(
        new Table({
          name: 'tunnel_bans',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'tunnelId', type: 'uuid', isNullable: false },
            { name: 'userId', type: 'varchar', isNullable: false },
            { name: 'username', type: 'varchar', isNullable: true },
            { name: 'type', type: 'varchar', length: '10', isNullable: false },
            { name: 'reason', type: 'varchar', isNullable: true },
            { name: 'issuedBy', type: 'varchar', isNullable: false },
            { name: 'expiresAt', type: 'timestamp', isNullable: true },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      await queryRunner.createForeignKey(
        'tunnel_bans',
        new TableForeignKey({
          name: 'FK_tunnel_bans_tunnel',
          columnNames: ['tunnelId'],
          referencedTableName: 'tunnels',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      await queryRunner.createIndex(
        'tunnel_bans',
        new TableIndex({
          name: 'IDX_tunnel_ban_user_tunnel',
          columnNames: ['tunnelId', 'userId'],
          isUnique: true,
        })
      );
      await queryRunner.createIndex(
        'tunnel_bans',
        new TableIndex({
          name: 'IDX_tunnel_ban_tunnel',
          columnNames: ['tunnelId'],
        })
      );
      await queryRunner.createIndex(
        'tunnel_bans',
        new TableIndex({
          name: 'IDX_tunnel_ban_user',
          columnNames: ['userId'],
        })
      );

      logger.info('Created tunnel_bans table');
    }

    // ==================== CREATE tunnel_analytics TABLE ====================
    const existingAnalytics = await queryRunner.getTable('tunnel_analytics');
    if (existingAnalytics) {
      logger.warn('tunnel_analytics table already exists, skipping creation');
    } else {
      await queryRunner.createTable(
        new Table({
          name: 'tunnel_analytics',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'tunnelId', type: 'uuid', isNullable: false },
            { name: 'periodStart', type: 'timestamp', isNullable: false },
            { name: 'messagesRelayed', type: 'integer', default: 0 },
            { name: 'messagesBlocked', type: 'integer', default: 0 },
            { name: 'uniqueUsers', type: 'integer', default: 0 },
            { name: 'peakConnections', type: 'integer', default: 0 },
            { name: 'attachmentsRelayed', type: 'integer', default: 0 },
            { name: 'reactionsRelayed', type: 'integer', default: 0 },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      await queryRunner.createForeignKey(
        'tunnel_analytics',
        new TableForeignKey({
          name: 'FK_tunnel_analytics_tunnel',
          columnNames: ['tunnelId'],
          referencedTableName: 'tunnels',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      await queryRunner.createIndex(
        'tunnel_analytics',
        new TableIndex({
          name: 'IDX_tunnel_analytics_tunnel_period',
          columnNames: ['tunnelId', 'periodStart'],
        })
      );
      await queryRunner.createIndex(
        'tunnel_analytics',
        new TableIndex({
          name: 'IDX_tunnel_analytics_tunnel',
          columnNames: ['tunnelId'],
        })
      );
      await queryRunner.createIndex(
        'tunnel_analytics',
        new TableIndex({
          name: 'IDX_tunnel_analytics_period',
          columnNames: ['periodStart'],
        })
      );

      logger.info('Created tunnel_analytics table');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.dropTable('tunnel_analytics', true);
    await queryRunner.dropTable('tunnel_bans', true);
    await queryRunner.dropTable('tunnel_messages', true);

    // Remove columns from tunnels table
    const tunnelsTable = await queryRunner.getTable('tunnels');
    if (tunnelsTable) {
      if (tunnelsTable.findColumnByName('maxConnectedServers')) {
        await queryRunner.dropColumn('tunnels', 'maxConnectedServers');
      }
      if (tunnelsTable.findColumnByName('allowBotMessages')) {
        await queryRunner.dropColumn('tunnels', 'allowBotMessages');
      }
      if (tunnelsTable.findColumnByName('inviteCode')) {
        const idx = tunnelsTable.indices.find(i => i.name === 'IDX_tunnel_invite_code');
        if (idx) {
          await queryRunner.dropIndex('tunnels', 'IDX_tunnel_invite_code');
        }
        await queryRunner.dropColumn('tunnels', 'inviteCode');
      }
    }

    logger.info('Reverted tunnel gap features migration');
  }
}
