"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFleetHierarchy1777000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddFleetHierarchy1777000000000 {
    name = 'AddFleetHierarchy1777000000000';
    findColumnCaseInsensitive(table, preferredName) {
        return table.columns.find(column => column.name.toLowerCase() === preferredName.toLowerCase());
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('fleets');
        if (!table) {
            throw new Error('fleets table not found — cannot add hierarchy columns');
        }
        const hasParentFleetId = this.findColumnCaseInsensitive(table, 'parentFleetId');
        const hasLevel = this.findColumnCaseInsensitive(table, 'level');
        const hasSortOrder = this.findColumnCaseInsensitive(table, 'sortOrder');
        const hasHierarchyPath = this.findColumnCaseInsensitive(table, 'hierarchyPath');
        if (hasParentFleetId && hasLevel && hasSortOrder && hasHierarchyPath) {
            return;
        }
        if (!table.findColumnByName('parentFleetId')) {
            await queryRunner.addColumn('fleets', new typeorm_1.TableColumn({
                name: 'parentFleetId',
                type: 'varchar',
                isNullable: true,
                comment: 'Parent fleet ID for hierarchy (null = root fleet)',
            }));
        }
        if (!table.findColumnByName('level')) {
            await queryRunner.addColumn('fleets', new typeorm_1.TableColumn({
                name: 'level',
                type: 'int',
                default: 0,
                comment: 'Depth level in hierarchy (0 = root)',
            }));
        }
        if (!table.findColumnByName('sortOrder')) {
            await queryRunner.addColumn('fleets', new typeorm_1.TableColumn({
                name: 'sortOrder',
                type: 'int',
                default: 0,
                comment: 'Sort position among siblings',
            }));
        }
        if (!table.findColumnByName('hierarchyPath')) {
            await queryRunner.addColumn('fleets', new typeorm_1.TableColumn({
                name: 'hierarchyPath',
                type: 'text',
                default: `''`,
                comment: 'Materialized path for subtree queries (e.g., "rootId.parentId.thisId")',
            }));
        }
        const existingFK = table.foreignKeys.find(fk => fk.name === 'FK_fleet_parent');
        if (!existingFK) {
            await queryRunner.createForeignKey('fleets', new typeorm_1.TableForeignKey({
                name: 'FK_fleet_parent',
                columnNames: ['parentFleetId'],
                referencedTableName: 'fleets',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }));
        }
        const indexes = [
            { name: 'IDX_fleet_parent_id', columnNames: ['parentFleetId'] },
            { name: 'IDX_fleet_hierarchy_path', columnNames: ['hierarchyPath'] },
            {
                name: 'IDX_fleet_org_parent_sort',
                columnNames: ['organizationId', 'parentFleetId', 'sortOrder'],
            },
        ];
        for (const idx of indexes) {
            const existingIndex = table.indices.find(i => i.name === idx.name);
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
        const fk = table.foreignKeys.find(fk => fk.name === 'FK_fleet_parent');
        if (fk) {
            await queryRunner.dropForeignKey('fleets', fk);
        }
        const indexNames = [
            'IDX_fleet_parent_id',
            'IDX_fleet_hierarchy_path',
            'IDX_fleet_org_parent_sort',
        ];
        for (const name of indexNames) {
            const idx = table.indices.find(i => i.name === name);
            if (idx) {
                await queryRunner.dropIndex('fleets', idx);
            }
        }
        const columns = ['hierarchyPath', 'sortOrder', 'level', 'parentFleetId'];
        for (const col of columns) {
            if (table.findColumnByName(col)) {
                await queryRunner.dropColumn('fleets', col);
            }
        }
    }
}
exports.AddFleetHierarchy1777000000000 = AddFleetHierarchy1777000000000;
//# sourceMappingURL=1777000000000-AddFleetHierarchy.js.map