import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repurpose the achievements/gamification system into Custom Titles & Badges.
 *
 * achievements table:
 *   - ADD  type (varchar, default 'badge')  — 'title' | 'badge'
 *   - ADD  federationId (uuid, nullable, FK → federations)
 *   - ADD  metadata (jsonb, nullable)        — custom styling / colors
 *   - DROP points column
 *   - DROP criteria column
 *
 * user_achievements table:
 *   - ADD  isDisplayed (boolean, default true)
 *   - ADD  displaySlot (int, nullable)
 *
 * federations table:
 *   - ADD  settings (jsonb, default '{}')
 *
 * organizations.settings (jsonb) — no DDL needed, handled at app layer.
 */
export class RepurposeAchievementsToTitlesBadges1802000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── achievements table ──────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "achievements"
         ADD COLUMN "type" varchar NOT NULL DEFAULT 'badge'`
    );
    await queryRunner.query(
      `ALTER TABLE "achievements"
         ADD COLUMN "federationId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "achievements"
         ADD COLUMN "metadata" jsonb`
    );
    await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "points"`);
    await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "criteria"`);

    // FK: federationId → federations.id (CASCADE on delete)
    await queryRunner.query(
      `ALTER TABLE "achievements"
         ADD CONSTRAINT "FK_achievements_federationId"
         FOREIGN KEY ("federationId") REFERENCES "federations"("id")
         ON DELETE CASCADE`
    );

    // Index on type for filtered queries
    await queryRunner.query(`CREATE INDEX "IDX_achievements_type" ON "achievements" ("type")`);
    // Index on federationId for federation-scoped queries
    await queryRunner.query(
      `CREATE INDEX "IDX_achievements_federationId" ON "achievements" ("federationId")`
    );

    // ── user_achievements table ─────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "user_achievements"
         ADD COLUMN "isDisplayed" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "user_achievements"
         ADD COLUMN "displaySlot" int`
    );

    // ── federations table ───────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "federations"
         ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── federations table ───────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "federations" DROP COLUMN IF EXISTS "settings"`);

    // ── user_achievements table ─────────────────────────────────
    await queryRunner.query(`ALTER TABLE "user_achievements" DROP COLUMN IF EXISTS "displaySlot"`);
    await queryRunner.query(`ALTER TABLE "user_achievements" DROP COLUMN IF EXISTS "isDisplayed"`);

    // ── achievements table ──────────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_achievements_federationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_achievements_type"`);
    await queryRunner.query(
      `ALTER TABLE "achievements"
         DROP CONSTRAINT IF EXISTS "FK_achievements_federationId"`
    );
    await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "metadata"`);
    await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "federationId"`);
    await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "type"`);
    // Restore dropped columns
    await queryRunner.query(
      `ALTER TABLE "achievements"
         ADD COLUMN "points" int NOT NULL DEFAULT 10`
    );
    await queryRunner.query(
      `ALTER TABLE "achievements"
         ADD COLUMN "criteria" text`
    );
  }
}
