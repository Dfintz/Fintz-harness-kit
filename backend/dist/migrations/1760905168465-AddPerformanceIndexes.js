"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPerformanceIndexes1760905168465 = void 0;
class AddPerformanceIndexes1760905168465 {
    async up(queryRunner) {
        const createIndexIfColumnsExist = async (tableName, columns, indexQuery) => {
            try {
                const table = await queryRunner.getTable(tableName);
                if (!table) {
                    return;
                }
                const tableColumnNames = new Set((table.columns || []).map((c) => c.name));
                const missing = columns.filter(c => !tableColumnNames.has(c));
                if (missing.length > 0) {
                    return;
                }
                await queryRunner.query(indexQuery);
            }
            catch (_error) {
            }
        };
        await createIndexIfColumnsExist('activities', ['organizationId', 'scheduledStartDate'], `
            CREATE INDEX IF NOT EXISTS "idx_activities_org_date" 
            ON "activities"("organizationId", "scheduledStartDate")
        `);
        await createIndexIfColumnsExist('organization_members', ['organizationId', 'userId'], `
            CREATE INDEX IF NOT EXISTS "idx_org_members_org_user" 
            ON "organization_members"("organizationId", "userId")
        `);
        await createIndexIfColumnsExist('organization_members', ['organizationId', 'isActive'], `
            CREATE INDEX IF NOT EXISTS "idx_org_members_active" 
            ON "organization_members"("organizationId", "isActive") 
            WHERE "isActive" = true
        `);
        await createIndexIfColumnsExist('lfg_user_reputation', ['userId', 'overallScore'], `
            CREATE INDEX IF NOT EXISTS "idx_lfg_reputation_user_score" 
            ON "lfg_user_reputation"("userId", "overallScore" DESC)
        `);
        await createIndexIfColumnsExist('lfg_user_reputation', ['overallScore'], `
            CREATE INDEX IF NOT EXISTS "idx_lfg_reputation_score" 
            ON "lfg_user_reputation"("overallScore" DESC)
        `);
        await createIndexIfColumnsExist('organization_permissions', ['userId', 'organizationId'], `
            CREATE INDEX IF NOT EXISTS "idx_org_permissions_user_org" 
            ON "organization_permissions"("userId", "organizationId")
        `);
        await createIndexIfColumnsExist('organization_permissions', ['userId', 'isActive', 'expiresAt'], `
            CREATE INDEX IF NOT EXISTS "idx_org_permissions_active" 
            ON "organization_permissions"("userId", "isActive", "expiresAt") 
            WHERE "isActive" = true
        `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_permissions_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_permissions_user_org"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_lfg_reputation_score"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_lfg_reputation_user_score"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_members_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_members_org_user"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_activities_org_date"`);
    }
}
exports.AddPerformanceIndexes1760905168465 = AddPerformanceIndexes1760905168465;
//# sourceMappingURL=1760905168465-AddPerformanceIndexes.js.map