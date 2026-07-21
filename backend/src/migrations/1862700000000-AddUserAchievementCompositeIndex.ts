import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add composite index on user_achievements(userId, isDisplayed) to speed up
 * the public profile badge query which filters on both columns.
 *
 * Resolves 504 timeouts on GET /api/v2/achievements/user/:userId.
 */
export class AddUserAchievementCompositeIndex1862700000000 implements MigrationInterface {
  name = 'AddUserAchievementCompositeIndex1862700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_achievements_userId_isDisplayed"
        ON "user_achievements" ("userId", "isDisplayed")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_achievements_userId_isDisplayed"
    `);
  }
}
