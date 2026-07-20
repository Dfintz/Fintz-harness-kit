"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateGuildOrganizationTable1733310000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateGuildOrganizationTable1733310000000 {
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('guild_organizations');
        if (existingTable) {
            logger_1.logger.warn('guild_organizations table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'guild_organizations',
            columns: [
                {
                    name: 'guildId',
                    type: 'varchar',
                    length: '20',
                    isPrimary: true,
                    comment: 'Discord Guild (server) ID'
                },
                {
                    name: 'organizationId',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                    comment: 'Organization ID that owns/manages this guild'
                },
                {
                    name: 'guildName',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                    comment: 'Guild name (cached for display)'
                },
                {
                    name: 'isPrimary',
                    type: 'boolean',
                    default: true,
                    comment: 'Whether this is the primary/main guild for the organization'
                },
                {
                    name: 'isActive',
                    type: 'boolean',
                    default: true,
                    comment: 'Whether this mapping is currently active'
                },
                {
                    name: 'createdBy',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                    comment: 'User ID who created this mapping'
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                    comment: 'Additional metadata (integration settings, sync config, etc.)'
                },
                {
                    name: 'deactivatedAt',
                    type: 'timestamp',
                    isNullable: true,
                    comment: 'When this mapping was deactivated'
                },
                {
                    name: 'deactivatedBy',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                    comment: 'User ID who deactivated this mapping'
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
        }), true);
        await queryRunner.createIndex('guild_organizations', new typeorm_1.TableIndex({
            name: 'IDX_GUILD_ORG_ORGANIZATION_ID',
            columnNames: ['organizationId']
        }));
        await queryRunner.createIndex('guild_organizations', new typeorm_1.TableIndex({
            name: 'IDX_GUILD_ORG_IS_PRIMARY',
            columnNames: ['isPrimary']
        }));
        await queryRunner.createIndex('guild_organizations', new typeorm_1.TableIndex({
            name: 'IDX_GUILD_ORG_IS_ACTIVE',
            columnNames: ['isActive']
        }));
        await queryRunner.createIndex('guild_organizations', new typeorm_1.TableIndex({
            name: 'IDX_GUILD_ORG_ORG_ACTIVE',
            columnNames: ['organizationId', 'isActive']
        }));
        logger_1.logger.info('Created guild_organizations table with indexes');
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('guild_organizations', 'IDX_GUILD_ORG_ORG_ACTIVE');
        await queryRunner.dropIndex('guild_organizations', 'IDX_GUILD_ORG_IS_ACTIVE');
        await queryRunner.dropIndex('guild_organizations', 'IDX_GUILD_ORG_IS_PRIMARY');
        await queryRunner.dropIndex('guild_organizations', 'IDX_GUILD_ORG_ORGANIZATION_ID');
        await queryRunner.dropTable('guild_organizations', true);
        logger_1.logger.info('Dropped guild_organizations table');
    }
}
exports.CreateGuildOrganizationTable1733310000000 = CreateGuildOrganizationTable1733310000000;
//# sourceMappingURL=1733310000000-CreateGuildOrganizationTable.js.map