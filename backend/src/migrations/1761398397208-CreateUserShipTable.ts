import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create user_ships table
 * 
 * Creates the table for tracking individual user-owned ships
 * within organizations. Supports ownership status tracking,
 * condition monitoring, insurance management, and loan tracking.
 */
export class CreateUserShipTable1761398397208 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if user_ships table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('user_ships');
        if (existingTable) {
            logger.warn('user_ships table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'user_ships',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()'
                    },
                    {
                        name: 'organizationId',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'userId',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'shipId',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'shipName',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'customName',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold'],
                        default: "'owned'"
                    },
                    {
                        name: 'condition',
                        type: 'enum',
                        enum: ['pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical'],
                        default: "'good'"
                    },
                    {
                        name: 'acquiredDate',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'acquiredPrice',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: 'acquiredCurrency',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'insuranceLevel',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'insuranceExpires',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'location',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'hangar',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'loanedFrom',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'loanedTo',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'loanExpires',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'notes',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'modifications',
                        type: 'jsonb',
                        isNullable: true
                    },
                    {
                        name: 'flightHours',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'missionsCompleted',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'totalEarnings',
                        type: 'decimal',
                        precision: 15,
                        scale: 2,
                        default: 0
                    },
                    {
                        name: 'tags',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'availableForOrg',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ]
            }),
            true
        );

        // Create composite indexes for common queries
        await queryRunner.createIndex(
            'user_ships',
            new TableIndex({
                name: 'IDX_USER_SHIPS_ORG_USER',
                columnNames: ['organizationId', 'userId']
            })
        );

        await queryRunner.createIndex(
            'user_ships',
            new TableIndex({
                name: 'IDX_USER_SHIPS_ORG_SHIP',
                columnNames: ['organizationId', 'shipId']
            })
        );

        await queryRunner.createIndex(
            'user_ships',
            new TableIndex({
                name: 'IDX_USER_SHIPS_ORG_STATUS',
                columnNames: ['organizationId', 'status']
            })
        );

        await queryRunner.createIndex(
            'user_ships',
            new TableIndex({
                name: 'IDX_USER_SHIPS_USER_STATUS',
                columnNames: ['userId', 'status']
            })
        );

        await queryRunner.createIndex(
            'user_ships',
            new TableIndex({
                name: 'IDX_USER_SHIPS_USER_ID',
                columnNames: ['userId']
            })
        );

        await queryRunner.createIndex(
            'user_ships',
            new TableIndex({
                name: 'IDX_USER_SHIPS_SHIP_ID',
                columnNames: ['shipId']
            })
        );

        // Create index for insurance expiration queries
        await queryRunner.createIndex(
            'user_ships',
            new TableIndex({
                name: 'IDX_USER_SHIPS_INSURANCE_EXPIRES',
                columnNames: ['insuranceExpires']
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('user_ships');
    }
}
