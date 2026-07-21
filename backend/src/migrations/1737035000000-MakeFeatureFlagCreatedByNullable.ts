import { MigrationInterface, QueryRunner } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Make created_by column nullable in feature_flags table
 * This allows system-created feature flags without requiring a user UUID
 */
export class MakeFeatureFlagCreatedByNullable1737035000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists
    const table = await queryRunner.getTable('feature_flags');
    if (!table) {
      logger.warn('feature_flags table does not exist, skipping migration');
      return;
    }

    // Check if created_by column exists
    const createdByColumn = table.findColumnByName('created_by');
    if (!createdByColumn) {
      logger.warn('created_by column does not exist, skipping migration');
      return;
    }

    // Make created_by nullable
    logger.info('Making created_by column nullable in feature_flags table');
    await queryRunner.query(`
      ALTER TABLE "feature_flags" 
      ALTER COLUMN "created_by" DROP NOT NULL
    `);

    logger.info('Successfully made created_by column nullable');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('feature_flags');
    if (!table) {
      return;
    }

    // Make created_by NOT NULL again
    // Note: This will fail if there are rows with NULL created_by
    logger.info('Making created_by column NOT NULL in feature_flags table');
    await queryRunner.query(`
      ALTER TABLE "feature_flags" 
      ALTER COLUMN "created_by" SET NOT NULL
    `);
  }
}
