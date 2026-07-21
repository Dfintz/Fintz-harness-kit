import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Announcement Deliveries Table
 * 
 * Creates the announcement_deliveries table for tracking individual delivery status
 * to each Discord server/channel. This supports Phase 2 multi-server targeting.
 */
export class CreateAnnouncementDeliveriesTable1762100000000 implements MigrationInterface {
    name = 'CreateAnnouncementDeliveriesTable1762100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if announcement_deliveries table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('announcement_deliveries');
        if (existingTable) {
            logger.warn('announcement_deliveries table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'announcement_deliveries',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'announcementId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'guildId',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                    },
                    {
                        name: 'channelId',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        default: "'pending'",
                    },
                    {
                        name: 'messageId',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'retryCount',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'scheduledAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'deliveredAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'errorMessage',
                        type: 'text',
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
                ],
            }),
            true,
        );

        // Create indexes for efficient queries
        await queryRunner.createIndex(
            'announcement_deliveries',
            new TableIndex({
                name: 'IDX_announcement_deliveries_announcementId',
                columnNames: ['announcementId'],
            }),
        );

        await queryRunner.createIndex(
            'announcement_deliveries',
            new TableIndex({
                name: 'IDX_announcement_deliveries_guildId',
                columnNames: ['guildId'],
            }),
        );

        await queryRunner.createIndex(
            'announcement_deliveries',
            new TableIndex({
                name: 'IDX_announcement_deliveries_status',
                columnNames: ['status'],
            }),
        );

        await queryRunner.createIndex(
            'announcement_deliveries',
            new TableIndex({
                name: 'IDX_announcement_deliveries_status_scheduledAt',
                columnNames: ['status', 'scheduledAt'],
            }),
        );

        // Add foreign key to announcements table
        await queryRunner.createForeignKey(
            'announcement_deliveries',
            new TableForeignKey({
                columnNames: ['announcementId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'announcements',
                onDelete: 'CASCADE',
                name: 'FK_announcement_deliveries_announcementId',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey('announcement_deliveries', 'FK_announcement_deliveries_announcementId');
        await queryRunner.dropIndex('announcement_deliveries', 'IDX_announcement_deliveries_status_scheduledAt');
        await queryRunner.dropIndex('announcement_deliveries', 'IDX_announcement_deliveries_status');
        await queryRunner.dropIndex('announcement_deliveries', 'IDX_announcement_deliveries_guildId');
        await queryRunner.dropIndex('announcement_deliveries', 'IDX_announcement_deliveries_announcementId');
        await queryRunner.dropTable('announcement_deliveries');
    }
}
