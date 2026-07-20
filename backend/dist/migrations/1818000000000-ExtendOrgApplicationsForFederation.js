"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtendOrgApplicationsForFederation1818000000000 = void 0;
const typeorm_1 = require("typeorm");
class ExtendOrgApplicationsForFederation1818000000000 {
    name = 'ExtendOrgApplicationsForFederation1818000000000';
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
    async hasIndex(queryRunner, tableName, indexName) {
        const table = await queryRunner.getTable(tableName);
        return table?.indices.some(index => index.name === indexName) ?? false;
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('org_applications');
        if (!table) {
            return;
        }
        const applicantOrgIdColumnName = await this.resolveColumnName(queryRunner, 'org_applications', 'applicantOrgId');
        if (!applicantOrgIdColumnName) {
            await queryRunner.addColumn('org_applications', new typeorm_1.TableColumn({
                name: 'applicantOrgId',
                type: 'varchar',
                isNullable: true,
            }));
        }
        const applicantOrgNameColumnName = await this.resolveColumnName(queryRunner, 'org_applications', 'applicantOrgName');
        if (!applicantOrgNameColumnName) {
            await queryRunner.addColumn('org_applications', new typeorm_1.TableColumn({
                name: 'applicantOrgName',
                type: 'varchar',
                length: '200',
                isNullable: true,
            }));
        }
        const organizationIdColumnName = await this.resolveColumnName(queryRunner, 'org_applications', 'organizationId');
        const targetTypeColumnName = await this.resolveColumnName(queryRunner, 'org_applications', 'targetType');
        if (organizationIdColumnName &&
            targetTypeColumnName &&
            !(await this.hasIndex(queryRunner, 'org_applications', 'idx_org_app_federation_target'))) {
            await queryRunner.createIndex('org_applications', new typeorm_1.TableIndex({
                name: 'idx_org_app_federation_target',
                columnNames: [organizationIdColumnName, targetTypeColumnName],
            }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('org_applications');
        if (!table) {
            return;
        }
        if (await this.hasIndex(queryRunner, 'org_applications', 'idx_org_app_federation_target')) {
            await queryRunner.dropIndex('org_applications', 'idx_org_app_federation_target');
        }
        const applicantOrgNameColumnName = await this.resolveColumnName(queryRunner, 'org_applications', 'applicantOrgName');
        if (applicantOrgNameColumnName) {
            await queryRunner.dropColumn('org_applications', applicantOrgNameColumnName);
        }
        const applicantOrgIdColumnName = await this.resolveColumnName(queryRunner, 'org_applications', 'applicantOrgId');
        if (applicantOrgIdColumnName) {
            await queryRunner.dropColumn('org_applications', applicantOrgIdColumnName);
        }
    }
}
exports.ExtendOrgApplicationsForFederation1818000000000 = ExtendOrgApplicationsForFederation1818000000000;
//# sourceMappingURL=1818000000000-ExtendOrgApplicationsForFederation.js.map