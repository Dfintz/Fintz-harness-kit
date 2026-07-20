"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAnnouncementTemplatesTable1762200000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateAnnouncementTemplatesTable1762200000000 {
    name = 'CreateAnnouncementTemplatesTable1762200000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('announcement_templates');
        if (existingTable) {
            logger_1.logger.warn('announcement_templates table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'announcement_templates',
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
                    isNullable: true,
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
                {
                    name: 'title',
                    type: 'varchar',
                    length: '256',
                    isNullable: true,
                },
                {
                    name: 'content',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'embedConfig',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'isGlobal',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'createdBy',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'createdByName',
                    type: 'varchar',
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
                {
                    name: 'deletedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'deletedBy',
                    type: 'varchar',
                    isNullable: true,
                },
            ],
        }), true);
        await queryRunner.createIndex('announcement_templates', new typeorm_1.TableIndex({
            name: 'IDX_announcement_templates_organizationId',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createIndex('announcement_templates', new typeorm_1.TableIndex({
            name: 'IDX_announcement_templates_isGlobal',
            columnNames: ['isGlobal'],
        }));
        await queryRunner.createIndex('announcement_templates', new typeorm_1.TableIndex({
            name: 'IDX_announcement_templates_createdBy',
            columnNames: ['createdBy'],
        }));
        await queryRunner.createIndex('announcement_templates', new typeorm_1.TableIndex({
            name: 'IDX_announcement_templates_name',
            columnNames: ['name'],
        }));
        await queryRunner.createForeignKey('announcement_templates', new typeorm_1.TableForeignKey({
            columnNames: ['organizationId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
            name: 'FK_announcement_templates_organizationId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('announcement_templates', 'FK_announcement_templates_organizationId');
        await queryRunner.dropIndex('announcement_templates', 'IDX_announcement_templates_name');
        await queryRunner.dropIndex('announcement_templates', 'IDX_announcement_templates_createdBy');
        await queryRunner.dropIndex('announcement_templates', 'IDX_announcement_templates_isGlobal');
        await queryRunner.dropIndex('announcement_templates', 'IDX_announcement_templates_organizationId');
        await queryRunner.dropTable('announcement_templates');
    }
}
exports.CreateAnnouncementTemplatesTable1762200000000 = CreateAnnouncementTemplatesTable1762200000000;
//# sourceMappingURL=1762200000000-CreateAnnouncementTemplatesTable.js.map