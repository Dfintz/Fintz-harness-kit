"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddDiplomacyIndexes1845000000000 = void 0;
class AddDiplomacyIndexes1845000000000 {
    name = 'AddDiplomacyIndexes1845000000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'alliance_diplomacy'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const orgId1Column = await this.resolveColumnName(queryRunner, 'orgId1');
        const orgId2Column = await this.resolveColumnName(queryRunner, 'orgId2');
        if (orgId1Column && orgId2Column) {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_diplomacy_org1_org2')} ON ${this.quoteIdentifier('alliance_diplomacy')} (${this.quoteIdentifier(orgId1Column)}, ${this.quoteIdentifier(orgId2Column)})`);
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_diplomacy_org2_org1')} ON ${this.quoteIdentifier('alliance_diplomacy')} (${this.quoteIdentifier(orgId2Column)}, ${this.quoteIdentifier(orgId1Column)})`);
        }
    }
    async down(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS idx_diplomacy_org2_org1');
        await queryRunner.query('DROP INDEX IF EXISTS idx_diplomacy_org1_org2');
    }
}
exports.AddDiplomacyIndexes1845000000000 = AddDiplomacyIndexes1845000000000;
//# sourceMappingURL=1845000000000-AddDiplomacyIndexes.js.map