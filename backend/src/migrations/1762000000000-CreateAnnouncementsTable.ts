import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Announcements Table
 * 
 * Creates the announcements table for Discord announcement system.
 * Supports multi-tenancy, scheduling, and delivery tracking.
 */
export class CreateAnnouncementsTable1762000000000 implements MigrationInterface {
    name = 'CreateAnnouncementsTable1762000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if announcements table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('announcements');
        if (existingTable) {
            logger.warn('announcements table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'announcements',
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
                        isNullable: true,
                    },
                    {
                        name: 'title',
                        type: 'varchar',
                        length: '256',
                        isNullable: false,
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
                        name: 'targetType',
                        type: 'varchar',
                        length: '20',
                        default: "'single'",
                    },
                    {
                        name: 'targetIds',
                        type: 'jsonb',
                        isNullable: true,
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        default: "'draft'",
                    },
                    {
                        name: 'scheduledAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'sentAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'deliveryResults',
                        type: 'jsonb',
                        isNullable: true,
                    },
                    {
                        name: 'sharedWithOrgs',
                        type: 'text',
                        isNullable: true,
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
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Create indexes for efficient queries
        await queryRunner.createIndex(
            'announcements',
            new TableIndex({
                name: 'IDX_announcements_organizationId',
                columnNames: ['organizationId'],
            }),
        );

        await queryRunner.createIndex(
            'announcements',
            new TableIndex({
                name: 'IDX_announcements_org_status',
                columnNames: ['organizationId', 'status'],
            }),
        );

        await queryRunner.createIndex(
            'announcements',
            new TableIndex({
                name: 'IDX_announcements_org_createdAt',
                columnNames: ['organizationId', 'createdAt'],
            }),
        );

        await queryRunner.createIndex(
            'announcements',
            new TableIndex({
                name: 'IDX_announcements_status_scheduledAt',
                columnNames: ['status', 'scheduledAt'],
            }),
        );

        await queryRunner.createIndex(
            'announcements',
            new TableIndex({
                name: 'IDX_announcements_createdBy',
                columnNames: ['createdBy'],
            }),
        );

        // Add foreign key to organizations table
        await queryRunner.createForeignKey(
            'announcements',
            new TableForeignKey({
                columnNames: ['organizationId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'organizations',
                onDelete: 'CASCADE',
                name: 'FK_announcements_organizationId',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey('announcements', 'FK_announcements_organizationId');
        await queryRunner.dropIndex('announcements', 'IDX_announcements_createdBy');
        await queryRunner.dropIndex('announcements', 'IDX_announcements_status_scheduledAt');
        await queryRunner.dropIndex('announcements', 'IDX_announcements_org_createdAt');
        await queryRunner.dropIndex('announcements', 'IDX_announcements_org_status');
        await queryRunner.dropIndex('announcements', 'IDX_announcements_organizationId');
        await queryRunner.dropTable('announcements');
    }
}
