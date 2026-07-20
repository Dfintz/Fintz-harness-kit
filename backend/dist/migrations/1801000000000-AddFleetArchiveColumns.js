"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFleetArchiveColumns1801000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddFleetArchiveColumns1801000000000 {
    name = 'AddFleetArchiveColumns1801000000000';
    async resolveColumnName(queryRunner, tableName, preferredName) {
        const rows = await queryRunner.query(`SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`, [tableName, preferredName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const isArchivedColumn = await this.resolveColumnName(queryRunner, 'fleets', 'isArchived');
        const archivedAtColumn = await this.resolveColumnName(queryRunner, 'fleets', 'archivedAt');
        const archivedByColumn = await this.resolveColumnName(queryRunner, 'fleets', 'archivedBy');
        const archiveReasonColumn = await this.resolveColumnName(queryRunner, 'fleets', 'archiveReason');
        const restoredAtColumn = await this.resolveColumnName(queryRunner, 'fleets', 'restoredAt');
        const restoredByColumn = await this.resolveColumnName(queryRunner, 'fleets', 'restoredBy');
        if (isArchivedColumn &&
            archivedAtColumn &&
            archivedByColumn &&
            archiveReasonColumn &&
            restoredAtColumn &&
            restoredByColumn) {
            return;
        }
        await queryRunner.addColumns('fleets', [
            new typeorm_1.TableColumn({
                name: 'isArchived',
                type: 'boolean',
                isNullable: false,
                default: false,
            }),
            new typeorm_1.TableColumn({
                name: 'archivedAt',
                type: 'timestamp',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'archivedBy',
                type: 'varchar',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'archiveReason',
                type: 'text',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'restoredAt',
                type: 'timestamp',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'restoredBy',
                type: 'varchar',
                isNullable: true,
            }),
        ]);
        await queryRunner.createIndex('fleets', new typeorm_1.TableIndex({
            name: 'idx_fleet_archived',
            columnNames: ['organizationId', 'isArchived'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('fleets', 'idx_fleet_archived');
        await queryRunner.dropColumns('fleets', [
            'isArchived',
            'archivedAt',
            'archivedBy',
            'archiveReason',
            'restoredAt',
            'restoredBy',
        ]);
    }
}
exports.AddFleetArchiveColumns1801000000000 = AddFleetArchiveColumns1801000000000;
//# sourceMappingURL=1801000000000-AddFleetArchiveColumns.js.map