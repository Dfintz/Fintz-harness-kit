import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create organization_ships table
 * 
 * Creates the table for tracking organization-owned ships.
 * These are ships owned by the org itself (not individual members),
 * including capital ships, shared resources, and fleet assets.
 */
export class CreateOrganizationShipTable1761398421566 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if organization_ships table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('organization_ships');
        if (existingTable) {
            logger.warn('organization_ships table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'organization_ships',
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
                        name: 'role',
                        type: 'enum',
                        enum: ['command', 'combat', 'logistics', 'mining', 'exploration', 'medical', 'transport', 'support', 'reserve'],
                        default: "'reserve'"
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
                        name: 'acquisitionMethod',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'acquiredBy',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'acquiredDate',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'acquisitionCost',
                        type: 'decimal',
                        precision: 12,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: 'assignedCaptain',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'assignedCrew',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'maxCrew',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'location',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'homeBase',
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
                        name: 'lastMaintenance',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'nextMaintenance',
                        type: 'timestamp',
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
                        name: 'maintenanceCosts',
                        type: 'decimal',
                        precision: 15,
                        scale: 2,
                        default: 0
                    },
                    {
                        name: 'modifications',
                        type: 'jsonb',
                        isNullable: true
                    },
                    {
                        name: 'isAvailable',
                        type: 'boolean',
                        default: true
                    },
                    {
                        name: 'isCapital',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'requiresPermission',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'minimumRank',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'notes',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'tags',
                        type: 'text',
                        isNullable: true
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
            'organization_ships',
            new TableIndex({
                name: 'IDX_ORG_SHIPS_ORG_SHIP',
                columnNames: ['organizationId', 'shipId']
            })
        );

        await queryRunner.createIndex(
            'organization_ships',
            new TableIndex({
                name: 'IDX_ORG_SHIPS_ORG_ROLE',
                columnNames: ['organizationId', 'role']
            })
        );

        await queryRunner.createIndex(
            'organization_ships',
            new TableIndex({
                name: 'IDX_ORG_SHIPS_ORG_STATUS',
                columnNames: ['organizationId', 'status']
            })
        );

        await queryRunner.createIndex(
            'organization_ships',
            new TableIndex({
                name: 'IDX_ORG_SHIPS_SHIP_ID',
                columnNames: ['shipId']
            })
        );

        // Create index for capital ships query
        await queryRunner.createIndex(
            'organization_ships',
            new TableIndex({
                name: 'IDX_ORG_SHIPS_IS_CAPITAL',
                columnNames: ['isCapital']
            })
        );

        // Create index for maintenance queries
        await queryRunner.createIndex(
            'organization_ships',
            new TableIndex({
                name: 'IDX_ORG_SHIPS_NEXT_MAINTENANCE',
                columnNames: ['nextMaintenance']
            })
        );

        // Create index for availability queries
        await queryRunner.createIndex(
            'organization_ships',
            new TableIndex({
                name: 'IDX_ORG_SHIPS_IS_AVAILABLE',
                columnNames: ['isAvailable']
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('organization_ships');
    }
}
