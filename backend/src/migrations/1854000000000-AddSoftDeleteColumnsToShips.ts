import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddSoftDeleteColumnsToShips
 *
 * The Ship entity extends OptionalTenantEntity which declares `deletedAt`
 * and `deletedBy` columns, but the original migrations did not include them.
 * This causes 500 errors because TypeORM's @DeleteDateColumn adds an implicit
 * `WHERE "deletedAt" IS NULL` filter that fails when the column doesn't exist.
 *
 * Same pattern as 1820000000000-AddTenantColumnsToFleetShips which fixed the
 * identical issue for the fleet_ships table.
 *
 * Idempotent: guards each DDL statement to allow safe re-runs.
 */
export class AddSoftDeleteColumnsToShips1854000000000 implements MigrationInterface {
  name = 'AddSoftDeleteColumnsToShips1854000000000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveShipsColumnName(
    queryRunner: QueryRunner,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ships'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const deletedAtColumn = await this.resolveShipsColumnName(queryRunner, 'deletedAt');
    if (!deletedAtColumn) {
      await queryRunner.query(
        `ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP NULL`
      );
    }

    const deletedByColumn = await this.resolveShipsColumnName(queryRunner, 'deletedBy');
    if (!deletedByColumn) {
      await queryRunner.query(
        `ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "deletedBy" VARCHAR NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const deletedByColumn = await this.resolveShipsColumnName(queryRunner, 'deletedBy');
    if (deletedByColumn) {
      await queryRunner.query(
        `ALTER TABLE "ships" DROP COLUMN IF EXISTS ${this.quoteIdentifier(deletedByColumn)}`
      );
    }

    const deletedAtColumn = await this.resolveShipsColumnName(queryRunner, 'deletedAt');
    if (deletedAtColumn) {
      await queryRunner.query(
        `ALTER TABLE "ships" DROP COLUMN IF EXISTS ${this.quoteIdentifier(deletedAtColumn)}`
      );
    }
  }
}
