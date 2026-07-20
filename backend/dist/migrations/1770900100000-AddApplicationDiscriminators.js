"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddApplicationDiscriminators1770900100000 = void 0;
class AddApplicationDiscriminators1770900100000 {
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
        const targetTypeColumn = await this.resolveColumnName(queryRunner, 'org_applications', 'targetType');
        const applicantTypeColumn = await this.resolveColumnName(queryRunner, 'org_applications', 'applicantType');
        if (targetTypeColumn && applicantTypeColumn) {
            return;
        }
        await queryRunner.query(`
      ALTER TABLE "org_applications"
      ADD COLUMN IF NOT EXISTS "targetType" varchar(20) NOT NULL DEFAULT 'organization'
    `);
        await queryRunner.query(`
      ALTER TABLE "org_applications"
      ADD COLUMN IF NOT EXISTS "applicantType" varchar(20) NOT NULL DEFAULT 'user'
    `);
        const resolvedTargetType = await this.resolveColumnName(queryRunner, 'org_applications', 'targetType');
        const resolvedOrganizationId = await this.resolveColumnName(queryRunner, 'org_applications', 'organizationId');
        const resolvedStatus = await this.resolveColumnName(queryRunner, 'org_applications', 'status');
        if (!resolvedTargetType || !resolvedOrganizationId || !resolvedStatus) {
            return;
        }
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_org_applications_targetType"
      ON "org_applications" ("${resolvedTargetType}")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_org_applications_targetType_org_status"
      ON "org_applications" ("${resolvedTargetType}", "${resolvedOrganizationId}", "${resolvedStatus}")
    `);
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('org_applications', 'IDX_org_applications_targetType_org_status');
        await queryRunner.dropIndex('org_applications', 'IDX_org_applications_targetType');
        await queryRunner.dropColumn('org_applications', 'applicantType');
        await queryRunner.dropColumn('org_applications', 'targetType');
    }
}
exports.AddApplicationDiscriminators1770900100000 = AddApplicationDiscriminators1770900100000;
//# sourceMappingURL=1770900100000-AddApplicationDiscriminators.js.map