import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add functional index on users.preferences JSONB for profileVisibility filtering.
 * Enables the community members directory to efficiently filter users by privacy tier
 * without full-table scans on the JSONB column.
 *
 * @see docs/COMMUNITY_MEMBERS_DIRECTORY_PLAN.md
 */
export class AddUserProfileVisibilityIndex1849000000000 implements MigrationInterface {
  name = 'AddUserProfileVisibilityIndex1849000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      return;
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_profile_visibility
        ON users ((preferences::jsonb->'privacy'->>'profileVisibility'))
        WHERE preferences IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      return;
    }

    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_profile_visibility;`);
  }
}
