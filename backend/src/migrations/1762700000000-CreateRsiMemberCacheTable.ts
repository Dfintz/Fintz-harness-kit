import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create RSI Member Cache Table
 *
 * Creates the rsi_member_cache table for caching RSI organization
 * member data as part of the RSI Role Sync System (Phase 1).
 *
 * This table stores:
 * - RSI organization membership data
 * - Member ranks and affiliations
 * - Cache timestamps for refresh logic
 */
export class CreateRsiMemberCacheTable1762700000000 implements MigrationInterface {
  name = 'CreateRsiMemberCacheTable1762700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if rsi_member_cache table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('rsi_member_cache');
    if (existingTable) {
      logger.warn('rsi_member_cache table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'rsi_member_cache',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'rsiOrgSid',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'rsiHandle',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'rsiRank',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'rsiRankOrder',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'isAffiliate',
            type: 'boolean',
            default: false,
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'cachedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create unique constraint for organization_id + rsi_handle combination
    await queryRunner.createUniqueConstraint(
      'rsi_member_cache',
      new TableUnique({
        name: 'UQ_rsi_member_cache_org_handle',
        columnNames: ['organizationId', 'rsiHandle'],
      })
    );

    // Create indexes for efficient queries
    await queryRunner.createIndex(
      'rsi_member_cache',
      new TableIndex({
        name: 'IDX_rsi_member_cache_org_id',
        columnNames: ['organizationId'],
      })
    );

    await queryRunner.createIndex(
      'rsi_member_cache',
      new TableIndex({
        name: 'IDX_rsi_member_cache_org_sid',
        columnNames: ['rsiOrgSid'],
      })
    );

    await queryRunner.createIndex(
      'rsi_member_cache',
      new TableIndex({
        name: 'IDX_rsi_member_cache_cached_at',
        columnNames: ['cachedAt'],
      })
    );

    await queryRunner.createIndex(
      'rsi_member_cache',
      new TableIndex({
        name: 'IDX_rsi_member_cache_handle',
        columnNames: ['rsiHandle'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('rsi_member_cache', 'IDX_rsi_member_cache_handle');
    await queryRunner.dropIndex('rsi_member_cache', 'IDX_rsi_member_cache_cached_at');
    await queryRunner.dropIndex('rsi_member_cache', 'IDX_rsi_member_cache_org_sid');
    await queryRunner.dropIndex('rsi_member_cache', 'IDX_rsi_member_cache_org_id');
    await queryRunner.dropUniqueConstraint('rsi_member_cache', 'UQ_rsi_member_cache_org_handle');
    await queryRunner.dropTable('rsi_member_cache');
  }
}
