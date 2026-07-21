import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix UQ_rsi_role_mappings_org_rank to allow re-creating mappings after soft-delete.
 *
 * The original unique constraint covers ALL rows (including soft-deleted ones),
 * which causes "duplicate key value violates unique constraint" errors when a
 * user deletes a mapping and later creates a new one with the same rank.
 *
 * This migration replaces the absolute unique constraint with a partial unique
 * index that only applies to non-deleted rows (WHERE "deletedAt" IS NULL).
 */
export class FixRsiRoleMappingsSoftDeleteUniqueConstraint1833000000000 implements MigrationInterface {
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveColumnName(
    queryRunner: QueryRunner,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'rsi_role_mappings'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const organizationIdColumnName = await this.resolveColumnName(queryRunner, 'organizationId');
    const rsiRankColumnName = await this.resolveColumnName(queryRunner, 'rsiRank');
    const deletedAtColumnName = await this.resolveColumnName(queryRunner, 'deletedAt');

    if (!organizationIdColumnName || !rsiRankColumnName || !deletedAtColumnName) {
      return;
    }

    // Drop the existing unique constraint
    await queryRunner.query(
      `ALTER TABLE "rsi_role_mappings" DROP CONSTRAINT IF EXISTS "UQ_rsi_role_mappings_org_rank"`
    );

    // Drop the corresponding unique index if it exists separately
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_rsi_role_mappings_org_rank"`);

    // Create a partial unique index that only enforces uniqueness on non-deleted rows
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_rsi_role_mappings_org_rank" ON "rsi_role_mappings" (${this.quoteIdentifier(organizationIdColumnName)}, ${this.quoteIdentifier(rsiRankColumnName)}) WHERE ${this.quoteIdentifier(deletedAtColumnName)} IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const organizationIdColumnName = await this.resolveColumnName(queryRunner, 'organizationId');
    const rsiRankColumnName = await this.resolveColumnName(queryRunner, 'rsiRank');
    const deletedAtColumnName = await this.resolveColumnName(queryRunner, 'deletedAt');

    // Drop the partial unique index
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_rsi_role_mappings_org_rank"`);

    // Permanently remove any soft-deleted duplicates before restoring the full constraint
    if (deletedAtColumnName) {
      await queryRunner.query(
        `DELETE FROM "rsi_role_mappings" WHERE ${this.quoteIdentifier(deletedAtColumnName)} IS NOT NULL`
      );
    }

    // Re-create the original absolute unique constraint
    if (organizationIdColumnName && rsiRankColumnName) {
      await queryRunner.query(
        `ALTER TABLE "rsi_role_mappings" ADD CONSTRAINT "UQ_rsi_role_mappings_org_rank" UNIQUE (${this.quoteIdentifier(organizationIdColumnName)}, ${this.quoteIdentifier(rsiRankColumnName)})`
      );
    }
  }
}
