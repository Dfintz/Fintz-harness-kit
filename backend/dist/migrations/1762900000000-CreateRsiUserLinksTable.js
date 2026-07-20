"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRsiUserLinksTable1762900000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateRsiUserLinksTable1762900000000 {
    name = 'CreateRsiUserLinksTable1762900000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('rsi_user_links');
        if (existingTable) {
            logger_1.logger.warn('rsi_user_links table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'rsi_user_links',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'userId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'organizationId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'rsiHandle',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
                {
                    name: 'verificationMethod',
                    type: 'varchar',
                    length: '20',
                    isNullable: false,
                    comment: 'Verification method: manual, bio_code, discord_match',
                },
                {
                    name: 'verificationCode',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                    comment: 'Verification code for bio_code method',
                },
                {
                    name: 'verifiedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'lastSyncedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'syncStatus',
                    type: 'varchar',
                    length: '20',
                    default: "'pending'",
                    comment: 'Sync status: pending, synced, failed, removed',
                },
                {
                    name: 'discordUserId',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                    comment: 'Discord user ID for role sync',
                },
                {
                    name: 'lastKnownRank',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                    comment: 'Last known RSI rank for change detection',
                },
                {
                    name: 'isAffiliate',
                    type: 'boolean',
                    default: false,
                    comment: 'Whether user is an affiliate of the org',
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                    comment: 'Additional metadata for the link',
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
        await queryRunner.createUniqueConstraint('rsi_user_links', new typeorm_1.TableUnique({
            name: 'UQ_rsi_user_links_user_org',
            columnNames: ['userId', 'organizationId'],
        }));
        await queryRunner.createIndex('rsi_user_links', new typeorm_1.TableIndex({
            name: 'IDX_rsi_user_links_user_id',
            columnNames: ['userId'],
        }));
        await queryRunner.createIndex('rsi_user_links', new typeorm_1.TableIndex({
            name: 'IDX_rsi_user_links_org_id',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createIndex('rsi_user_links', new typeorm_1.TableIndex({
            name: 'IDX_rsi_user_links_rsi_handle',
            columnNames: ['rsiHandle'],
        }));
        await queryRunner.createIndex('rsi_user_links', new typeorm_1.TableIndex({
            name: 'IDX_rsi_user_links_sync_status',
            columnNames: ['syncStatus'],
        }));
        await queryRunner.createIndex('rsi_user_links', new typeorm_1.TableIndex({
            name: 'IDX_rsi_user_links_discord_user_id',
            columnNames: ['discordUserId'],
        }));
        await queryRunner.createForeignKey('rsi_user_links', new typeorm_1.TableForeignKey({
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
            name: 'FK_rsi_user_links_userId',
        }));
        await queryRunner.createForeignKey('rsi_user_links', new typeorm_1.TableForeignKey({
            columnNames: ['organizationId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
            name: 'FK_rsi_user_links_organizationId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('rsi_user_links', 'FK_rsi_user_links_organizationId');
        await queryRunner.dropForeignKey('rsi_user_links', 'FK_rsi_user_links_userId');
        await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_discord_user_id');
        await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_sync_status');
        await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_rsi_handle');
        await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_org_id');
        await queryRunner.dropIndex('rsi_user_links', 'IDX_rsi_user_links_user_id');
        await queryRunner.dropUniqueConstraint('rsi_user_links', 'UQ_rsi_user_links_user_org');
        await queryRunner.dropTable('rsi_user_links');
    }
}
exports.CreateRsiUserLinksTable1762900000000 = CreateRsiUserLinksTable1762900000000;
//# sourceMappingURL=1762900000000-CreateRsiUserLinksTable.js.map