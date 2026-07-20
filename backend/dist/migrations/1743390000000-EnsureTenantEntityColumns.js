"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnsureTenantEntityColumns1743390000000 = void 0;
class EnsureTenantEntityColumns1743390000000 {
    tables = ['webhooks', 'bounties', 'tunnels', 'trading_routes'];
    async up(queryRunner) {
        for (const tableName of this.tables) {
            const table = await queryRunner.getTable(tableName);
            if (!table) {
                continue;
            }
            if (!table.findColumnByName('sharedWithOrgs')) {
                await queryRunner.query(`ALTER TABLE "${tableName}" ADD COLUMN "sharedWithOrgs" text DEFAULT ''`);
            }
            if (!table.findColumnByName('deletedAt')) {
                await queryRunner.query(`ALTER TABLE "${tableName}" ADD COLUMN "deletedAt" timestamp`);
            }
            if (!table.findColumnByName('deletedBy')) {
                await queryRunner.query(`ALTER TABLE "${tableName}" ADD COLUMN "deletedBy" varchar(255)`);
            }
        }
    }
    async down(queryRunner) {
        for (const tableName of this.tables) {
            const table = await queryRunner.getTable(tableName);
            if (!table) {
                continue;
            }
            if (table.findColumnByName('sharedWithOrgs')) {
                await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN "sharedWithOrgs"`);
            }
            if (table.findColumnByName('deletedAt')) {
                await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN "deletedAt"`);
            }
            if (table.findColumnByName('deletedBy')) {
                await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN "deletedBy"`);
            }
        }
    }
}
exports.EnsureTenantEntityColumns1743390000000 = EnsureTenantEntityColumns1743390000000;
//# sourceMappingURL=1743390000000-EnsureTenantEntityColumns.js.map