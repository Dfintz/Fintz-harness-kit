"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDataBreachNotificationsTable1736609487000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateDataBreachNotificationsTable1736609487000 {
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('data_breach_notifications');
        if (existingTable) {
            logger_1.logger.warn('data_breach_notifications table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'data_breach_notifications',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()'
                },
                {
                    name: 'title',
                    type: 'varchar',
                    length: '255'
                },
                {
                    name: 'description',
                    type: 'text'
                },
                {
                    name: 'severity',
                    type: 'enum',
                    enum: ['critical', 'high', 'medium', 'low'],
                    default: "'medium'"
                },
                {
                    name: 'affectedUsers',
                    type: 'text'
                },
                {
                    name: 'affectedDataTypes',
                    type: 'text'
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED'],
                    default: "'INVESTIGATING'"
                },
                {
                    name: 'discoveredAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP'
                },
                {
                    name: 'containedAt',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'notifiedAt',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'resolvedAt',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'notifiedUsers',
                    type: 'text',
                    default: "'[]'"
                },
                {
                    name: 'notificationErrors',
                    type: 'text',
                    default: "'[]'"
                },
                {
                    name: 'remediationSteps',
                    type: 'text',
                    default: "''"
                },
                {
                    name: 'recommendations',
                    type: 'text',
                    default: "''"
                },
                {
                    name: 'internalNotes',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'regulatoryReport',
                    type: 'text',
                    isNullable: true
                }
            ]
        }), true);
        logger_1.logger.info('✅ data_breach_notifications table created successfully');
    }
    async down(queryRunner) {
        await queryRunner.dropTable('data_breach_notifications');
        logger_1.logger.info('✅ data_breach_notifications table dropped successfully');
    }
}
exports.CreateDataBreachNotificationsTable1736609487000 = CreateDataBreachNotificationsTable1736609487000;
//# sourceMappingURL=1736609487000-CreateDataBreachNotificationsTable.js.map