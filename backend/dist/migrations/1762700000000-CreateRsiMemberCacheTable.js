"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRsiMemberCacheTable1762700000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateRsiMemberCacheTable1762700000000 {
    name = 'CreateRsiMemberCacheTable1762700000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('rsi_member_cache');
        if (existingTable) {
            logger_1.logger.warn('rsi_member_cache table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'rsi_member_cache',
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
                    name: 'rsiOrgSid',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'rsiHandle',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
                {
                    name: 'rsiRank',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'rsiRankOrder',
                    type: 'integer',
                    isNullable: true,
                },
                {
                    name: 'isAffiliate',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'displayName',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'cachedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createUniqueConstraint('rsi_member_cache', new typeorm_1.TableUnique({
            name: 'UQ_rsi_member_cache_org_handle',
            columnNames: ['organizationId', 'rsiHandle'],
        }));
        await queryRunner.createIndex('rsi_member_cache', new typeorm_1.TableIndex({
            name: 'IDX_rsi_member_cache_org_id',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createIndex('rsi_member_cache', new typeorm_1.TableIndex({
            name: 'IDX_rsi_member_cache_org_sid',
            columnNames: ['rsiOrgSid'],
        }));
        await queryRunner.createIndex('rsi_member_cache', new typeorm_1.TableIndex({
            name: 'IDX_rsi_member_cache_cached_at',
            columnNames: ['cachedAt'],
        }));
        await queryRunner.createIndex('rsi_member_cache', new typeorm_1.TableIndex({
            name: 'IDX_rsi_member_cache_handle',
            columnNames: ['rsiHandle'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('rsi_member_cache', 'IDX_rsi_member_cache_handle');
        await queryRunner.dropIndex('rsi_member_cache', 'IDX_rsi_member_cache_cached_at');
        await queryRunner.dropIndex('rsi_member_cache', 'IDX_rsi_member_cache_org_sid');
        await queryRunner.dropIndex('rsi_member_cache', 'IDX_rsi_member_cache_org_id');
        await queryRunner.dropUniqueConstraint('rsi_member_cache', 'UQ_rsi_member_cache_org_handle');
        await queryRunner.dropTable('rsi_member_cache');
    }
}
exports.CreateRsiMemberCacheTable1762700000000 = CreateRsiMemberCacheTable1762700000000;
//# sourceMappingURL=1762700000000-CreateRsiMemberCacheTable.js.map