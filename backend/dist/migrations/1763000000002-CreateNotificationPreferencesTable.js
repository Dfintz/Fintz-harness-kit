"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNotificationPreferencesTable1763000000002 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateNotificationPreferencesTable1763000000002 {
    name = 'CreateNotificationPreferencesTable1763000000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('notification_preferences');
        if (existingTable) {
            logger_1.logger.warn('notification_preferences table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'notification_preferences',
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
                    isUnique: true,
                },
                {
                    name: 'muteAll',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'channels',
                    type: 'jsonb',
                    default: `'{"inApp":true,"email":false,"discord":true}'`,
                },
                {
                    name: 'categories',
                    type: 'jsonb',
                    default: `'{"fleet":true,"activity":true,"organization":true,"trade":true,"social":true,"security":true,"system":true}'`,
                },
                {
                    name: 'digestFrequency',
                    type: 'varchar',
                    length: '10',
                    default: `'daily'`,
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
        await queryRunner.createIndex('notification_preferences', new typeorm_1.TableIndex({
            name: 'IDX_notification_preferences_userId',
            columnNames: ['userId'],
            isUnique: true,
        }));
        await queryRunner.createForeignKey('notification_preferences', new typeorm_1.TableForeignKey({
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
            name: 'FK_notification_preferences_userId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('notification_preferences', 'FK_notification_preferences_userId');
        await queryRunner.dropIndex('notification_preferences', 'IDX_notification_preferences_userId');
        await queryRunner.dropTable('notification_preferences');
    }
}
exports.CreateNotificationPreferencesTable1763000000002 = CreateNotificationPreferencesTable1763000000002;
//# sourceMappingURL=1763000000002-CreateNotificationPreferencesTable.js.map