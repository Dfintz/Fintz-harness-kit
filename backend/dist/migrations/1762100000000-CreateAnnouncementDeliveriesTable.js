"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAnnouncementDeliveriesTable1762100000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateAnnouncementDeliveriesTable1762100000000 {
    name = 'CreateAnnouncementDeliveriesTable1762100000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('announcement_deliveries');
        if (existingTable) {
            logger_1.logger.warn('announcement_deliveries table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'announcement_deliveries',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'announcementId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'guildId',
                    type: 'varchar',
                    length: '20',
                    isNullable: false,
                },
                {
                    name: 'channelId',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '20',
                    default: "'pending'",
                },
                {
                    name: 'messageId',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                },
                {
                    name: 'retryCount',
                    type: 'int',
                    default: 0,
                },
                {
                    name: 'scheduledAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'deliveredAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'errorMessage',
                    type: 'text',
                    isNullable: true,
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
        await queryRunner.createIndex('announcement_deliveries', new typeorm_1.TableIndex({
            name: 'IDX_announcement_deliveries_announcementId',
            columnNames: ['announcementId'],
        }));
        await queryRunner.createIndex('announcement_deliveries', new typeorm_1.TableIndex({
            name: 'IDX_announcement_deliveries_guildId',
            columnNames: ['guildId'],
        }));
        await queryRunner.createIndex('announcement_deliveries', new typeorm_1.TableIndex({
            name: 'IDX_announcement_deliveries_status',
            columnNames: ['status'],
        }));
        await queryRunner.createIndex('announcement_deliveries', new typeorm_1.TableIndex({
            name: 'IDX_announcement_deliveries_status_scheduledAt',
            columnNames: ['status', 'scheduledAt'],
        }));
        await queryRunner.createForeignKey('announcement_deliveries', new typeorm_1.TableForeignKey({
            columnNames: ['announcementId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'announcements',
            onDelete: 'CASCADE',
            name: 'FK_announcement_deliveries_announcementId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('announcement_deliveries', 'FK_announcement_deliveries_announcementId');
        await queryRunner.dropIndex('announcement_deliveries', 'IDX_announcement_deliveries_status_scheduledAt');
        await queryRunner.dropIndex('announcement_deliveries', 'IDX_announcement_deliveries_status');
        await queryRunner.dropIndex('announcement_deliveries', 'IDX_announcement_deliveries_guildId');
        await queryRunner.dropIndex('announcement_deliveries', 'IDX_announcement_deliveries_announcementId');
        await queryRunner.dropTable('announcement_deliveries');
    }
}
exports.CreateAnnouncementDeliveriesTable1762100000000 = CreateAnnouncementDeliveriesTable1762100000000;
//# sourceMappingURL=1762100000000-CreateAnnouncementDeliveriesTable.js.map