"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFkIndexesForFleetTeamCascade1863200000000 = void 0;
class AddFkIndexesForFleetTeamCascade1863200000000 {
    name = 'AddFkIndexesForFleetTeamCascade1863200000000';
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
    async createIndexIfColumnExists(queryRunner, indexName, tableName, desiredColumnName) {
        const resolvedColumnName = await this.resolveColumnName(queryRunner, tableName, desiredColumnName);
        if (!resolvedColumnName) {
            return;
        }
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(tableName)} (${this.quoteIdentifier(resolvedColumnName)})`);
    }
    async up(queryRunner) {
        await this.createIndexIfColumnExists(queryRunner, 'idx_fleet_parent', 'fleets', 'parentFleetId');
        await this.createIndexIfColumnExists(queryRunner, 'idx_fleet_team', 'fleets', 'teamId');
        await this.createIndexIfColumnExists(queryRunner, 'idx_mission_fleet', 'missions', 'fleetId');
        await this.createIndexIfColumnExists(queryRunner, 'idx_activity_team', 'activities', 'teamId');
    }
    async down(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS "idx_activity_team"');
        await queryRunner.query('DROP INDEX IF EXISTS "idx_mission_fleet"');
        await queryRunner.query('DROP INDEX IF EXISTS "idx_fleet_team"');
        await queryRunner.query('DROP INDEX IF EXISTS "idx_fleet_parent"');
    }
}
exports.AddFkIndexesForFleetTeamCascade1863200000000 = AddFkIndexesForFleetTeamCascade1863200000000;
//# sourceMappingURL=1863200000000-AddFkIndexesForFleetTeamCascade.js.map