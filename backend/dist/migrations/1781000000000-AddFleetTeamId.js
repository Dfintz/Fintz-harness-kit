"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFleetTeamId1781000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddFleetTeamId1781000000000 {
    name = 'AddFleetTeamId1781000000000';
    findColumnCaseInsensitive(table, preferredName) {
        return table.columns.find(column => column.name.toLowerCase() === preferredName.toLowerCase());
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('fleets');
        if (!table) {
            throw new Error('fleets table not found — cannot add teamId column');
        }
        const teamIdColumn = this.findColumnCaseInsensitive(table, 'teamId');
        const organizationIdColumn = this.findColumnCaseInsensitive(table, 'organizationId');
        if (teamIdColumn && organizationIdColumn) {
            return;
        }
        if (!table.findColumnByName('teamId')) {
            await queryRunner.addColumn('fleets', new typeorm_1.TableColumn({
                name: 'teamId',
                type: 'uuid',
                isNullable: true,
                comment: 'Optional team/squad this fleet is assigned to',
            }));
        }
        const existingFK = table.foreignKeys.find((fk) => fk.name === 'FK_fleet_team');
        if (!existingFK) {
            await queryRunner.createForeignKey('fleets', new typeorm_1.TableForeignKey({
                name: 'FK_fleet_team',
                columnNames: ['teamId'],
                referencedTableName: 'teams',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }));
        }
        const indexes = [
            { name: 'IDX_fleet_team_id', columnNames: ['teamId'] },
            { name: 'IDX_fleet_org_team', columnNames: ['organizationId', 'teamId'] },
        ];
        for (const idx of indexes) {
            const existingIndex = table.indices.find((i) => i.name === idx.name);
            if (!existingIndex) {
                await queryRunner.createIndex('fleets', new typeorm_1.TableIndex({ name: idx.name, columnNames: idx.columnNames }));
            }
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('fleets');
        if (!table) {
            return;
        }
        const fk = table.foreignKeys.find((fk) => fk.name === 'FK_fleet_team');
        if (fk) {
            await queryRunner.dropForeignKey('fleets', fk);
        }
        const indexNames = ['IDX_fleet_team_id', 'IDX_fleet_org_team'];
        for (const name of indexNames) {
            const idx = table.indices.find((i) => i.name === name);
            if (idx) {
                await queryRunner.dropIndex('fleets', idx);
            }
        }
        if (table.findColumnByName('teamId')) {
            await queryRunner.dropColumn('fleets', 'teamId');
        }
    }
}
exports.AddFleetTeamId1781000000000 = AddFleetTeamId1781000000000;
//# sourceMappingURL=1781000000000-AddFleetTeamId.js.map