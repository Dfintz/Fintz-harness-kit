"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixSchemaDriftTenantDeletedByAndFeatureFlagAuditLog1865000000000 = void 0;
const DELETED_BY_TABLES = ['certifications', 'comments', 'skills', 'tags'];
class FixSchemaDriftTenantDeletedByAndFeatureFlagAuditLog1865000000000 {
    async up(queryRunner) {
        for (const tableName of DELETED_BY_TABLES) {
            await queryRunner.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "deletedBy" varchar(255)`);
        }
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'feature_flag_audit_logs_action_enum'
        ) THEN
          CREATE TYPE "feature_flag_audit_logs_action_enum" AS ENUM (
            'created', 'updated', 'deleted', 'evaluated'
          );
        END IF;
      END
      $$;
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_flag_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "featureFlagId" character varying NOT NULL,
        "action" "feature_flag_audit_logs_action_enum" NOT NULL,
        "userId" character varying,
        "organizationId" character varying,
        "previousValue" text,
        "newValue" text,
        "evaluationResult" boolean,
        "metadata" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_flag_audit_logs_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ffal_featureFlagId" ON "feature_flag_audit_logs" ("featureFlagId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ffal_userId" ON "feature_flag_audit_logs" ("userId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ffal_action_createdAt" ON "feature_flag_audit_logs" ("action", "createdAt")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ffal_featureFlagId_createdAt" ON "feature_flag_audit_logs" ("featureFlagId", "createdAt")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "feature_flag_audit_logs"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "feature_flag_audit_logs_action_enum"`);
        for (const tableName of DELETED_BY_TABLES) {
            await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "deletedBy"`);
        }
    }
}
exports.FixSchemaDriftTenantDeletedByAndFeatureFlagAuditLog1865000000000 = FixSchemaDriftTenantDeletedByAndFeatureFlagAuditLog1865000000000;
//# sourceMappingURL=1865000000000-FixSchemaDriftTenantDeletedByAndFeatureFlagAuditLog.js.map