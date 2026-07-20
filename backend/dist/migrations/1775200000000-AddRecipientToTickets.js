"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRecipientToTickets1775200000000 = void 0;
const typeorm_1 = require("typeorm");
class AddRecipientToTickets1775200000000 {
    name = 'AddRecipientToTickets1775200000000';
    async up(queryRunner) {
        await queryRunner.addColumn('tickets', new typeorm_1.TableColumn({
            name: 'recipientId',
            type: 'varchar',
            isNullable: true,
        }));
        await queryRunner.addColumn('tickets', new typeorm_1.TableColumn({
            name: 'recipientName',
            type: 'varchar',
            isNullable: true,
        }));
        await queryRunner.createIndex('tickets', new typeorm_1.TableIndex({
            name: 'IDX_tickets_recipientId',
            columnNames: ['recipientId'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('tickets', 'IDX_tickets_recipientId');
        await queryRunner.dropColumn('tickets', 'recipientName');
        await queryRunner.dropColumn('tickets', 'recipientId');
    }
}
exports.AddRecipientToTickets1775200000000 = AddRecipientToTickets1775200000000;
//# sourceMappingURL=1775200000000-AddRecipientToTickets.js.map