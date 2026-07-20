"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePasswordHistoryTable1733247000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreatePasswordHistoryTable1733247000000 {
    name = 'CreatePasswordHistoryTable1733247000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('password_history');
        if (existingTable) {
            logger_1.logger.warn('password_history table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'password_history',
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
                    name: 'passwordHash',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createIndex('password_history', new typeorm_1.TableIndex({
            name: 'IDX_password_history_userId',
            columnNames: ['userId'],
        }));
        await queryRunner.createIndex('password_history', new typeorm_1.TableIndex({
            name: 'IDX_password_history_userId_createdAt',
            columnNames: ['userId', 'createdAt'],
        }));
        await queryRunner.createForeignKey('password_history', new typeorm_1.TableForeignKey({
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
            name: 'FK_password_history_userId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('password_history', 'FK_password_history_userId');
        await queryRunner.dropIndex('password_history', 'IDX_password_history_userId_createdAt');
        await queryRunner.dropIndex('password_history', 'IDX_password_history_userId');
        await queryRunner.dropTable('password_history');
    }
}
exports.CreatePasswordHistoryTable1733247000000 = CreatePasswordHistoryTable1733247000000;
//# sourceMappingURL=1733247000000-CreatePasswordHistoryTable.js.map