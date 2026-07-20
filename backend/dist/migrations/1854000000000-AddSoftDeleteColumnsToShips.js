"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSoftDeleteColumnsToShips1854000000000 = void 0;
class AddSoftDeleteColumnsToShips1854000000000 {
    name = 'AddSoftDeleteColumnsToShips1854000000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveShipsColumnName(queryRunner, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ships'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const deletedAtColumn = await this.resolveShipsColumnName(queryRunner, 'deletedAt');
        if (!deletedAtColumn) {
            await queryRunner.query(`ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP NULL`);
        }
        const deletedByColumn = await this.resolveShipsColumnName(queryRunner, 'deletedBy');
        if (!deletedByColumn) {
            await queryRunner.query(`ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "deletedBy" VARCHAR NULL`);
        }
    }
    async down(queryRunner) {
        const deletedByColumn = await this.resolveShipsColumnName(queryRunner, 'deletedBy');
        if (deletedByColumn) {
            await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS ${this.quoteIdentifier(deletedByColumn)}`);
        }
        const deletedAtColumn = await this.resolveShipsColumnName(queryRunner, 'deletedAt');
        if (deletedAtColumn) {
            await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS ${this.quoteIdentifier(deletedAtColumn)}`);
        }
    }
}
exports.AddSoftDeleteColumnsToShips1854000000000 = AddSoftDeleteColumnsToShips1854000000000;
//# sourceMappingURL=1854000000000-AddSoftDeleteColumnsToShips.js.map