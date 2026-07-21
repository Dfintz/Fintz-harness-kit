import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration to create organization_inventory table
 * Tracks organization-owned items (ships, components, commodities)
 */
export class CreateOrganizationInventoryTable1764840000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if organization_inventory table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('organization_inventory');
        if (existingTable) {
            logger.warn('organization_inventory table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'organization_inventory',
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
                        name: 'itemName',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'category',
                        type: 'varchar',
                        default: "'commodities'",
                        isNullable: false
                    },
                    {
                        name: 'quantity',
                        type: 'int',
                        default: 1,
                        isNullable: false
                    },
                    {
                        name: 'unit',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'unitValue',
                        type: 'decimal',
                        precision: 15,
                        scale: 2,
                        default: 0,
                        isNullable: false
                    },
                    {
                        name: 'totalValue',
                        type: 'decimal',
                        precision: 15,
                        scale: 2,
                        default: 0,
                        isNullable: false
                    },
                    {
                        name: 'notes',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'location',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'assignedTo',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        isNullable: false
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                        isNullable: false
                    }
                ]
            }),
            true
        );

        // Create indexes for performance
        await queryRunner.createIndex(
            'organization_inventory',
            new TableIndex({
                name: 'IDX_organization_inventory_organizationId',
                columnNames: ['organizationId']
            })
        );

        await queryRunner.createIndex(
            'organization_inventory',
            new TableIndex({
                name: 'IDX_organization_inventory_itemName',
                columnNames: ['itemName']
            })
        );

        await queryRunner.createIndex(
            'organization_inventory',
            new TableIndex({
                name: 'IDX_organization_inventory_category',
                columnNames: ['category']
            })
        );

        // Composite index for organization + category queries
        await queryRunner.createIndex(
            'organization_inventory',
            new TableIndex({
                name: 'IDX_organization_inventory_org_category',
                columnNames: ['organizationId', 'category']
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('organization_inventory', true);
    }
}
