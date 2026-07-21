import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Announcement Templates Table
 *
 * Creates the announcement_templates table for reusable announcement templates.
 * Supports both organization-specific and global templates (Phase 4).
 */
export class CreateAnnouncementTemplatesTable1762200000000 implements MigrationInterface {
  name = 'CreateAnnouncementTemplatesTable1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if announcement_templates table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('announcement_templates');
    if (existingTable) {
      logger.warn('announcement_templates table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'announcement_templates',
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
            isNullable: true, // NULL for global templates
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '256',
            isNullable: true,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'embedConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isGlobal',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdBy',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'createdByName',
            type: 'varchar',
            isNullable: true,
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
      'announcement_templates',
      new TableIndex({
        name: 'IDX_announcement_templates_organizationId',
        columnNames: ['organizationId'],
      })
    );

    await queryRunner.createIndex(
      'announcement_templates',
      new TableIndex({
        name: 'IDX_announcement_templates_isGlobal',
        columnNames: ['isGlobal'],
      })
    );

    await queryRunner.createIndex(
      'announcement_templates',
      new TableIndex({
        name: 'IDX_announcement_templates_createdBy',
        columnNames: ['createdBy'],
      })
    );

    await queryRunner.createIndex(
      'announcement_templates',
      new TableIndex({
        name: 'IDX_announcement_templates_name',
        columnNames: ['name'],
      })
    );

    // Add foreign key to organizations table (optional - allows NULL for global templates)
    await queryRunner.createForeignKey(
      'announcement_templates',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        name: 'FK_announcement_templates_organizationId',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'announcement_templates',
      'FK_announcement_templates_organizationId'
    );
    await queryRunner.dropIndex('announcement_templates', 'IDX_announcement_templates_name');
    await queryRunner.dropIndex('announcement_templates', 'IDX_announcement_templates_createdBy');
    await queryRunner.dropIndex('announcement_templates', 'IDX_announcement_templates_isGlobal');
    await queryRunner.dropIndex(
      'announcement_templates',
      'IDX_announcement_templates_organizationId'
    );
    await queryRunner.dropTable('announcement_templates');
  }
}
