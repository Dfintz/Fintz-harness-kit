import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddActivityQuickJoinTokenIndex
 *
 * Adds a partial expression index for quick-join token lookups:
 *   metadata->>'quickJoinToken' = :token
 *
 * This supports targeted retrieval in ActivityController preview/join by token,
 * replacing slower metadata text scans.
 */
export class AddActivityQuickJoinTokenIndex1863800000000 implements MigrationInterface {
  name = 'AddActivityQuickJoinTokenIndex1863800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Notes:
    //   1) `metadata` on `activities` is declared `simple-json`, which TypeORM
    //      persists as plain `text` in Postgres — not `jsonb`. The jsonb-only
    //      operators (`?`, `->>`, `->`) therefore fail at runtime with
    //      "operator does not exist: text ? unknown" / "text ->> unknown".
    //   2) The pg driver also treats `?` in raw `queryRunner.query()` as a
    //      positional bind placeholder, mangling any literal jsonb `?`.
    //   3) Cast `metadata::jsonb` before extracting the token. The cast is
    //      IMMUTABLE so it is index-safe. Guard with a NULL check to keep the
    //      index partial (matching the lookup pattern in ActivityController).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_activities_quick_join_token"
      ON "activities" (((metadata::jsonb)->>'quickJoinToken'))
      WHERE metadata IS NOT NULL AND (metadata::jsonb)->>'quickJoinToken' IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_activities_quick_join_token"
    `);
  }
}
