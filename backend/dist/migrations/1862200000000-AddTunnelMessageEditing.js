"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTunnelMessageEditing1862200000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddTunnelMessageEditing1862200000000 {
    name = 'AddTunnelMessageEditing1862200000000';
    async up(queryRunner) {
        const table = await queryRunner.getTable('tunnel_messages');
        if (!table) {
            logger_1.logger.warn('tunnel_messages table not found — skipping migration');
            return;
        }
        if (!table.findColumnByName('isEdited')) {
            await queryRunner.addColumn('tunnel_messages', new typeorm_1.TableColumn({
                name: 'isEdited',
                type: 'boolean',
                default: false,
                isNullable: false,
            }));
            logger_1.logger.info('Added isEdited column to tunnel_messages');
        }
        if (!table.findColumnByName('editedAt')) {
            await queryRunner.addColumn('tunnel_messages', new typeorm_1.TableColumn({
                name: 'editedAt',
                type: 'timestamp',
                isNullable: true,
            }));
            logger_1.logger.info('Added editedAt column to tunnel_messages');
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('tunnel_messages');
        if (!table) {
            return;
        }
        if (table.findColumnByName('editedAt')) {
            await queryRunner.dropColumn('tunnel_messages', 'editedAt');
        }
        if (table.findColumnByName('isEdited')) {
            await queryRunner.dropColumn('tunnel_messages', 'isEdited');
        }
    }
}
exports.AddTunnelMessageEditing1862200000000 = AddTunnelMessageEditing1862200000000;
//# sourceMappingURL=1862200000000-AddTunnelMessageEditing.js.map