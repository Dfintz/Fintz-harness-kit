import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the organizationId column to the briefings table.
 *
 * The Briefing entity has always declared organizationId for tenant isolation,
 * but the column was never created via migration — it relied on TypeORM
 * synchronize.  Without the column the GET /api/v2/briefings query fails
 * with "column briefing.organizationId does not exist" (HTTP 500).
 */
export class AddOrganizationIdToBriefings1856000000000 implements MigrationInterface {
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveBriefingsColumnName(
    queryRunner: QueryRunner,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'briefings'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add organizationId column (nullable to match entity definition)
    let organizationIdColumn = await this.resolveBriefingsColumnName(queryRunner, 'organizationId');
    if (!organizationIdColumn) {
      await queryRunner.query(`ALTER TABLE "briefings" ADD COLUMN "organizationId" uuid`);
      organizationIdColumn = 'organizationId';
    }

    // Create composite index used by the entity @Index decorator
    const hasIndex = await queryRunner.query(
      `SELECT 1 FROM pg_indexes WHERE tablename = 'briefings' AND indexname = 'IDX_briefings_organizationId_createdAt'`
    );
    const createdAtColumn = await this.resolveBriefingsColumnName(queryRunner, 'createdAt');
    if (hasIndex.length === 0 && organizationIdColumn && createdAtColumn) {
      await queryRunner.query(
        `CREATE INDEX "IDX_briefings_organizationId_createdAt" ON "briefings" (${this.quoteIdentifier(organizationIdColumn)}, ${this.quoteIdentifier(createdAtColumn)})`
      );
    }

    // Set default for elements column so new briefings can be created without
    // explicitly passing an empty array.
    const elementsColumn = await this.resolveBriefingsColumnName(queryRunner, 'elements');
    if (elementsColumn) {
      await queryRunner.query(
        `ALTER TABLE "briefings" ALTER COLUMN ${this.quoteIdentifier(elementsColumn)} SET DEFAULT '[]'`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const elementsColumn = await this.resolveBriefingsColumnName(queryRunner, 'elements');
    if (elementsColumn) {
      await queryRunner.query(
        `ALTER TABLE "briefings" ALTER COLUMN ${this.quoteIdentifier(elementsColumn)} DROP DEFAULT`
      );
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_briefings_organizationId_createdAt"`);

    const organizationIdColumn = await this.resolveBriefingsColumnName(
      queryRunner,
      'organizationId'
    );
    if (organizationIdColumn) {
      await queryRunner.query(
        `ALTER TABLE "briefings" DROP COLUMN IF EXISTS ${this.quoteIdentifier(organizationIdColumn)}`
      );
    }
  }
}
