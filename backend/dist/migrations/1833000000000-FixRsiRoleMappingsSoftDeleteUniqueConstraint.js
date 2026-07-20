"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixRsiRoleMappingsSoftDeleteUniqueConstraint1833000000000 = void 0;
class FixRsiRoleMappingsSoftDeleteUniqueConstraint1833000000000 {
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'rsi_role_mappings'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const organizationIdColumnName = await this.resolveColumnName(queryRunner, 'organizationId');
        const rsiRankColumnName = await this.resolveColumnName(queryRunner, 'rsiRank');
        const deletedAtColumnName = await this.resolveColumnName(queryRunner, 'deletedAt');
        if (!organizationIdColumnName || !rsiRankColumnName || !deletedAtColumnName) {
            return;
        }
        await queryRunner.query(`ALTER TABLE "rsi_role_mappings" DROP CONSTRAINT IF EXISTS "UQ_rsi_role_mappings_org_rank"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_rsi_role_mappings_org_rank"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_rsi_role_mappings_org_rank" ON "rsi_role_mappings" (${this.quoteIdentifier(organizationIdColumnName)}, ${this.quoteIdentifier(rsiRankColumnName)}) WHERE ${this.quoteIdentifier(deletedAtColumnName)} IS NULL`);
    }
    async down(queryRunner) {
        const organizationIdColumnName = await this.resolveColumnName(queryRunner, 'organizationId');
        const rsiRankColumnName = await this.resolveColumnName(queryRunner, 'rsiRank');
        const deletedAtColumnName = await this.resolveColumnName(queryRunner, 'deletedAt');
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_rsi_role_mappings_org_rank"`);
        if (deletedAtColumnName) {
            await queryRunner.query(`DELETE FROM "rsi_role_mappings" WHERE ${this.quoteIdentifier(deletedAtColumnName)} IS NOT NULL`);
        }
        if (organizationIdColumnName && rsiRankColumnName) {
            await queryRunner.query(`ALTER TABLE "rsi_role_mappings" ADD CONSTRAINT "UQ_rsi_role_mappings_org_rank" UNIQUE (${this.quoteIdentifier(organizationIdColumnName)}, ${this.quoteIdentifier(rsiRankColumnName)})`);
        }
    }
}
exports.FixRsiRoleMappingsSoftDeleteUniqueConstraint1833000000000 = FixRsiRoleMappingsSoftDeleteUniqueConstraint1833000000000;
//# sourceMappingURL=1833000000000-FixRsiRoleMappingsSoftDeleteUniqueConstraint.js.map