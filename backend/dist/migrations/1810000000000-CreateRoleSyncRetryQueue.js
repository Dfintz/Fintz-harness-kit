"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRoleSyncRetryQueue1810000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateRoleSyncRetryQueue1810000000000 {
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'role_sync_retry_queue',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'guildId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'userId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'roleId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'operation',
                    type: 'varchar',
                    length: '10',
                    isNullable: false,
                },
                {
                    name: 'payload',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'retryCount',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'maxRetries',
                    type: 'integer',
                    default: 3,
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '20',
                    default: "'pending'",
                },
                {
                    name: 'nextRetryAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'lastError',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'lastErrorCode',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'processedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'completedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'deadLetteredAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'adminNotified',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'adminNotifiedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
            ],
        }), true);
        await queryRunner.createIndex('role_sync_retry_queue', new typeorm_1.TableIndex({ name: 'IDX_role_sync_retry_guildId', columnNames: ['guildId'] }));
        await queryRunner.createIndex('role_sync_retry_queue', new typeorm_1.TableIndex({ name: 'IDX_role_sync_retry_userId', columnNames: ['userId'] }));
        await queryRunner.createIndex('role_sync_retry_queue', new typeorm_1.TableIndex({ name: 'IDX_role_sync_retry_nextRetryAt', columnNames: ['nextRetryAt'] }));
        await queryRunner.createIndex('role_sync_retry_queue', new typeorm_1.TableIndex({
            name: 'IDX_role_sync_retry_status_nextRetryAt',
            columnNames: ['status', 'nextRetryAt'],
        }));
        await queryRunner.createIndex('role_sync_retry_queue', new typeorm_1.TableIndex({
            name: 'IDX_role_sync_retry_guildId_status',
            columnNames: ['guildId', 'status'],
        }));
        await queryRunner.createIndex('role_sync_retry_queue', new typeorm_1.TableIndex({
            name: 'IDX_role_sync_retry_userId_status',
            columnNames: ['userId', 'status'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('role_sync_retry_queue', true);
    }
}
exports.CreateRoleSyncRetryQueue1810000000000 = CreateRoleSyncRetryQueue1810000000000;
//# sourceMappingURL=1810000000000-CreateRoleSyncRetryQueue.js.map