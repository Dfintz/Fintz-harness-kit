import { MigrationInterface, QueryRunner } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Fix preferences column data integrity.
 *
 * Normalizes empty-string and malformed preferences values to NULL so
 * that the simple-json column can be parsed safely. Also recreates the
 * functional index with a guard against non-JSON values.
 */
export class FixPreferencesJsonData1851000000000 implements MigrationInterface {
  name = 'FixPreferencesJsonData1851000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      return;
    }

    // 1. Nullify empty-string preferences (would crash JSON.parse and ::jsonb cast)
    const emptyResult = await queryRunner.query(
      `UPDATE users SET preferences = NULL WHERE preferences = ''`
    );
    logger.info('Fixed empty-string preferences', {
      rowsAffected: emptyResult?.[1] ?? 0,
    });

    // 2. Nullify non-JSON-object preferences (safeguard against corrupt data)
    const malformedResult = await queryRunner.query(
      `UPDATE users SET preferences = NULL
       WHERE preferences IS NOT NULL
         AND LEFT(TRIM(preferences), 1) != '{'`
    );
    logger.info('Fixed malformed preferences', {
      rowsAffected: malformedResult?.[1] ?? 0,
    });

    // 3. Drop the old index and recreate with a safer WHERE guard
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_profile_visibility`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_profile_visibility
        ON users ((preferences::jsonb->'privacy'->>'profileVisibility'))
        WHERE preferences IS NOT NULL AND preferences != '' AND LEFT(TRIM(preferences), 1) = '{';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      return;
    }

    // Restore the original index (data changes are not reversible)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_profile_visibility`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_profile_visibility
        ON users ((preferences::jsonb->'privacy'->>'profileVisibility'))
        WHERE preferences IS NOT NULL;
    `);
  }
}
