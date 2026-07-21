import { MigrationInterface, QueryRunner } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration to rename EventReminder to ActivityReminder
 *
 * This migration:
 * 1. Renames the event_reminders table to activity_reminders
 * 2. Renames the eventId column to activityId
 * 3. Updates all indexes to use the new column name
 *
 * Part of v3.0.0 breaking changes - Activity domain consolidation
 *
 * IMPORTANT: This is a breaking change. Old code referencing EventReminder will fail.
 * Ensure all application code is updated before running this migration.
 */
export class MigrateEventReminderToActivityReminder1767870784900 implements MigrationInterface {
  name = 'MigrateEventReminderToActivityReminder1767870784900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    logger.info('==================================================================');
    logger.info('Starting migration: EventReminder → ActivityReminder');
    logger.info('==================================================================');

    // Step 1: Check if event_reminders table exists
    logger.info('Step 1: Checking if event_reminders table exists...');
    const oldTable = await queryRunner.getTable('event_reminders');

    // If the target table already exists, skip to avoid rename failure
    const existingActivityReminders = await queryRunner.getTable('activity_reminders');
    if (existingActivityReminders) {
      logger.info('activity_reminders table already exists, skipping rename', {
        table: 'activity_reminders',
      });
      logger.info('==================================================================');
      return;
    }

    if (!oldTable) {
      logger.warn('event_reminders table does not exist', { table: 'event_reminders' });
      logger.info('activity_reminders table will be created by synchronize if needed');
      logger.info('==================================================================');
      return;
    }

    logger.info('event_reminders table found', { table: 'event_reminders' });

    // Step 2: Drop existing indexes on eventId
    logger.info('Step 2: Dropping old indexes...');

    try {
      // Drop composite index on eventId and scheduledTime
      await queryRunner.query(`
                DROP INDEX IF EXISTS "IDX_event_reminders_eventId_scheduledTime";
            `);
      logger.info('Dropped index IDX_event_reminders_eventId_scheduledTime');
    } catch (_error) {
      logger.warn('Index IDX_event_reminders_eventId_scheduledTime not found or already dropped');
    }

    try {
      // Drop index on eventId
      await queryRunner.query(`
                DROP INDEX IF EXISTS "IDX_event_reminders_eventId";
            `);
      logger.info('Dropped index IDX_event_reminders_eventId');
    } catch (_error) {
      logger.warn('Index IDX_event_reminders_eventId not found or already dropped');
    }

    // Step 3: Rename the eventId column to activityId
    logger.info('\nStep 3: Renaming eventId column to activityId...');
    await queryRunner.query(`
            ALTER TABLE "event_reminders" 
            RENAME COLUMN "eventId" TO "activityId";
        `);
    logger.info('Column renamed: eventId → activityId');

    // Step 4: Rename the table
    logger.info('\nStep 4: Renaming event_reminders table to activity_reminders...');
    await queryRunner.query(`
            ALTER TABLE "event_reminders" 
            RENAME TO "activity_reminders";
        `);
    logger.info('Table renamed: event_reminders → activity_reminders');

    // Step 5: Create new indexes with updated column name
    logger.info('\nStep 5: Creating new indexes...');

    await queryRunner.query(`
            CREATE INDEX "IDX_activity_reminders_activityId" 
            ON "activity_reminders" ("activityId");
        `);
    logger.info('Created index IDX_activity_reminders_activityId');

    await queryRunner.query(`
            CREATE INDEX "IDX_activity_reminders_activityId_scheduledTime" 
            ON "activity_reminders" ("activityId", "scheduledTime");
        `);
    logger.info('Created index IDX_activity_reminders_activityId_scheduledTime');

    // Step 6: Verify migration
    logger.info('\nStep 6: Verifying migration...');
    const newTable = await queryRunner.getTable('activity_reminders');

    if (newTable) {
      const activityIdColumn = newTable.findColumnByName('activityId');
      if (activityIdColumn) {
        const rowCount = await queryRunner.query(`
                    SELECT COUNT(*) as count FROM "activity_reminders"
                `);
        logger.info(`✓ Migration successful! Table has ${rowCount[0].count} reminders`);
      } else {
        logger.warn('activityId column not found in new table');
      }
    } else {
      logger.warn('activity_reminders table not found after migration');
    }

    logger.info('==================================================================');
    logger.info('Migration completed successfully');
    logger.info('==================================================================');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    logger.info('==================================================================');
    logger.info('Rolling back migration: ActivityReminder → EventReminder');
    logger.info('==================================================================');

    // Step 1: Check if activity_reminders table exists
    logger.info('\nStep 1: Checking if activity_reminders table exists...');
    const newTable = await queryRunner.getTable('activity_reminders');

    if (!newTable) {
      logger.warn('activity_reminders table does not exist, nothing to roll back');
      logger.info('==================================================================');
      return;
    }

    logger.info('activity_reminders table found');

    // Step 2: Drop new indexes
    logger.info('\nStep 2: Dropping new indexes...');

    try {
      await queryRunner.query(`
                DROP INDEX IF EXISTS "IDX_activity_reminders_activityId_scheduledTime";
            `);
      logger.info('Dropped index IDX_activity_reminders_activityId_scheduledTime');
    } catch (_error) {
      logger.warn('Index not found or already dropped');
    }

    try {
      await queryRunner.query(`
                DROP INDEX IF EXISTS "IDX_activity_reminders_activityId";
            `);
      logger.info('Dropped index IDX_activity_reminders_activityId');
    } catch (_error) {
      logger.warn('Index not found or already dropped');
    }

    // Step 3: Rename the table back
    logger.info('\nStep 3: Renaming activity_reminders table back to event_reminders...');
    await queryRunner.query(`
            ALTER TABLE "activity_reminders" 
            RENAME TO "event_reminders";
        `);
    logger.info('Table renamed: activity_reminders → event_reminders');

    // Step 4: Rename the activityId column back to eventId
    logger.info('\nStep 4: Renaming activityId column back to eventId...');
    await queryRunner.query(`
            ALTER TABLE "event_reminders" 
            RENAME COLUMN "activityId" TO "eventId";
        `);
    logger.info('Column renamed: activityId → eventId');

    // Step 5: Recreate old indexes
    logger.info('\nStep 5: Recreating old indexes...');

    await queryRunner.query(`
            CREATE INDEX "IDX_event_reminders_eventId" 
            ON "event_reminders" ("eventId");
        `);
    logger.info('Created index IDX_event_reminders_eventId');

    await queryRunner.query(`
            CREATE INDEX "IDX_event_reminders_eventId_scheduledTime" 
            ON "event_reminders" ("eventId", "scheduledTime");
        `);
    logger.info('Created index IDX_event_reminders_eventId_scheduledTime');

    logger.info('==================================================================');
    logger.info('Rollback completed successfully');
    logger.info('==================================================================');
  }
}
