"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOrganizationIdToBriefings1856000000000 = void 0;
class AddOrganizationIdToBriefings1856000000000 {
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveBriefingsColumnName(queryRunner, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'briefings'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        let organizationIdColumn = await this.resolveBriefingsColumnName(queryRunner, 'organizationId');
        if (!organizationIdColumn) {
            await queryRunner.query(`ALTER TABLE "briefings" ADD COLUMN "organizationId" uuid`);
            organizationIdColumn = 'organizationId';
        }
        const hasIndex = await queryRunner.query(`SELECT 1 FROM pg_indexes WHERE tablename = 'briefings' AND indexname = 'IDX_briefings_organizationId_createdAt'`);
        const createdAtColumn = await this.resolveBriefingsColumnName(queryRunner, 'createdAt');
        if (hasIndex.length === 0 && organizationIdColumn && createdAtColumn) {
            await queryRunner.query(`CREATE INDEX "IDX_briefings_organizationId_createdAt" ON "briefings" (${this.quoteIdentifier(organizationIdColumn)}, ${this.quoteIdentifier(createdAtColumn)})`);
        }
        const elementsColumn = await this.resolveBriefingsColumnName(queryRunner, 'elements');
        if (elementsColumn) {
            await queryRunner.query(`ALTER TABLE "briefings" ALTER COLUMN ${this.quoteIdentifier(elementsColumn)} SET DEFAULT '[]'`);
        }
    }
    async down(queryRunner) {
        const elementsColumn = await this.resolveBriefingsColumnName(queryRunner, 'elements');
        if (elementsColumn) {
            await queryRunner.query(`ALTER TABLE "briefings" ALTER COLUMN ${this.quoteIdentifier(elementsColumn)} DROP DEFAULT`);
        }
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_briefings_organizationId_createdAt"`);
        const organizationIdColumn = await this.resolveBriefingsColumnName(queryRunner, 'organizationId');
        if (organizationIdColumn) {
            await queryRunner.query(`ALTER TABLE "briefings" DROP COLUMN IF EXISTS ${this.quoteIdentifier(organizationIdColumn)}`);
        }
    }
}
exports.AddOrganizationIdToBriefings1856000000000 = AddOrganizationIdToBriefings1856000000000;
//# sourceMappingURL=1856000000000-AddOrganizationIdToBriefings.js.map