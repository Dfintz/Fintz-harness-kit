import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Insurance Expiration Index to UserShips
 *
 * Changes:
 * 1. Adds index on insuranceExpires for efficient insurance tracking queries
 * 2. Adds composite index on (userId, insuranceExpires) for user-specific queries
 * 3. Both indexes exclude deleted records (WHERE deletedAt IS NULL)
 *
 * Rationale:
 * - Improves performance of getShipsNeedingInsurance queries
 * - Supports both user-specific and organization-wide insurance searches
 * - Partial indexes reduce index size and maintenance overhead
 */
export class AddInsuranceExpiresIndexToUserShips1764850000000 implements MigrationInterface {
  name = 'AddInsuranceExpiresIndexToUserShips1764850000000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

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
    const insuranceExpiresColumn =
      (await this.resolveColumnName(queryRunner, 'user_ships', 'insuranceExpires')) ??
      'insuranceExpires';
    const deletedAtColumn =
      (await this.resolveColumnName(queryRunner, 'user_ships', 'deletedAt')) ?? 'deletedAt';
    const userIdColumn =
      (await this.resolveColumnName(queryRunner, 'user_ships', 'userId')) ?? 'userId';

    // Add index on insuranceExpires for general insurance queries
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_insuranceExpires" 
            ON "user_ships" (${this.quoteIdentifier(insuranceExpiresColumn)}) 
            WHERE ${this.quoteIdentifier(deletedAtColumn)} IS NULL
              AND ${this.quoteIdentifier(insuranceExpiresColumn)} IS NOT NULL
        `);

    // Add composite index on (userId, insuranceExpires) for user-specific insurance queries
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_userId_insuranceExpires" 
            ON "user_ships" (${this.quoteIdentifier(userIdColumn)}, ${this.quoteIdentifier(insuranceExpiresColumn)}) 
            WHERE ${this.quoteIdentifier(deletedAtColumn)} IS NULL
              AND ${this.quoteIdentifier(insuranceExpiresColumn)} IS NOT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_userId_insuranceExpires"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_insuranceExpires"');
  }
}
