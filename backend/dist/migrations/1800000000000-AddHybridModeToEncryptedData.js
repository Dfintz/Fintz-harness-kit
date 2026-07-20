"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddHybridModeToEncryptedData1800000000000 = void 0;
class AddHybridModeToEncryptedData1800000000000 {
    name = 'AddHybridModeToEncryptedData1800000000000';
    async resolveColumnName(queryRunner, tableName, preferredName) {
        const rows = await queryRunner.query(`SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`, [tableName, preferredName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "encrypted_data"
      ADD COLUMN IF NOT EXISTS "encryptionMode" varchar(10) NOT NULL DEFAULT 'flat'
    `);
        await queryRunner.query(`
      ALTER TABLE "encrypted_data"
      ADD COLUMN IF NOT EXISTS "dekId" varchar(64)
    `);
        await queryRunner.query(`
      ALTER TABLE "encrypted_data"
      ADD COLUMN IF NOT EXISTS "migrationStatus" varchar(10) NOT NULL DEFAULT 'none'
    `);
        const organizationIdColumn = await this.resolveColumnName(queryRunner, 'encrypted_data', 'organizationId');
        const encryptionModeColumn = await this.resolveColumnName(queryRunner, 'encrypted_data', 'encryptionMode');
        const dekIdColumn = await this.resolveColumnName(queryRunner, 'encrypted_data', 'dekId');
        const migrationStatusColumn = await this.resolveColumnName(queryRunner, 'encrypted_data', 'migrationStatus');
        if (encryptionModeColumn) {
            await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_encrypted_data_encryption_mode"
        ON "encrypted_data" ("${encryptionModeColumn}")
      `);
        }
        if (dekIdColumn) {
            await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_encrypted_data_dek_id"
        ON "encrypted_data" ("${dekIdColumn}")
      `);
        }
        if (organizationIdColumn && migrationStatusColumn) {
            await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_encrypted_data_migration_status"
        ON "encrypted_data" ("${organizationIdColumn}", "${migrationStatusColumn}")
        WHERE "${migrationStatusColumn}" != 'none'
      `);
        }
        const dekReferenceColumn = await this.resolveColumnName(queryRunner, 'data_encryption_keys', 'dekId');
        if (dekIdColumn && dekReferenceColumn) {
            await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = 'encrypted_data'
              AND constraint_name = 'FK_encrypted_data_dek'
          ) THEN
            ALTER TABLE "encrypted_data"
            ADD CONSTRAINT "FK_encrypted_data_dek"
            FOREIGN KEY ("${dekIdColumn}") REFERENCES "data_encryption_keys"("${dekReferenceColumn}")
            ON DELETE SET NULL;
          END IF;
        END $$;
      `);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "encrypted_data" DROP CONSTRAINT IF EXISTS "FK_encrypted_data_dek"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_encrypted_data_migration_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_encrypted_data_dek_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_encrypted_data_encryption_mode"`);
        await queryRunner.query(`ALTER TABLE "encrypted_data" DROP COLUMN IF EXISTS "migrationStatus"`);
        await queryRunner.query(`ALTER TABLE "encrypted_data" DROP COLUMN IF EXISTS "dekId"`);
        await queryRunner.query(`ALTER TABLE "encrypted_data" DROP COLUMN IF EXISTS "encryptionMode"`);
    }
}
exports.AddHybridModeToEncryptedData1800000000000 = AddHybridModeToEncryptedData1800000000000;
//# sourceMappingURL=1800000000000-AddHybridModeToEncryptedData.js.map