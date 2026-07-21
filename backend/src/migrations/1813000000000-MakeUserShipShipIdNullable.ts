import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make user_ships.shipId nullable
 *
 * The entity UserShip already marks shipId as nullable (for imported ships
 * where the catalogue lookup may not match), but the original migration
 * created the column as NOT NULL. This aligns the database with the entity.
 */
export class MakeUserShipShipIdNullable1813000000000 implements MigrationInterface {
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async getShipIdColumnInfo(
    queryRunner: QueryRunner
  ): Promise<{ name: string; isNullable: boolean } | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_ships'
        AND lower(column_name) = lower('shipId')
      ORDER BY CASE WHEN column_name = 'shipId' THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `
    );

    const row = rows[0] as { column_name?: string; is_nullable?: string } | undefined;
    if (!row?.column_name) {
      return null;
    }

    return {
      name: row.column_name,
      isNullable: row.is_nullable === 'YES',
    };
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const shipIdColumn = await this.getShipIdColumnInfo(queryRunner);
    if (!shipIdColumn || shipIdColumn.isNullable) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "user_ships" ALTER COLUMN ${this.quoteIdentifier(shipIdColumn.name)} DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const shipIdColumn = await this.getShipIdColumnInfo(queryRunner);
    if (!shipIdColumn?.isNullable) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "user_ships" ALTER COLUMN ${this.quoteIdentifier(shipIdColumn.name)} SET NOT NULL`
    );
  }
}
