"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrUpdateSecurityLevelsTable1770100000000 = void 0;
class CreateOrUpdateSecurityLevelsTable1770100000000 {
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
        const tableExists = await queryRunner.hasTable('security_levels');
        if (tableExists) {
            const sourceOrgIdColumn = await this.resolveColumnName(queryRunner, 'security_levels', 'sourceOrgId');
            const targetOrgIdColumn = await this.resolveColumnName(queryRunner, 'security_levels', 'targetOrgId');
            const isActiveColumn = await this.resolveColumnName(queryRunner, 'security_levels', 'isActive');
            const expiresAtColumn = await this.resolveColumnName(queryRunner, 'security_levels', 'expiresAt');
            const updatedByColumn = await this.resolveColumnName(queryRunner, 'security_levels', 'updatedBy');
            if (sourceOrgIdColumn &&
                targetOrgIdColumn &&
                isActiveColumn &&
                expiresAtColumn &&
                updatedByColumn) {
                return;
            }
        }
        if (!tableExists) {
            await queryRunner.query(`
        CREATE TABLE security_levels (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "sourceOrgId" varchar(255) NOT NULL,
          "targetOrgId" varchar(255) NOT NULL,
          level integer NOT NULL CHECK (level >= 1 AND level <= 10),
          "resourceType" varchar NOT NULL,
          "accessLevel" varchar NOT NULL CHECK ("accessLevel" IN ('none', 'read', 'write', 'full')),
          restrictions jsonb,
          notes text,
          "isActive" boolean NOT NULL DEFAULT true,
          "expiresAt" timestamp,
          "approvedBy" varchar,
          "updatedBy" varchar,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT fk_security_level_source_org FOREIGN KEY ("sourceOrgId") REFERENCES organizations(id) ON DELETE CASCADE,
          CONSTRAINT fk_security_level_target_org FOREIGN KEY ("targetOrgId") REFERENCES organizations(id) ON DELETE CASCADE,
          CONSTRAINT check_different_orgs CHECK ("sourceOrgId" != "targetOrgId")
        )
      `);
            await queryRunner.query(`
        CREATE UNIQUE INDEX idx_security_levels_unique
        ON security_levels ("sourceOrgId", "targetOrgId", "resourceType")
      `);
            await queryRunner.query(`
        CREATE INDEX idx_security_levels_source ON security_levels ("sourceOrgId")
      `);
            await queryRunner.query(`
        CREATE INDEX idx_security_levels_target ON security_levels ("targetOrgId")
      `);
            await queryRunner.query(`
        CREATE INDEX idx_security_levels_active ON security_levels ("isActive")
      `);
        }
        else {
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD COLUMN IF NOT EXISTS "sourceOrgId" varchar(255)
      `);
            await queryRunner.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'security_levels'
              AND column_name = 'sourceOrgId'
              AND data_type = 'uuid'
          ) THEN
            ALTER TABLE security_levels ALTER COLUMN "sourceOrgId" TYPE varchar(255) USING "sourceOrgId"::varchar;
          END IF;
        END $$
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD COLUMN IF NOT EXISTS "targetOrgId" varchar(255)
      `);
            await queryRunner.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'security_levels'
              AND column_name = 'targetOrgId'
              AND data_type = 'uuid'
          ) THEN
            ALTER TABLE security_levels ALTER COLUMN "targetOrgId" TYPE varchar(255) USING "targetOrgId"::varchar;
          END IF;
        END $$
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD COLUMN IF NOT EXISTS notes text
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD COLUMN IF NOT EXISTS "expiresAt" timestamp
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD COLUMN IF NOT EXISTS "updatedBy" varchar
      `);
            const hasFromColumn = await queryRunner.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'security_levels'
          AND column_name = 'fromOrganizationId'
      `);
            if (hasFromColumn.length > 0) {
                await queryRunner.query(`
          UPDATE security_levels
          SET "sourceOrgId" = "fromOrganizationId"
          WHERE "sourceOrgId" IS NULL
        `);
                await queryRunner.query(`
          UPDATE security_levels
          SET "targetOrgId" = "toOrganizationId"
          WHERE "targetOrgId" IS NULL
        `);
                await queryRunner.query(`
          ALTER TABLE security_levels
          DROP COLUMN IF EXISTS "fromOrganizationId"
        `);
                await queryRunner.query(`
          ALTER TABLE security_levels
          DROP COLUMN IF EXISTS "toOrganizationId"
        `);
            }
            await queryRunner.query(`
        ALTER TABLE security_levels
        DROP CONSTRAINT IF EXISTS fk_security_level_source_org
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD CONSTRAINT fk_security_level_source_org
        FOREIGN KEY ("sourceOrgId") REFERENCES organizations(id) ON DELETE CASCADE
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        DROP CONSTRAINT IF EXISTS fk_security_level_target_org
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD CONSTRAINT fk_security_level_target_org
        FOREIGN KEY ("targetOrgId") REFERENCES organizations(id) ON DELETE CASCADE
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        DROP CONSTRAINT IF EXISTS check_different_orgs
      `);
            await queryRunner.query(`
        ALTER TABLE security_levels
        ADD CONSTRAINT check_different_orgs CHECK ("sourceOrgId" != "targetOrgId")
      `);
            await queryRunner.query(`
        DROP INDEX IF EXISTS idx_security_levels_unique
      `);
            await queryRunner.query(`
        CREATE UNIQUE INDEX idx_security_levels_unique
        ON security_levels ("sourceOrgId", "targetOrgId", "resourceType")
      `);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_security_levels_active`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_security_levels_target`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_security_levels_source`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_security_levels_unique`);
        await queryRunner.query(`DROP TABLE IF EXISTS security_levels CASCADE`);
    }
}
exports.CreateOrUpdateSecurityLevelsTable1770100000000 = CreateOrUpdateSecurityLevelsTable1770100000000;
//# sourceMappingURL=1770100000000-CreateOrUpdateSecurityLevelsTable.js.map