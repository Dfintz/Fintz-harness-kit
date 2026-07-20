"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddUserRsiCitizenRecord1864200000000 = void 0;
class AddUserRsiCitizenRecord1864200000000 {
    name = 'AddUserRsiCitizenRecord1864200000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replaceAll('"', '""')}"`;
    }
    async resolveUsersColumnName(queryRunner, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rsiCitizenRecord" character varying`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_rsi_citizen_record"`);
        const rsiCitizenRecordColumn = await this.resolveUsersColumnName(queryRunner, 'rsiCitizenRecord');
        const rsiVerifiedColumn = await this.resolveUsersColumnName(queryRunner, 'rsiVerified');
        if (rsiCitizenRecordColumn && rsiVerifiedColumn) {
            await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_rsi_citizen_record_verified" ON "users" (${this.quoteIdentifier(rsiCitizenRecordColumn)}) WHERE ${this.quoteIdentifier(rsiCitizenRecordColumn)} IS NOT NULL AND ${this.quoteIdentifier(rsiVerifiedColumn)} = true`);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_rsi_citizen_record_verified"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_rsi_citizen_record"`);
        const rsiCitizenRecordColumn = await this.resolveUsersColumnName(queryRunner, 'rsiCitizenRecord');
        if (rsiCitizenRecordColumn) {
            await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS ${this.quoteIdentifier(rsiCitizenRecordColumn)}`);
        }
    }
}
exports.AddUserRsiCitizenRecord1864200000000 = AddUserRsiCitizenRecord1864200000000;
//# sourceMappingURL=1864200000000-AddUserRsiCitizenRecord.js.map