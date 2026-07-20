"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeShipOrgIdNullable1804000000000 = void 0;
const typeorm_1 = require("typeorm");
class MakeShipOrgIdNullable1804000000000 {
    tables = ['ships', 'activities'];
    findOrganizationColumnName(table) {
        const column = table?.columns.find(c => c.name.toLowerCase() === 'organizationid');
        return column?.name ?? null;
    }
    async up(queryRunner) {
        for (const tableName of this.tables) {
            const table = await queryRunner.getTable(tableName);
            const organizationColumnName = this.findOrganizationColumnName(table);
            if (!table || !organizationColumnName) {
                continue;
            }
            const fk = table.foreignKeys.find(fkConstraint => fkConstraint.columnNames.some(columnName => columnName.toLowerCase() === organizationColumnName.toLowerCase()));
            if (fk) {
                await queryRunner.dropForeignKey(tableName, fk);
            }
            await queryRunner.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${organizationColumnName}" DROP NOT NULL`);
            await queryRunner.createForeignKey(tableName, new typeorm_1.TableForeignKey({
                columnNames: [organizationColumnName],
                referencedTableName: 'organizations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
        }
    }
    async down(queryRunner) {
        for (const tableName of this.tables) {
            const table = await queryRunner.getTable(tableName);
            const organizationColumnName = this.findOrganizationColumnName(table);
            if (!table || !organizationColumnName) {
                continue;
            }
            const fk = table.foreignKeys.find(fkConstraint => fkConstraint.columnNames.some(columnName => columnName.toLowerCase() === organizationColumnName.toLowerCase()));
            if (fk) {
                await queryRunner.dropForeignKey(tableName, fk);
            }
            await queryRunner.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${organizationColumnName}" SET NOT NULL`);
            await queryRunner.createForeignKey(tableName, new typeorm_1.TableForeignKey({
                columnNames: [organizationColumnName],
                referencedTableName: 'organizations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
        }
    }
}
exports.MakeShipOrgIdNullable1804000000000 = MakeShipOrgIdNullable1804000000000;
//# sourceMappingURL=1804000000000-MakeShipOrgIdNullable.js.map