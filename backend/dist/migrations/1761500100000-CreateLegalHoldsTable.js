"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateLegalHoldsTable1761500100000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateLegalHoldsTable1761500100000 {
    name = 'CreateLegalHoldsTable1761500100000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('legal_holds');
        if (existingTable) {
            logger_1.logger.warn('legal_holds table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'legal_holds',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                },
                {
                    name: 'userId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'reason',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'holdUntil',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'createdBy',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'isActive',
                    type: 'boolean',
                    default: true,
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
                    onUpdate: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createIndex('legal_holds', new typeorm_1.TableIndex({
            name: 'IDX_legal_holds_userId',
            columnNames: ['userId'],
        }));
        await queryRunner.createForeignKey('legal_holds', new typeorm_1.TableForeignKey({
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
            name: 'FK_legal_holds_userId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('legal_holds', 'FK_legal_holds_userId');
        await queryRunner.dropIndex('legal_holds', 'IDX_legal_holds_userId');
        await queryRunner.dropTable('legal_holds');
    }
}
exports.CreateLegalHoldsTable1761500100000 = CreateLegalHoldsTable1761500100000;
//# sourceMappingURL=1761500100000-CreateLegalHoldsTable.js.map