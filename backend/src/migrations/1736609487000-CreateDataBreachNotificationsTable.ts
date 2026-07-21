import { MigrationInterface, QueryRunner, Table } from 'typeorm';

import { logger } from '../utils/logger';

export class CreateDataBreachNotificationsTable1736609487000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists
        const existingTable = await queryRunner.getTable('data_breach_notifications');
        if (existingTable) {
            logger.warn('data_breach_notifications table already exists, skipping creation');
            return;
        }

        // Create data_breach_notifications table
        await queryRunner.createTable(
            new Table({
                name: 'data_breach_notifications',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()'
                    },
                    {
                        name: 'title',
                        type: 'varchar',
                        length: '255'
                    },
                    {
                        name: 'description',
                        type: 'text'
                    },
                    {
                        name: 'severity',
                        type: 'enum',
                        enum: ['critical', 'high', 'medium', 'low'],
                        default: "'medium'"
                    },
                    {
                        name: 'affectedUsers',
                        type: 'text'
                    },
                    {
                        name: 'affectedDataTypes',
                        type: 'text'
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED'],
                        default: "'INVESTIGATING'"
                    },
                    {
                        name: 'discoveredAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'containedAt',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'notifiedAt',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'resolvedAt',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'notifiedUsers',
                        type: 'text',
                        default: "'[]'"
                    },
                    {
                        name: 'notificationErrors',
                        type: 'text',
                        default: "'[]'"
                    },
                    {
                        name: 'remediationSteps',
                        type: 'text',
                        default: "''"
                    },
                    {
                        name: 'recommendations',
                        type: 'text',
                        default: "''"
                    },
                    {
                        name: 'internalNotes',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'regulatoryReport',
                        type: 'text',
                        isNullable: true
                    }
                ]
            }),
            true
        );

        logger.info('✅ data_breach_notifications table created successfully');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('data_breach_notifications');
        logger.info('✅ data_breach_notifications table dropped successfully');
    }
}
