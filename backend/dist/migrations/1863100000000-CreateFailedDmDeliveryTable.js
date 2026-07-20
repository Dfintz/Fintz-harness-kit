"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFailedDmDeliveryTable1863100000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateFailedDmDeliveryTable1863100000000 {
    name = 'CreateFailedDmDeliveryTable1863100000000';
    async up(queryRunner) {
        const existing = await queryRunner.getTable('failed_dm_deliveries');
        if (existing) {
            logger_1.logger.warn('failed_dm_deliveries table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'failed_dm_deliveries',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'recipientDiscordId', type: 'varchar', isNullable: false },
                { name: 'eventType', type: 'varchar', length: '64', isNullable: false },
                { name: 'guildId', type: 'varchar', isNullable: true },
                { name: 'content', type: 'text', isNullable: true },
                { name: 'embedJson', type: 'jsonb', isNullable: false },
                { name: 'attemptCount', type: 'int', default: 1, isNullable: false },
                { name: 'nextRetryAt', type: 'timestamp', isNullable: false },
                { name: 'lastError', type: 'text', isNullable: true },
                { name: 'expiresAt', type: 'timestamp', isNullable: false },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                },
            ],
        }), true);
        await queryRunner.createIndex('failed_dm_deliveries', new typeorm_1.TableIndex({
            name: 'IDX_failed_dm_deliveries_nextRetryAt',
            columnNames: ['nextRetryAt'],
        }));
        await queryRunner.createIndex('failed_dm_deliveries', new typeorm_1.TableIndex({
            name: 'IDX_failed_dm_deliveries_expiresAt',
            columnNames: ['expiresAt'],
        }));
        await queryRunner.createIndex('failed_dm_deliveries', new typeorm_1.TableIndex({
            name: 'IDX_failed_dm_deliveries_recipient',
            columnNames: ['recipientDiscordId'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('failed_dm_deliveries', 'IDX_failed_dm_deliveries_recipient');
        await queryRunner.dropIndex('failed_dm_deliveries', 'IDX_failed_dm_deliveries_expiresAt');
        await queryRunner.dropIndex('failed_dm_deliveries', 'IDX_failed_dm_deliveries_nextRetryAt');
        await queryRunner.dropTable('failed_dm_deliveries');
    }
}
exports.CreateFailedDmDeliveryTable1863100000000 = CreateFailedDmDeliveryTable1863100000000;
//# sourceMappingURL=1863100000000-CreateFailedDmDeliveryTable.js.map