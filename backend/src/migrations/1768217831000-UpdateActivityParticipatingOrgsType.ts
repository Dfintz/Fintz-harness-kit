import { MigrationInterface, QueryRunner } from 'typeorm';

import { logger } from '../utils/logger';

export class UpdateActivityParticipatingOrgsType1768217831000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists
    const table = await queryRunner.getTable('activities');
    if (!table) {
      logger.warn('activities table does not exist, skipping migration');
      return;
    }

    // Check if column exists
    const column = table.columns.find(col => col.name === 'participatingOrgs');
    if (!column) {
      logger.warn('participatingOrgs column does not exist, skipping migration');
      return;
    }

    // Check current column type to avoid re-running migration
    const currentType = await queryRunner.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'activities' 
            AND column_name = 'participatingOrgs'
        `);

    if (currentType?.[0]?.data_type === 'jsonb') {
      logger.warn('participatingOrgs column is already jsonb type, skipping migration');
      return;
    }

    logger.info('Converting participatingOrgs column from text/json to jsonb...');

    // Drop the existing default constraint first
    // PostgreSQL cannot automatically cast default values from text to jsonb
    await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" DROP DEFAULT
        `);

    // Change column type from text/json to jsonb
    // Using USING clause to safely convert existing data
    await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" TYPE jsonb USING 
            CASE 
                WHEN "participatingOrgs" IS NULL THEN '[]'::jsonb
                WHEN "participatingOrgs" = '' THEN '[]'::jsonb
                ELSE "participatingOrgs"::jsonb
            END
        `);

    // Set default value for new rows to ensure empty array instead of NULL
    await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" SET DEFAULT '[]'::jsonb
        `);

    logger.info('Creating GIN index for participatingOrgs column...');

    // Create GIN index for better query performance on JSONB column
    // Check if index already exists to avoid errors
    const indexExists = await queryRunner.query(`
            SELECT 1 
            FROM pg_indexes 
            WHERE indexname = 'idx_activity_participating_orgs'
        `);

    if (!indexExists || indexExists.length === 0) {
      await queryRunner.query(`
                CREATE INDEX idx_activity_participating_orgs 
                ON activities USING gin("participatingOrgs")
            `);
      logger.info('✅ Successfully converted participatingOrgs to jsonb and added GIN index');
    } else {
      logger.warn('Index idx_activity_participating_orgs already exists, skipping index creation');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('activities');
    if (!table) {
      logger.warn('activities table does not exist, skipping rollback');
      return;
    }

    logger.info('Rolling back: Dropping GIN index...');

    // Drop the GIN index
    const indexExists = await queryRunner.query(`
            SELECT 1 
            FROM pg_indexes 
            WHERE indexname = 'idx_activity_participating_orgs'
        `);

    if (indexExists && indexExists.length > 0) {
      await queryRunner.query(`
                DROP INDEX IF EXISTS idx_activity_participating_orgs
            `);
    }

    logger.info('Rolling back: Converting participatingOrgs from jsonb to json...');

    // Remove default value before converting type
    await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" DROP DEFAULT
        `);

    // Convert back to json type
    // This preserves data but removes the jsonb-specific optimization
    await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" TYPE json USING "participatingOrgs"::json
        `);

    logger.info('✅ Successfully rolled back participatingOrgs column type');
  }
}
