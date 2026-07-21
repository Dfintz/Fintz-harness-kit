import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * ExtendOrgApplicationsForFederation
 *
 * Federation Application System — Phase F1
 *
 * Adds `applicantOrgId` and `applicantOrgName` columns to `org_applications`
 * for tracking which organization is applying to join a federation.
 * Also adds 'federation' as a valid targetType value.
 *
 * Idempotent: guards DDL statements to allow safe re-runs.
 */
export class ExtendOrgApplicationsForFederation1818000000000 implements MigrationInterface {
  name = 'ExtendOrgApplicationsForFederation1818000000000';

  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [tableName, desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  private async hasIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string
  ): Promise<boolean> {
    const table = await queryRunner.getTable(tableName);
    return table?.indices.some(index => index.name === indexName) ?? false;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('org_applications');
    if (!table) {
      return;
    }

    // Add applicantOrgId column
    const applicantOrgIdColumnName = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'applicantOrgId'
    );
    if (!applicantOrgIdColumnName) {
      await queryRunner.addColumn(
        'org_applications',
        new TableColumn({
          name: 'applicantOrgId',
          type: 'varchar',
          isNullable: true,
        })
      );
    }

    // Add applicantOrgName column
    const applicantOrgNameColumnName = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'applicantOrgName'
    );
    if (!applicantOrgNameColumnName) {
      await queryRunner.addColumn(
        'org_applications',
        new TableColumn({
          name: 'applicantOrgName',
          type: 'varchar',
          length: '200',
          isNullable: true,
        })
      );
    }

    // Add index for federation application queries
    const organizationIdColumnName = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'organizationId'
    );
    const targetTypeColumnName = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'targetType'
    );

    if (
      organizationIdColumnName &&
      targetTypeColumnName &&
      !(await this.hasIndex(queryRunner, 'org_applications', 'idx_org_app_federation_target'))
    ) {
      await queryRunner.createIndex(
        'org_applications',
        new TableIndex({
          name: 'idx_org_app_federation_target',
          columnNames: [organizationIdColumnName, targetTypeColumnName],
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('org_applications');
    if (!table) {
      return;
    }

    if (await this.hasIndex(queryRunner, 'org_applications', 'idx_org_app_federation_target')) {
      await queryRunner.dropIndex('org_applications', 'idx_org_app_federation_target');
    }

    const applicantOrgNameColumnName = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'applicantOrgName'
    );
    if (applicantOrgNameColumnName) {
      await queryRunner.dropColumn('org_applications', applicantOrgNameColumnName);
    }

    const applicantOrgIdColumnName = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'applicantOrgId'
    );
    if (applicantOrgIdColumnName) {
      await queryRunner.dropColumn('org_applications', applicantOrgIdColumnName);
    }
  }
}
