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
 * Migration: Create RSI Role Mappings Table
 *
 * Creates the rsi_role_mappings table for mapping RSI ranks to Discord roles
 * and RBAC permissions as part of the RSI Role Sync System (Phase 2).
 *
 * This table stores:
 * - RSI rank to Discord role mappings
 * - RSI rank to RBAC permission mappings
 * - Per-organization configuration
 */
export class CreateRsiRoleMappingsTable1762800000000 implements MigrationInterface {
  name = 'CreateRsiRoleMappingsTable1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if rsi_role_mappings table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('rsi_role_mappings');
    if (existingTable) {
      logger.warn('rsi_role_mappings table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'rsi_role_mappings',
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
            name: 'rsiRank',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'discordRoleId',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'rbacPermissions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'priority',
            type: 'integer',
            default: 0,
            comment: 'Order priority for role assignment (higher = more priority)',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          // Soft delete support
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deletedBy',
            type: 'varchar',
            isNullable: true,
          },
          // Shared with organizations (from TenantEntity)
          {
            name: 'sharedWithOrgs',
            type: 'text[]',
            isNullable: true,
            default: "'{}'",
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

    // Create unique constraint for organization_id + rsi_rank combination
    await queryRunner.createUniqueConstraint(
      'rsi_role_mappings',
      new TableUnique({
        name: 'UQ_rsi_role_mappings_org_rank',
        columnNames: ['organizationId', 'rsiRank'],
      })
    );

    // Create indexes for efficient queries
    await queryRunner.createIndex(
      'rsi_role_mappings',
      new TableIndex({
        name: 'IDX_rsi_role_mappings_org_id',
        columnNames: ['organizationId'],
      })
    );

    await queryRunner.createIndex(
      'rsi_role_mappings',
      new TableIndex({
        name: 'IDX_rsi_role_mappings_rsi_rank',
        columnNames: ['rsiRank'],
      })
    );

    await queryRunner.createIndex(
      'rsi_role_mappings',
      new TableIndex({
        name: 'IDX_rsi_role_mappings_discord_role',
        columnNames: ['discordRoleId'],
      })
    );

    await queryRunner.createIndex(
      'rsi_role_mappings',
      new TableIndex({
        name: 'IDX_rsi_role_mappings_active',
        columnNames: ['isActive'],
      })
    );

    // Add foreign key to organizations table
    await queryRunner.createForeignKey(
      'rsi_role_mappings',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        name: 'FK_rsi_role_mappings_organizationId',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.dropForeignKey('rsi_role_mappings', 'FK_rsi_role_mappings_organizationId');

    // Drop indexes
    await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_active');
    await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_discord_role');
    await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_rsi_rank');
    await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_org_id');

    // Drop unique constraint
    await queryRunner.dropUniqueConstraint('rsi_role_mappings', 'UQ_rsi_role_mappings_org_rank');

    // Drop table
    await queryRunner.dropTable('rsi_role_mappings');
  }
}
