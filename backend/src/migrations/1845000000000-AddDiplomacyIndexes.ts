import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * H5 — Add composite indexes for alliance_diplomacy bidirectional lookups.
 * Queries use OR on (orgId1, orgId2) — both directions need an index.
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — Finding H5
 */
export class AddDiplomacyIndexes1845000000000 implements MigrationInterface {
  name = 'AddDiplomacyIndexes1845000000000';

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
        AND table_name = 'alliance_diplomacy'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const orgId1Column = await this.resolveColumnName(queryRunner, 'orgId1');
    const orgId2Column = await this.resolveColumnName(queryRunner, 'orgId2');

    if (orgId1Column && orgId2Column) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_diplomacy_org1_org2')} ON ${this.quoteIdentifier('alliance_diplomacy')} (${this.quoteIdentifier(orgId1Column)}, ${this.quoteIdentifier(orgId2Column)})`
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_diplomacy_org2_org1')} ON ${this.quoteIdentifier('alliance_diplomacy')} (${this.quoteIdentifier(orgId2Column)}, ${this.quoteIdentifier(orgId1Column)})`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_diplomacy_org2_org1');
    await queryRunner.query('DROP INDEX IF EXISTS idx_diplomacy_org1_org2');
  }
}
