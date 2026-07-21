import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create RSI User Links Table
 *
 * Creates the rsi_user_links table for linking user accounts to RSI handles
 * with verification status as part of the RSI Role Sync System (Phase 3).
 *
 * This table stores:
 * - User to RSI handle mappings
 * - Verification method and status
 * - Sync status and timestamps
 */
export class CreateRsiUserLinksTable1762900000000 implements MigrationInterface {
  name = 'CreateRsiUserLinksTable1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if rsi_user_links table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('rsi_user_links');
    if (existingTable) {
      logger.warn('rsi_user_links table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'rsi_user_links',
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
            name: 'organizationId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'rsiHandle',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'verificationMethod',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'Verification method: manual, bio_code, discord_match',
          },
          {
            name: 'verificationCode',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'Verification code for bio_code method',
          },
          {
            name: 'verifiedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lastSyncedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'syncStatus',
            type: 'varchar',
            length: '20',
            default: "'pending'",
            comment: 'Sync status: pending, synced, failed, removed',
          },
          {
            name: 'discordUserId',
            type: 'varchar',
            length: '20',
            isNullable: true,
            comment: 'Discord user ID for role sync',
          },
          {
            name: 'lastKnownRank',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'Last known RSI rank for change detection',
          },
          {
            name: 'isAffiliate',
            type: 'boolean',
            default: false,
            comment: 'Whether user is an affiliate of the org',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional metadata for the link',
          },
          // Timestamps
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

    // Create unique constraint for user_id + organization_id combination
    await queryRunner.createUniqueConstraint(
      'rsi_user_links',
      new TableUnique({
        name: 'UQ_rsi_user_links_user_org',
        columnNames: ['userId', 'organizationId'],
      })
    );

    // Create indexes for efficient queries
    await queryRunner.createIndex(
      'rsi_user_links',
      new TableIndex({
        name: 'IDX_rsi_user_links_user_id',
        columnNames: ['userId'],
      })
    );

    await queryRunner.createIndex(
      'rsi_user_links',
      new TableIndex({
        name: 'IDX_rsi_user_links_org_id',
        columnNames: ['organizationId'],
      })
    );

    await queryRunner.createIndex(
      'rsi_user_links',
      new TableIndex({
        name: 'IDX_rsi_user_links_rsi_handle',
        columnNames: ['rsiHandle'],
      })
    );

    await queryRunner.createIndex(
      'rsi_user_links',
      new TableIndex({
        name: 'IDX_rsi_user_links_sync_status',
        columnNames: ['syncStatus'],
      })
    );

    await queryRunner.createIndex(
      'rsi_user_links',
      new TableIndex({
        name: 'IDX_rsi_user_links_discord_user_id',
        columnNames: ['discordUserId'],
      })
    );

    // Add foreign key to users table
    await queryRunner.createForeignKey(
      'rsi_user_links',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_rsi_user_links_userId',
      })
    );

    // Add foreign key to organizations table
    await queryRunner.createForeignKey(
      'rsi_user_links',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        name: 'FK_rsi_user_links_organizationId',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('rsi_user_links', 'FK_rsi_user_links_organizationId');
    await queryRunner.dropForeignKey('rsi_user_links', 'FK_rsi_user_links_userId');

    // Drop indexes
    await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_discord_user_id');
    await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_sync_status');
    await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_rsi_handle');
    await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_org_id');
    await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_user_id');

    // Drop unique constraint
    await queryRunner.dropUniqueConstraint('rsi_user_links', 'UQ_rsi_user_links_user_org');

    // Drop table
    await queryRunner.dropTable('rsi_user_links');
  }
}
