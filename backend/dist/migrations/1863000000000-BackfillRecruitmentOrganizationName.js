"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackfillRecruitmentOrganizationName1863000000000 = void 0;
class BackfillRecruitmentOrganizationName1863000000000 {
    name = 'BackfillRecruitmentOrganizationName1863000000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, tableName, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [tableName, desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const activityOrganizationIdColumn = await this.resolveColumnName(queryRunner, 'activities', 'organizationId');
        const activityTypeColumn = await this.resolveColumnName(queryRunner, 'activities', 'activityType');
        const activityOrganizationNameColumn = await this.resolveColumnName(queryRunner, 'activities', 'organizationName');
        const organizationIdColumn = await this.resolveColumnName(queryRunner, 'organizations', 'id');
        const organizationNameColumn = await this.resolveColumnName(queryRunner, 'organizations', 'name');
        if (!activityOrganizationIdColumn ||
            !activityTypeColumn ||
            !activityOrganizationNameColumn ||
            !organizationIdColumn ||
            !organizationNameColumn) {
            return;
        }
        await queryRunner.query(`
      UPDATE "activities" a
      SET ${this.quoteIdentifier(activityOrganizationNameColumn)} = o.${this.quoteIdentifier(organizationNameColumn)}
      FROM "organizations" o
      WHERE a.${this.quoteIdentifier(activityOrganizationIdColumn)} = o.${this.quoteIdentifier(organizationIdColumn)}
        AND a.${this.quoteIdentifier(activityTypeColumn)} = 'recruitment'
        AND a.${this.quoteIdentifier(activityOrganizationNameColumn)} IS DISTINCT FROM o.${this.quoteIdentifier(organizationNameColumn)}
    `);
    }
    async down() {
    }
}
exports.BackfillRecruitmentOrganizationName1863000000000 = BackfillRecruitmentOrganizationName1863000000000;
//# sourceMappingURL=1863000000000-BackfillRecruitmentOrganizationName.js.map