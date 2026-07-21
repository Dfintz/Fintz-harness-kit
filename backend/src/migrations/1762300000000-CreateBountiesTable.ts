import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Bounties Table
 *
 * Creates the bounties table for the bounty hunting system.
 * Supports 6 bounty types: kill, capture, intel, transport, rescue, custom
 *
 * Phase 1: Core Bounty Management
 */
export class CreateBountiesTable1762300000000 implements MigrationInterface {
  name = 'CreateBountiesTable1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if bounties table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('bounties');
    if (existingTable) {
      logger.warn('bounties table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'bounties',
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
            name: 'createdBy',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'createdByName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'bountyType',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'kill, capture, intel, transport, rescue, custom',
          },
          {
            name: 'targetType',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'player, npc, ship, location, item, other',
          },
          {
            name: 'targetIdentifier',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'targetName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'targetDetails',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional target information',
          },
          {
            name: 'rewardType',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'credits, item, reputation, mixed, other',
          },
          {
            name: 'rewardAmount',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'rewardDescription',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'active'",
            comment: 'active, claimed, in_progress, completed, verified, paid, cancelled, expired',
          },
          {
            name: 'difficulty',
            type: 'varchar',
            length: '20',
            isNullable: true,
            comment: 'easy, medium, hard, expert',
          },
          {
            name: 'location',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'systemLocation',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'claimedBy',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'claimedByName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'claimedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'verifiedBy',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'verifiedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'paidAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'visibility',
            type: 'varchar',
            length: '20',
            default: "'organization'",
            comment: 'public, organization, alliance, private',
          },
          {
            name: 'tags',
            type: 'text[]',
            isNullable: true,
            default: "'{}'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'linkedActivityId',
            type: 'uuid',
            isNullable: true,
            comment: 'Links to unified Activity model for cross-system integration',
          },
          {
            name: 'sharedWithOrgs',
            type: 'text[]',
            isNullable: true,
            default: "'{}'",
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
        ],
      }),
      true
    );

    // Create indexes for efficient queries
    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_organizationId',
        columnNames: ['organizationId'],
      })
    );

    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_createdBy',
        columnNames: ['createdBy'],
      })
    );

    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_status',
        columnNames: ['status'],
      })
    );

    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_bountyType',
        columnNames: ['bountyType'],
      })
    );

    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_status_bountyType',
        columnNames: ['status', 'bountyType'],
      })
    );

    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_organizationId_status',
        columnNames: ['organizationId', 'status'],
      })
    );

    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_claimedBy',
        columnNames: ['claimedBy'],
      })
    );

    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_expiresAt',
        columnNames: ['expiresAt'],
      })
    );

    await queryRunner.createIndex(
      'bounties',
      new TableIndex({
        name: 'IDX_bounties_createdAt',
        columnNames: ['createdAt'],
      })
    );

    // Add foreign key to organizations table
    await queryRunner.createForeignKey(
      'bounties',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        name: 'FK_bounties_organizationId',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('bounties', 'FK_bounties_organizationId');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_createdAt');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_expiresAt');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_claimedBy');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_organizationId_status');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_status_bountyType');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_bountyType');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_status');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_createdBy');
    await queryRunner.dropIndex('bounties', 'IDX_bounties_organizationId');
    await queryRunner.dropTable('bounties');
  }
}
