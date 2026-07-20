"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddLoanActivityColumns1774870000000 = void 0;
const typeorm_1 = require("typeorm");
class AddLoanActivityColumns1774870000000 {
    name = 'AddLoanActivityColumns1774870000000';
    async up(queryRunner) {
        const table = await queryRunner.getTable('ship_loans');
        if (!table) {
            return;
        }
        const columnsToAdd = [
            { name: 'shipName', type: 'varchar', isNullable: true },
            { name: 'organizationId', type: 'varchar', isNullable: true },
            { name: 'activityId', type: 'varchar', isNullable: true },
            { name: 'activityName', type: 'varchar', isNullable: true },
            { name: 'scope', type: 'varchar', isNullable: true },
            { name: 'purpose', type: 'text', isNullable: true },
        ];
        for (const col of columnsToAdd) {
            if (!table.columns.find(c => c.name === col.name)) {
                await queryRunner.addColumn('ship_loans', new typeorm_1.TableColumn({
                    name: col.name,
                    type: col.type,
                    isNullable: col.isNullable,
                }));
            }
        }
        const indexDefs = [
            { name: 'idx_ship_loans_organization', columnNames: ['organizationId'] },
            { name: 'idx_ship_loans_activity', columnNames: ['activityId'] },
        ];
        for (const idx of indexDefs) {
            const exists = table.indices.find(i => i.name === idx.name);
            if (!exists) {
                await queryRunner.createIndex('ship_loans', new typeorm_1.TableIndex({ name: idx.name, columnNames: idx.columnNames }));
            }
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('ship_loans');
        if (!table) {
            return;
        }
        const indexNames = ['idx_ship_loans_activity', 'idx_ship_loans_organization'];
        for (const name of indexNames) {
            if (table.indices.find(i => i.name === name)) {
                await queryRunner.dropIndex('ship_loans', name);
            }
        }
        const columnNames = [
            'purpose',
            'scope',
            'activityName',
            'activityId',
            'organizationId',
            'shipName',
        ];
        for (const col of columnNames) {
            if (table.columns.find(c => c.name === col)) {
                await queryRunner.dropColumn('ship_loans', col);
            }
        }
    }
}
exports.AddLoanActivityColumns1774870000000 = AddLoanActivityColumns1774870000000;
//# sourceMappingURL=1774870000000-AddLoanActivityColumns.js.map