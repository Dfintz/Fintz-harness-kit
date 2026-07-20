"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameWatchlistOrgToCitizen1841000000000 = void 0;
class RenameWatchlistOrgToCitizen1841000000000 {
    name = 'RenameWatchlistOrgToCitizen1841000000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'org_watchlist_entries'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async hasIndex(queryRunner, indexName) {
        const table = await queryRunner.getTable('org_watchlist_entries');
        return table?.indices.some(index => index.name === indexName) ?? false;
    }
    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_owe_org_sid"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_owe_rsi_sid"`);
        const currentRsiOrgSidColumn = await this.resolveColumnName(queryRunner, 'rsiOrgSid');
        let currentRsiHandleColumn = await this.resolveColumnName(queryRunner, 'rsiHandle');
        if (currentRsiOrgSidColumn && !currentRsiHandleColumn) {
            await queryRunner.query(`ALTER TABLE "org_watchlist_entries" RENAME COLUMN ${this.quoteIdentifier(currentRsiOrgSidColumn)} TO "rsiHandle"`);
            currentRsiHandleColumn = 'rsiHandle';
        }
        const currentRsiOrgNameColumn = await this.resolveColumnName(queryRunner, 'rsiOrgName');
        let currentCitizenNameColumn = await this.resolveColumnName(queryRunner, 'citizenName');
        if (currentRsiOrgNameColumn && !currentCitizenNameColumn) {
            await queryRunner.query(`ALTER TABLE "org_watchlist_entries" RENAME COLUMN ${this.quoteIdentifier(currentRsiOrgNameColumn)} TO "citizenName"`);
            currentCitizenNameColumn = 'citizenName';
        }
        const organizationIdColumn = await this.resolveColumnName(queryRunner, 'organizationId');
        if (organizationIdColumn &&
            currentRsiHandleColumn &&
            !(await this.hasIndex(queryRunner, 'IDX_owe_org_handle'))) {
            await queryRunner.query(`CREATE UNIQUE INDEX "IDX_owe_org_handle" ON "org_watchlist_entries" (${this.quoteIdentifier(organizationIdColumn)}, ${this.quoteIdentifier(currentRsiHandleColumn)})`);
        }
        if (currentRsiHandleColumn && !(await this.hasIndex(queryRunner, 'IDX_owe_rsi_handle'))) {
            await queryRunner.query(`CREATE INDEX "IDX_owe_rsi_handle" ON "org_watchlist_entries" (${this.quoteIdentifier(currentRsiHandleColumn)})`);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_owe_org_handle"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_owe_rsi_handle"`);
        const currentRsiHandleColumn = await this.resolveColumnName(queryRunner, 'rsiHandle');
        let currentRsiOrgSidColumn = await this.resolveColumnName(queryRunner, 'rsiOrgSid');
        if (currentRsiHandleColumn && !currentRsiOrgSidColumn) {
            await queryRunner.query(`ALTER TABLE "org_watchlist_entries" RENAME COLUMN ${this.quoteIdentifier(currentRsiHandleColumn)} TO "rsiOrgSid"`);
            currentRsiOrgSidColumn = 'rsiOrgSid';
        }
        const currentCitizenNameColumn = await this.resolveColumnName(queryRunner, 'citizenName');
        const currentRsiOrgNameColumn = await this.resolveColumnName(queryRunner, 'rsiOrgName');
        if (currentCitizenNameColumn && !currentRsiOrgNameColumn) {
            await queryRunner.query(`ALTER TABLE "org_watchlist_entries" RENAME COLUMN ${this.quoteIdentifier(currentCitizenNameColumn)} TO "rsiOrgName"`);
        }
        const organizationIdColumn = await this.resolveColumnName(queryRunner, 'organizationId');
        if (organizationIdColumn &&
            currentRsiOrgSidColumn &&
            !(await this.hasIndex(queryRunner, 'IDX_owe_org_sid'))) {
            await queryRunner.query(`CREATE UNIQUE INDEX "IDX_owe_org_sid" ON "org_watchlist_entries" (${this.quoteIdentifier(organizationIdColumn)}, ${this.quoteIdentifier(currentRsiOrgSidColumn)})`);
        }
        if (currentRsiOrgSidColumn && !(await this.hasIndex(queryRunner, 'IDX_owe_rsi_sid'))) {
            await queryRunner.query(`CREATE INDEX "IDX_owe_rsi_sid" ON "org_watchlist_entries" (${this.quoteIdentifier(currentRsiOrgSidColumn)})`);
        }
    }
}
exports.RenameWatchlistOrgToCitizen1841000000000 = RenameWatchlistOrgToCitizen1841000000000;
//# sourceMappingURL=1841000000000-RenameWatchlistOrgToCitizen.js.map