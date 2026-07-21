import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Blacklist Sharing Config Table
 *
 * Creates the blacklist_sharing_config table for configuring how organizations
 * share and receive moderation incidents with allied organizations.
 *
 * Phase 2: Cross-Discord Blacklist System - Alliance-Wide Sharing
 */
export class CreateBlacklistSharingConfigTable1762600000000 implements MigrationInterface {
  name = 'CreateBlacklistSharingConfigTable1762600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if blacklist_sharing_config table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('blacklist_sharing_config');
    if (existingTable) {
      logger.warn('blacklist_sharing_config table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'blacklist_sharing_config',
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
          // Sharing settings
          {
            name: 'shareWarnings',
            type: 'boolean',
            default: false,
          },
          {
            name: 'shareTimeouts',
            type: 'boolean',
            default: true,
          },
          {
            name: 'shareKicks',
            type: 'boolean',
            default: true,
          },
          {
            name: 'shareBans',
            type: 'boolean',
            default: true,
          },
          // Receiving settings
          {
            name: 'receiveAlerts',
            type: 'boolean',
            default: true,
          },
          {
            name: 'minAlertSeverity',
            type: 'integer',
            default: 2,
            comment: '1=Warning, 2=Timeout, 3=LongTimeout, 4=Kick, 5=Ban',
          },
          {
            name: 'alertChannelId',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          // Auto-share settings
          {
            name: 'autoShareWithAllies',
            type: 'boolean',
            default: false,
          },
          {
            name: 'autoShareMinSeverity',
            type: 'integer',
            default: 3,
          },
          // Tenant entity fields
          {
            name: 'sharedWithOrgs',
            type: 'text[]',
            isNullable: true,
            default: "'{}'",
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

    // Create unique index on organizationId (one config per org)
    await queryRunner.createIndex(
      'blacklist_sharing_config',
      new TableIndex({
        name: 'IDX_blacklist_sharing_config_organizationId',
        columnNames: ['organizationId'],
        isUnique: true,
      })
    );

    // Add foreign key to organizations table
    await queryRunner.createForeignKey(
      'blacklist_sharing_config',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        name: 'FK_blacklist_sharing_config_organizationId',
      })
    );

    // Add check constraint for severity range
    await queryRunner.query(`
            ALTER TABLE blacklist_sharing_config 
            ADD CONSTRAINT CHK_blacklist_sharing_config_minAlertSeverity 
            CHECK ("minAlertSeverity" >= 1 AND "minAlertSeverity" <= 5)
        `);

    await queryRunner.query(`
            ALTER TABLE blacklist_sharing_config 
            ADD CONSTRAINT CHK_blacklist_sharing_config_autoShareMinSeverity 
            CHECK ("autoShareMinSeverity" >= 1 AND "autoShareMinSeverity" <= 5)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints
    await queryRunner.query(`
            ALTER TABLE blacklist_sharing_config DROP CONSTRAINT IF EXISTS CHK_blacklist_sharing_config_autoShareMinSeverity
        `);
    await queryRunner.query(`
            ALTER TABLE blacklist_sharing_config DROP CONSTRAINT IF EXISTS CHK_blacklist_sharing_config_minAlertSeverity
        `);

    // Drop foreign key
    await queryRunner.dropForeignKey(
      'blacklist_sharing_config',
      'FK_blacklist_sharing_config_organizationId'
    );

    // Drop index
    await queryRunner.dropIndex(
      'blacklist_sharing_config',
      'IDX_blacklist_sharing_config_organizationId'
    );

    // Drop table
    await queryRunner.dropTable('blacklist_sharing_config');
  }
}
