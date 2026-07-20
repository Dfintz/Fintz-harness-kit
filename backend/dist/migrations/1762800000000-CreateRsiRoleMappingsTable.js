"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRsiRoleMappingsTable1762800000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateRsiRoleMappingsTable1762800000000 {
    name = 'CreateRsiRoleMappingsTable1762800000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('rsi_role_mappings');
        if (existingTable) {
            logger_1.logger.warn('rsi_role_mappings table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'rsi_role_mappings',
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
                    name: 'rsiRank',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'discordRoleId',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                },
                {
                    name: 'rbacPermissions',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'isActive',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'priority',
                    type: 'integer',
                    default: 0,
                    comment: 'Order priority for role assignment (higher = more priority)',
                },
                {
                    name: 'description',
                    type: 'varchar',
                    length: '255',
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
            ],
        }), true);
        await queryRunner.createUniqueConstraint('rsi_role_mappings', new typeorm_1.TableUnique({
            name: 'UQ_rsi_role_mappings_org_rank',
            columnNames: ['organizationId', 'rsiRank'],
        }));
        await queryRunner.createIndex('rsi_role_mappings', new typeorm_1.TableIndex({
            name: 'IDX_rsi_role_mappings_org_id',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createIndex('rsi_role_mappings', new typeorm_1.TableIndex({
            name: 'IDX_rsi_role_mappings_rsi_rank',
            columnNames: ['rsiRank'],
        }));
        await queryRunner.createIndex('rsi_role_mappings', new typeorm_1.TableIndex({
            name: 'IDX_rsi_role_mappings_discord_role',
            columnNames: ['discordRoleId'],
        }));
        await queryRunner.createIndex('rsi_role_mappings', new typeorm_1.TableIndex({
            name: 'IDX_rsi_role_mappings_active',
            columnNames: ['isActive'],
        }));
        await queryRunner.createForeignKey('rsi_role_mappings', new typeorm_1.TableForeignKey({
            columnNames: ['organizationId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
            name: 'FK_rsi_role_mappings_organizationId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('rsi_role_mappings', 'FK_rsi_role_mappings_organizationId');
        await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_active');
        await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_discord_role');
        await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_rsi_rank');
        await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_org_id');
        await queryRunner.dropUniqueConstraint('rsi_role_mappings', 'UQ_rsi_role_mappings_org_rank');
        await queryRunner.dropTable('rsi_role_mappings');
    }
}
exports.CreateRsiRoleMappingsTable1762800000000 = CreateRsiRoleMappingsTable1762800000000;
//# sourceMappingURL=1762800000000-CreateRsiRoleMappingsTable.js.map