"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrganizationInventoryTable1764840000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateOrganizationInventoryTable1764840000000 {
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('organization_inventory');
        if (existingTable) {
            logger_1.logger.warn('organization_inventory table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
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
        }), true);
        await queryRunner.createIndex('organization_inventory', new typeorm_1.TableIndex({
            name: 'IDX_organization_inventory_organizationId',
            columnNames: ['organizationId']
        }));
        await queryRunner.createIndex('organization_inventory', new typeorm_1.TableIndex({
            name: 'IDX_organization_inventory_itemName',
            columnNames: ['itemName']
        }));
        await queryRunner.createIndex('organization_inventory', new typeorm_1.TableIndex({
            name: 'IDX_organization_inventory_category',
            columnNames: ['category']
        }));
        await queryRunner.createIndex('organization_inventory', new typeorm_1.TableIndex({
            name: 'IDX_organization_inventory_org_category',
            columnNames: ['organizationId', 'category']
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('organization_inventory', true);
    }
}
exports.CreateOrganizationInventoryTable1764840000000 = CreateOrganizationInventoryTable1764840000000;
//# sourceMappingURL=1764840000000-CreateOrganizationInventoryTable.js.map