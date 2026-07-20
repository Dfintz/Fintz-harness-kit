"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameTeamTypesAndAddShipAssignment1807000000000 = void 0;
const typeorm_1 = require("typeorm");
class RenameTeamTypesAndAddShipAssignment1807000000000 {
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, tableName, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [tableName, desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async hasIndex(queryRunner, tableName, indexName) {
        const table = await queryRunner.getTable(tableName);
        return table?.indices.some(index => index.name === indexName) ?? false;
    }
    async up(queryRunner) {
        const typeColumnName = await this.resolveColumnName(queryRunner, 'teams', 'type');
        if (!typeColumnName) {
            return;
        }
        const organizationColumnName = await this.resolveColumnName(queryRunner, 'teams', 'organizationId');
        await queryRunner.query(`UPDATE teams SET ${this.quoteIdentifier(typeColumnName)} = 'squadron' WHERE ${this.quoteIdentifier(typeColumnName)} = 'squad'`);
        await queryRunner.query(`UPDATE teams SET ${this.quoteIdentifier(typeColumnName)} = 'crew' WHERE ${this.quoteIdentifier(typeColumnName)} = 'flight'`);
        await queryRunner.query(`ALTER TABLE "teams" ALTER COLUMN ${this.quoteIdentifier(typeColumnName)} SET DEFAULT 'squadron'`);
        let assignedShipColumnName = await this.resolveColumnName(queryRunner, 'teams', 'assignedShipId');
        if (!assignedShipColumnName) {
            await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN "assignedShipId" varchar`);
            assignedShipColumnName = 'assignedShipId';
        }
        let assignedDivisionColumnName = await this.resolveColumnName(queryRunner, 'teams', 'assignedDivisionId');
        if (!assignedDivisionColumnName) {
            await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN "assignedDivisionId" uuid`);
            assignedDivisionColumnName = 'assignedDivisionId';
        }
        if (organizationColumnName &&
            !(await this.hasIndex(queryRunner, 'teams', 'IDX_team_assigned_ship'))) {
            await queryRunner.createIndex('teams', new typeorm_1.TableIndex({
                name: 'IDX_team_assigned_ship',
                columnNames: [organizationColumnName, assignedShipColumnName],
            }));
        }
        if (organizationColumnName &&
            !(await this.hasIndex(queryRunner, 'teams', 'IDX_team_assigned_division'))) {
            await queryRunner.createIndex('teams', new typeorm_1.TableIndex({
                name: 'IDX_team_assigned_division',
                columnNames: [organizationColumnName, assignedDivisionColumnName],
            }));
        }
    }
    async down(queryRunner) {
        const typeColumnName = await this.resolveColumnName(queryRunner, 'teams', 'type');
        if (await this.hasIndex(queryRunner, 'teams', 'IDX_team_assigned_division')) {
            await queryRunner.dropIndex('teams', 'IDX_team_assigned_division');
        }
        if (await this.hasIndex(queryRunner, 'teams', 'IDX_team_assigned_ship')) {
            await queryRunner.dropIndex('teams', 'IDX_team_assigned_ship');
        }
        const assignedDivisionColumnName = await this.resolveColumnName(queryRunner, 'teams', 'assignedDivisionId');
        if (assignedDivisionColumnName) {
            await queryRunner.dropColumn('teams', assignedDivisionColumnName);
        }
        const assignedShipColumnName = await this.resolveColumnName(queryRunner, 'teams', 'assignedShipId');
        if (assignedShipColumnName) {
            await queryRunner.dropColumn('teams', assignedShipColumnName);
        }
        if (typeColumnName) {
            await queryRunner.query(`ALTER TABLE "teams" ALTER COLUMN ${this.quoteIdentifier(typeColumnName)} SET DEFAULT 'squad'`);
            await queryRunner.query(`UPDATE teams SET ${this.quoteIdentifier(typeColumnName)} = 'flight' WHERE ${this.quoteIdentifier(typeColumnName)} = 'crew'`);
            await queryRunner.query(`UPDATE teams SET ${this.quoteIdentifier(typeColumnName)} = 'squad' WHERE ${this.quoteIdentifier(typeColumnName)} = 'squadron'`);
        }
    }
}
exports.RenameTeamTypesAndAddShipAssignment1807000000000 = RenameTeamTypesAndAddShipAssignment1807000000000;
//# sourceMappingURL=1807000000000-RenameTeamTypesAndAddShipAssignment.js.map