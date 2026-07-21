import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add targetType and applicantType discriminator columns to org_applications.
 *
 * These columns enable the unified Application entity pattern:
 *   - targetType: 'organization' | 'alliance' (what is being joined)
 *   - applicantType: 'user' | 'organization' (who is applying)
 *
 * All existing rows default to targetType='organization', applicantType='user'
 * (the original user→org flow).
 */
export class AddApplicationDiscriminators1770900100000 implements MigrationInterface {
  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    preferredName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [tableName, preferredName]
    );

    return rows[0]?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetTypeColumn = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'targetType'
    );
    const applicantTypeColumn = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'applicantType'
    );

    // Complete schema already contains discriminator columns and indexes.
    if (targetTypeColumn && applicantTypeColumn) {
      return;
    }

    // Add targetType column with default
    await queryRunner.query(`
      ALTER TABLE "org_applications"
      ADD COLUMN IF NOT EXISTS "targetType" varchar(20) NOT NULL DEFAULT 'organization'
    `);

    // Add applicantType column with default
    await queryRunner.query(`
      ALTER TABLE "org_applications"
      ADD COLUMN IF NOT EXISTS "applicantType" varchar(20) NOT NULL DEFAULT 'user'
    `);

    const resolvedTargetType = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'targetType'
    );
    const resolvedOrganizationId = await this.resolveColumnName(
      queryRunner,
      'org_applications',
      'organizationId'
    );
    const resolvedStatus = await this.resolveColumnName(queryRunner, 'org_applications', 'status');

    if (!resolvedTargetType || !resolvedOrganizationId || !resolvedStatus) {
      return;
    }

    // Index on targetType for filtering queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_org_applications_targetType"
      ON "org_applications" ("${resolvedTargetType}")
    `);

    // Composite index for queries scoped by target type + target entity + status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_org_applications_targetType_org_status"
      ON "org_applications" ("${resolvedTargetType}", "${resolvedOrganizationId}", "${resolvedStatus}")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('org_applications', 'IDX_org_applications_targetType_org_status');
    await queryRunner.dropIndex('org_applications', 'IDX_org_applications_targetType');
    await queryRunner.dropColumn('org_applications', 'applicantType');
    await queryRunner.dropColumn('org_applications', 'targetType');
  }
}
