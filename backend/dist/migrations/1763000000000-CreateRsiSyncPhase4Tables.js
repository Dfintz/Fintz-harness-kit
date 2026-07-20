"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRsiSyncPhase4Tables1763000000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateRsiSyncPhase4Tables1763000000000 {
    name = 'CreateRsiSyncPhase4Tables1763000000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('rsi_sync_audit_log');
        if (existingTable) {
            logger_1.logger.warn('rsi_sync_audit_log table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'rsi_sync_audit_log',
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
                    name: 'syncType',
                    type: 'varchar',
                    length: '20',
                    isNullable: false,
                    comment: 'Type of sync: manual, scheduled, webhook',
                },
                {
                    name: 'changesDetected',
                    type: 'int',
                    default: 0,
                },
                {
                    name: 'changesApplied',
                    type: 'int',
                    default: 0,
                },
                {
                    name: 'errors',
                    type: 'int',
                    default: 0,
                },
                {
                    name: 'details',
                    type: 'jsonb',
                    isNullable: true,
                    comment: 'Detailed sync information including changes and errors',
                },
                {
                    name: 'syncedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createIndex('rsi_sync_audit_log', new typeorm_1.TableIndex({
            name: 'IDX_rsi_sync_audit_log_org_id',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createIndex('rsi_sync_audit_log', new typeorm_1.TableIndex({
            name: 'IDX_rsi_sync_audit_log_sync_type',
            columnNames: ['syncType'],
        }));
        await queryRunner.createIndex('rsi_sync_audit_log', new typeorm_1.TableIndex({
            name: 'IDX_rsi_sync_audit_log_synced_at',
            columnNames: ['syncedAt'],
        }));
        await queryRunner.createIndex('rsi_sync_audit_log', new typeorm_1.TableIndex({
            name: 'IDX_rsi_sync_audit_log_org_synced_at',
            columnNames: ['organizationId', 'syncedAt'],
        }));
        await queryRunner.createForeignKey('rsi_sync_audit_log', new typeorm_1.TableForeignKey({
            columnNames: ['organizationId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
            name: 'FK_rsi_sync_audit_log_organizationId',
        }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'rsi_sync_schedules',
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
                    comment: 'RSI Organization Spectrum ID',
                },
                {
                    name: 'guildId',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                    comment: 'Discord guild ID for role assignments',
                },
                {
                    name: 'isEnabled',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'intervalMinutes',
                    type: 'int',
                    default: 60,
                    comment: 'Sync interval in minutes (min 15)',
                },
                {
                    name: 'lastSyncAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'nextSyncAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'consecutiveFailures',
                    type: 'int',
                    default: 0,
                },
                {
                    name: 'lastErrorMessage',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'notifyOnChanges',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'notifyOnErrors',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'notificationChannelId',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                    comment: 'Discord channel for notifications',
                },
                {
                    name: 'removeRolesOnLeave',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'affiliateHandling',
                    type: 'varchar',
                    length: '20',
                    default: "'include'",
                    comment: 'include, exclude, or special_role',
                },
                {
                    name: 'affiliateRoleId',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                    comment: 'Role ID for affiliates when using special_role',
                },
                {
                    name: 'maxConsecutiveFailures',
                    type: 'int',
                    default: 5,
                    comment: 'Auto-disable after this many failures',
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
        await queryRunner.createIndex('rsi_sync_schedules', new typeorm_1.TableIndex({
            name: 'IDX_rsi_sync_schedules_org_id',
            columnNames: ['organizationId'],
            isUnique: true,
        }));
        await queryRunner.createIndex('rsi_sync_schedules', new typeorm_1.TableIndex({
            name: 'IDX_rsi_sync_schedules_enabled',
            columnNames: ['isEnabled'],
        }));
        await queryRunner.createIndex('rsi_sync_schedules', new typeorm_1.TableIndex({
            name: 'IDX_rsi_sync_schedules_next_sync',
            columnNames: ['nextSyncAt'],
        }));
        await queryRunner.createForeignKey('rsi_sync_schedules', new typeorm_1.TableForeignKey({
            columnNames: ['organizationId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
            name: 'FK_rsi_sync_schedules_organizationId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('rsi_sync_schedules', 'FK_rsi_sync_schedules_organizationId');
        await queryRunner.dropIndex('rsi_sync_schedules', 'IDX_rsi_sync_schedules_next_sync');
        await queryRunner.dropIndex('rsi_sync_schedules', 'IDX_rsi_sync_schedules_enabled');
        await queryRunner.dropIndex('rsi_sync_schedules', 'IDX_rsi_sync_schedules_org_id');
        await queryRunner.dropTable('rsi_sync_schedules');
        await queryRunner.dropForeignKey('rsi_sync_audit_log', 'FK_rsi_sync_audit_log_organizationId');
        await queryRunner.dropIndex('rsi_sync_audit_log', 'IDX_rsi_sync_audit_log_org_synced_at');
        await queryRunner.dropIndex('rsi_sync_audit_log', 'IDX_rsi_sync_audit_log_synced_at');
        await queryRunner.dropIndex('rsi_sync_audit_log', 'IDX_rsi_sync_audit_log_sync_type');
        await queryRunner.dropIndex('rsi_sync_audit_log', 'IDX_rsi_sync_audit_log_org_id');
        await queryRunner.dropTable('rsi_sync_audit_log');
    }
}
exports.CreateRsiSyncPhase4Tables1763000000000 = CreateRsiSyncPhase4Tables1763000000000;
//# sourceMappingURL=1763000000000-CreateRsiSyncPhase4Tables.js.map