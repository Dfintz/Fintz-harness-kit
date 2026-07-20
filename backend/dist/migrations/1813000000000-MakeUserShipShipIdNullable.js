"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeUserShipShipIdNullable1813000000000 = void 0;
class MakeUserShipShipIdNullable1813000000000 {
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async getShipIdColumnInfo(queryRunner) {
        const rows = await queryRunner.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_ships'
        AND lower(column_name) = lower('shipId')
      ORDER BY CASE WHEN column_name = 'shipId' THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `);
        const row = rows[0];
        if (!row?.column_name) {
            return null;
        }
        return {
            name: row.column_name,
            isNullable: row.is_nullable === 'YES',
        };
    }
    async up(queryRunner) {
        const shipIdColumn = await this.getShipIdColumnInfo(queryRunner);
        if (!shipIdColumn || shipIdColumn.isNullable) {
            return;
        }
        await queryRunner.query(`ALTER TABLE "user_ships" ALTER COLUMN ${this.quoteIdentifier(shipIdColumn.name)} DROP NOT NULL`);
    }
    async down(queryRunner) {
        const shipIdColumn = await this.getShipIdColumnInfo(queryRunner);
        if (!shipIdColumn?.isNullable) {
            return;
        }
        await queryRunner.query(`ALTER TABLE "user_ships" ALTER COLUMN ${this.quoteIdentifier(shipIdColumn.name)} SET NOT NULL`);
    }
}
exports.MakeUserShipShipIdNullable1813000000000 = MakeUserShipShipIdNullable1813000000000;
//# sourceMappingURL=1813000000000-MakeUserShipShipIdNullable.js.map