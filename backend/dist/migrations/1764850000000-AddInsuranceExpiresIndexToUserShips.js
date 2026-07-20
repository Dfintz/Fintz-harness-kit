"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddInsuranceExpiresIndexToUserShips1764850000000 = void 0;
class AddInsuranceExpiresIndexToUserShips1764850000000 {
    name = 'AddInsuranceExpiresIndexToUserShips1764850000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
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
        const insuranceExpiresColumn = (await this.resolveColumnName(queryRunner, 'user_ships', 'insuranceExpires')) ??
            'insuranceExpires';
        const deletedAtColumn = (await this.resolveColumnName(queryRunner, 'user_ships', 'deletedAt')) ?? 'deletedAt';
        const userIdColumn = (await this.resolveColumnName(queryRunner, 'user_ships', 'userId')) ?? 'userId';
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_insuranceExpires" 
            ON "user_ships" (${this.quoteIdentifier(insuranceExpiresColumn)}) 
            WHERE ${this.quoteIdentifier(deletedAtColumn)} IS NULL
              AND ${this.quoteIdentifier(insuranceExpiresColumn)} IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_userId_insuranceExpires" 
            ON "user_ships" (${this.quoteIdentifier(userIdColumn)}, ${this.quoteIdentifier(insuranceExpiresColumn)}) 
            WHERE ${this.quoteIdentifier(deletedAtColumn)} IS NULL
              AND ${this.quoteIdentifier(insuranceExpiresColumn)} IS NOT NULL
        `);
    }
    async down(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_userId_insuranceExpires"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_insuranceExpires"');
    }
}
exports.AddInsuranceExpiresIndexToUserShips1764850000000 = AddInsuranceExpiresIndexToUserShips1764850000000;
//# sourceMappingURL=1764850000000-AddInsuranceExpiresIndexToUserShips.js.map