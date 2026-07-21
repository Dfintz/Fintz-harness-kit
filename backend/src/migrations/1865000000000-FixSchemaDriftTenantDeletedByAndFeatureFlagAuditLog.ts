import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables created before the TenantEntity `deletedBy` actor column existed. */
const DELETED_BY_TABLES = ['certifications', 'comments', 'skills', 'tags'] as const;

/**
 * Fixes entity-vs-DB schema drift discovered during the 2026-06-30 release.
 *
 * Two classes of drift (entity columns/tables that no migration ever created;
 * masked locally by DB_SYNCHRONIZE=true, absent in migration-only production):
 *
 *  1. `deletedBy` (TenantEntity soft-delete actor) missing from a few tables that
 *     were created before/without it. Production has `deletedAt` but not
 *     `deletedBy`, so loading these entities (which map `deletedBy`) 500s.
 *  2. `feature_flag_audit_logs` table entirely absent in production (the
 *     `FeatureFlagAuditLog` entity exists but no migration created the table).
 *
 * Idempotent (hasColumn / hasTable + guarded CREATE TYPE) so it is safe to run on
 * any environment regardless of how the schema was previously built. Purely
 * additive: new nullable columns + a new table — no existing data is altered.
 *
 * The `featureFlagId` FK to `feature_flags` is intentionally omitted: it is not
 * required for the entity's queries/inserts (TypeORM resolves the relation via the
 * join column), and the entity declares `onDelete: SET NULL` over a NOT NULL
 * column, which would block feature-flag deletion. Column-level parity (what the
 * code reads/writes) is what matters here.
 */
export class FixSchemaDriftTenantDeletedByAndFeatureFlagAuditLog1865000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Raw, idempotent DDL only (no queryRunner.getTable/addColumn) so this does not
    // depend on the `typeorm_metadata` table, which is absent in production.

    // 1. Add the missing TenantEntity `deletedBy` column to each affected table.
    for (const tableName of DELETED_BY_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "deletedBy" varchar(255)`
      );
    }

    // 2. Create the feature_flag_audit_logs enum + table + indexes if missing.
    // CREATE TYPE has no IF NOT EXISTS — guard on pg_type.
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

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ffal_featureFlagId" ON "feature_flag_audit_logs" ("featureFlagId")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ffal_userId" ON "feature_flag_audit_logs" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ffal_action_createdAt" ON "feature_flag_audit_logs" ("action", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ffal_featureFlagId_createdAt" ON "feature_flag_audit_logs" ("featureFlagId", "createdAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_flag_audit_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "feature_flag_audit_logs_action_enum"`);

    for (const tableName of DELETED_BY_TABLES) {
      await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "deletedBy"`);
    }
  }
}
