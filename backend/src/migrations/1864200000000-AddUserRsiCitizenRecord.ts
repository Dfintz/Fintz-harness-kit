import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRsiCitizenRecord1864200000000 implements MigrationInterface {
  name = 'AddUserRsiCitizenRecord1864200000000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
  }

  private async resolveUsersColumnName(
    queryRunner: QueryRunner,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rsiCitizenRecord" character varying`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_rsi_citizen_record"`);

    const rsiCitizenRecordColumn = await this.resolveUsersColumnName(
      queryRunner,
      'rsiCitizenRecord'
    );
    const rsiVerifiedColumn = await this.resolveUsersColumnName(queryRunner, 'rsiVerified');

    if (rsiCitizenRecordColumn && rsiVerifiedColumn) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_rsi_citizen_record_verified" ON "users" (${this.quoteIdentifier(rsiCitizenRecordColumn)}) WHERE ${this.quoteIdentifier(rsiCitizenRecordColumn)} IS NOT NULL AND ${this.quoteIdentifier(rsiVerifiedColumn)} = true`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_rsi_citizen_record_verified"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_rsi_citizen_record"`);

    const rsiCitizenRecordColumn = await this.resolveUsersColumnName(
      queryRunner,
      'rsiCitizenRecord'
    );
    if (rsiCitizenRecordColumn) {
      await queryRunner.query(
        `ALTER TABLE "users" DROP COLUMN IF EXISTS ${this.quoteIdentifier(rsiCitizenRecordColumn)}`
      );
    }
  }
}
