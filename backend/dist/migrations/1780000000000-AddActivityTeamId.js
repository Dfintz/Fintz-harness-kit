"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddActivityTeamId1780000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddActivityTeamId1780000000000 {
    name = 'AddActivityTeamId1780000000000';
    findColumnCaseInsensitive(table, preferredName) {
        return table.columns.find(column => column.name.toLowerCase() === preferredName.toLowerCase());
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('activities');
        if (!table) {
            throw new Error('activities table not found — cannot add teamId column');
        }
        const teamIdColumn = this.findColumnCaseInsensitive(table, 'teamId');
        const organizationIdColumn = this.findColumnCaseInsensitive(table, 'organizationId');
        if (teamIdColumn && organizationIdColumn) {
            return;
        }
        if (!table.findColumnByName('teamId')) {
            await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
                name: 'teamId',
                type: 'uuid',
                isNullable: true,
                comment: 'Optional team/squad this activity is assigned to',
            }));
        }
        const existingFK = table.foreignKeys.find((fk) => fk.name === 'FK_activity_team');
        if (!existingFK) {
            await queryRunner.createForeignKey('activities', new typeorm_1.TableForeignKey({
                name: 'FK_activity_team',
                columnNames: ['teamId'],
                referencedTableName: 'teams',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }));
        }
        const indexes = [
            { name: 'IDX_activity_team_id', columnNames: ['teamId'] },
            { name: 'IDX_activity_org_team', columnNames: ['organizationId', 'teamId'] },
        ];
        for (const idx of indexes) {
            const existingIndex = table.indices.find((i) => i.name === idx.name);
            if (!existingIndex) {
                await queryRunner.createIndex('activities', new typeorm_1.TableIndex({ name: idx.name, columnNames: idx.columnNames }));
            }
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('activities');
        if (!table) {
            return;
        }
        const fk = table.foreignKeys.find((fk) => fk.name === 'FK_activity_team');
        if (fk) {
            await queryRunner.dropForeignKey('activities', fk);
        }
        const indexNames = ['IDX_activity_team_id', 'IDX_activity_org_team'];
        for (const name of indexNames) {
            const idx = table.indices.find((i) => i.name === name);
            if (idx) {
                await queryRunner.dropIndex('activities', idx);
            }
        }
        if (table.findColumnByName('teamId')) {
            await queryRunner.dropColumn('activities', 'teamId');
        }
    }
}
exports.AddActivityTeamId1780000000000 = AddActivityTeamId1780000000000;
//# sourceMappingURL=1780000000000-AddActivityTeamId.js.map