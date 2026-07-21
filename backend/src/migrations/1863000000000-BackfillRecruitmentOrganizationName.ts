import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills `activities.organizationName` for recruitment rows that were created
 * with the wrong value (the creator's session organization name instead of the
 * target/recruiting organization's name).
 *
 * The new code path in `recruitmentController.createRecruitment` always resolves
 * `organizationName` from the `organizations` table, so this only affects rows
 * created prior to that fix.
 *
 * The update is idempotent: it only touches rows where the stored name differs
 * from the canonical organization name.
 */
export class BackfillRecruitmentOrganizationName1863000000000 implements MigrationInterface {
  name = 'BackfillRecruitmentOrganizationName1863000000000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

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

  public async up(queryRunner: QueryRunner): Promise<void> {
    const activityOrganizationIdColumn = await this.resolveColumnName(
      queryRunner,
      'activities',
      'organizationId'
    );
    const activityTypeColumn = await this.resolveColumnName(
      queryRunner,
      'activities',
      'activityType'
    );
    const activityOrganizationNameColumn = await this.resolveColumnName(
      queryRunner,
      'activities',
      'organizationName'
    );
    const organizationIdColumn = await this.resolveColumnName(queryRunner, 'organizations', 'id');
    const organizationNameColumn = await this.resolveColumnName(
      queryRunner,
      'organizations',
      'name'
    );

    if (
      !activityOrganizationIdColumn ||
      !activityTypeColumn ||
      !activityOrganizationNameColumn ||
      !organizationIdColumn ||
      !organizationNameColumn
    ) {
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

  public async down(): Promise<void> {
    // Backfill is non-reversible — original (incorrect) names are not preserved.
  }
}
