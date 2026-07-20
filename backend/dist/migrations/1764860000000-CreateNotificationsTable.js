"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNotificationsTable1764860000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateNotificationsTable1764860000000 {
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('notifications');
        if (existingTable) {
            logger_1.logger.warn('notifications table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'notifications',
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
                    name: 'senderId',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'type',
                    type: 'varchar',
                    default: "'info'",
                    isNullable: false,
                },
                {
                    name: 'priority',
                    type: 'varchar',
                    default: "'normal'",
                    isNullable: false,
                },
                {
                    name: 'title',
                    type: 'varchar',
                    length: '200',
                    isNullable: false,
                },
                {
                    name: 'message',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'read',
                    type: 'boolean',
                    default: false,
                    isNullable: false,
                },
                {
                    name: 'readAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'data',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                },
            ],
        }), true);
        await queryRunner.createIndex('notifications', new typeorm_1.TableIndex({
            name: 'IDX_notifications_userId',
            columnNames: ['userId'],
        }));
        await queryRunner.createIndex('notifications', new typeorm_1.TableIndex({
            name: 'IDX_notifications_userId_read',
            columnNames: ['userId', 'read'],
        }));
        await queryRunner.createIndex('notifications', new typeorm_1.TableIndex({
            name: 'IDX_notifications_userId_createdAt',
            columnNames: ['userId', 'createdAt'],
        }));
        await queryRunner.createIndex('notifications', new typeorm_1.TableIndex({
            name: 'IDX_notifications_type',
            columnNames: ['type'],
        }));
        await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_notifications_userId"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_notifications_senderId"
            FOREIGN KEY ("senderId") REFERENCES "users"("id")
            ON DELETE SET NULL
        `);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('notifications', true);
    }
}
exports.CreateNotificationsTable1764860000000 = CreateNotificationsTable1764860000000;
//# sourceMappingURL=1764860000000-CreateNotificationsTable.js.map