import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddMissionSourceReference
 *
 * Adds a nullable `sourceReference` column to the `missions` table and a
 * unique index on (organizationId, sourceReference) to prevent TOCTOU duplicate
 * imports from external catalogs (e.g. SCMDB).
 *
 * Format: `<provider>:<externalId>` — e.g. `scmdb:ABC123`
 *
 * Design decisions:
 * - Nullable: missions created manually have no external source.
 * - Unique index only covers non-NULL values: PostgreSQL treats each NULL as
 *   distinct from every other NULL, so the unique constraint only fires when
 *   two rows share the same non-NULL (organizationId, sourceReference) pair.
 * - No backfill: existing imported missions retain NULL; they won't conflict.
 *   Future imports that set sourceReference will be protected going forward.
 *
 * Closes the TOCTOU race documented in:
 *   backend/src/services/content/MissionService.ts importScmdbMissionByUrl()
 */
export class AddMissionSourceReference20260715100000 implements MigrationInterface {
  name = 'AddMissionSourceReference20260715100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the column (nullable, no default required)
    await queryRunner.query(`
      ALTER TABLE "missions"
      ADD COLUMN IF NOT EXISTS "sourceReference" character varying(255)
    `);

    // 2. Create the partial unique index on (organizationId, sourceReference)
    //    WHERE sourceReference IS NOT NULL — this explicitly excludes NULL rows
    //    from the uniqueness check, which is more explicit than relying on
    //    PostgreSQL's NULL-distinctness behaviour.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_mission_org_source_ref_unique"
      ON "missions" ("organizationId", "sourceReference")
      WHERE "sourceReference" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first, then column
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_mission_org_source_ref_unique"
    `);

    await queryRunner.query(`
      ALTER TABLE "missions"
      DROP COLUMN IF EXISTS "sourceReference"
    `);
  }
}
