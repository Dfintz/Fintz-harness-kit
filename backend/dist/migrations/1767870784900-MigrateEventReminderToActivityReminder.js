"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrateEventReminderToActivityReminder1767870784900 = void 0;
const logger_1 = require("../utils/logger");
class MigrateEventReminderToActivityReminder1767870784900 {
    name = 'MigrateEventReminderToActivityReminder1767870784900';
    async up(queryRunner) {
        logger_1.logger.info('==================================================================');
        logger_1.logger.info('Starting migration: EventReminder → ActivityReminder');
        logger_1.logger.info('==================================================================');
        logger_1.logger.info('Step 1: Checking if event_reminders table exists...');
        const oldTable = await queryRunner.getTable('event_reminders');
        const existingActivityReminders = await queryRunner.getTable('activity_reminders');
        if (existingActivityReminders) {
            logger_1.logger.info('activity_reminders table already exists, skipping rename', {
                table: 'activity_reminders',
            });
            logger_1.logger.info('==================================================================');
            return;
        }
        if (!oldTable) {
            logger_1.logger.warn('event_reminders table does not exist', { table: 'event_reminders' });
            logger_1.logger.info('activity_reminders table will be created by synchronize if needed');
            logger_1.logger.info('==================================================================');
            return;
        }
        logger_1.logger.info('event_reminders table found', { table: 'event_reminders' });
        logger_1.logger.info('Step 2: Dropping old indexes...');
        try {
            await queryRunner.query(`
                DROP INDEX IF EXISTS "IDX_event_reminders_eventId_scheduledTime";
            `);
            logger_1.logger.info('Dropped index IDX_event_reminders_eventId_scheduledTime');
        }
        catch (_error) {
            logger_1.logger.warn('Index IDX_event_reminders_eventId_scheduledTime not found or already dropped');
        }
        try {
            await queryRunner.query(`
                DROP INDEX IF EXISTS "IDX_event_reminders_eventId";
            `);
            logger_1.logger.info('Dropped index IDX_event_reminders_eventId');
        }
        catch (_error) {
            logger_1.logger.warn('Index IDX_event_reminders_eventId not found or already dropped');
        }
        logger_1.logger.info('\nStep 3: Renaming eventId column to activityId...');
        await queryRunner.query(`
            ALTER TABLE "event_reminders" 
            RENAME COLUMN "eventId" TO "activityId";
        `);
        logger_1.logger.info('Column renamed: eventId → activityId');
        logger_1.logger.info('\nStep 4: Renaming event_reminders table to activity_reminders...');
        await queryRunner.query(`
            ALTER TABLE "event_reminders" 
            RENAME TO "activity_reminders";
        `);
        logger_1.logger.info('Table renamed: event_reminders → activity_reminders');
        logger_1.logger.info('\nStep 5: Creating new indexes...');
        await queryRunner.query(`
            CREATE INDEX "IDX_activity_reminders_activityId" 
            ON "activity_reminders" ("activityId");
        `);
        logger_1.logger.info('Created index IDX_activity_reminders_activityId');
        await queryRunner.query(`
            CREATE INDEX "IDX_activity_reminders_activityId_scheduledTime" 
            ON "activity_reminders" ("activityId", "scheduledTime");
        `);
        logger_1.logger.info('Created index IDX_activity_reminders_activityId_scheduledTime');
        logger_1.logger.info('\nStep 6: Verifying migration...');
        const newTable = await queryRunner.getTable('activity_reminders');
        if (newTable) {
            const activityIdColumn = newTable.findColumnByName('activityId');
            if (activityIdColumn) {
                const rowCount = await queryRunner.query(`
                    SELECT COUNT(*) as count FROM "activity_reminders"
                `);
                logger_1.logger.info(`✓ Migration successful! Table has ${rowCount[0].count} reminders`);
            }
            else {
                logger_1.logger.warn('activityId column not found in new table');
            }
        }
        else {
            logger_1.logger.warn('activity_reminders table not found after migration');
        }
        logger_1.logger.info('==================================================================');
        logger_1.logger.info('Migration completed successfully');
        logger_1.logger.info('==================================================================');
    }
    async down(queryRunner) {
        logger_1.logger.info('==================================================================');
        logger_1.logger.info('Rolling back migration: ActivityReminder → EventReminder');
        logger_1.logger.info('==================================================================');
        logger_1.logger.info('\nStep 1: Checking if activity_reminders table exists...');
        const newTable = await queryRunner.getTable('activity_reminders');
        if (!newTable) {
            logger_1.logger.warn('activity_reminders table does not exist, nothing to roll back');
            logger_1.logger.info('==================================================================');
            return;
        }
        logger_1.logger.info('activity_reminders table found');
        logger_1.logger.info('\nStep 2: Dropping new indexes...');
        try {
            await queryRunner.query(`
                DROP INDEX IF EXISTS "IDX_activity_reminders_activityId_scheduledTime";
            `);
            logger_1.logger.info('Dropped index IDX_activity_reminders_activityId_scheduledTime');
        }
        catch (_error) {
            logger_1.logger.warn('Index not found or already dropped');
        }
        try {
            await queryRunner.query(`
                DROP INDEX IF EXISTS "IDX_activity_reminders_activityId";
            `);
            logger_1.logger.info('Dropped index IDX_activity_reminders_activityId');
        }
        catch (_error) {
            logger_1.logger.warn('Index not found or already dropped');
        }
        logger_1.logger.info('\nStep 3: Renaming activity_reminders table back to event_reminders...');
        await queryRunner.query(`
            ALTER TABLE "activity_reminders" 
            RENAME TO "event_reminders";
        `);
        logger_1.logger.info('Table renamed: activity_reminders → event_reminders');
        logger_1.logger.info('\nStep 4: Renaming activityId column back to eventId...');
        await queryRunner.query(`
            ALTER TABLE "event_reminders" 
            RENAME COLUMN "activityId" TO "eventId";
        `);
        logger_1.logger.info('Column renamed: activityId → eventId');
        logger_1.logger.info('\nStep 5: Recreating old indexes...');
        await queryRunner.query(`
            CREATE INDEX "IDX_event_reminders_eventId" 
            ON "event_reminders" ("eventId");
        `);
        logger_1.logger.info('Created index IDX_event_reminders_eventId');
        await queryRunner.query(`
            CREATE INDEX "IDX_event_reminders_eventId_scheduledTime" 
            ON "event_reminders" ("eventId", "scheduledTime");
        `);
        logger_1.logger.info('Created index IDX_event_reminders_eventId_scheduledTime');
        logger_1.logger.info('==================================================================');
        logger_1.logger.info('Rollback completed successfully');
        logger_1.logger.info('==================================================================');
    }
}
exports.MigrateEventReminderToActivityReminder1767870784900 = MigrateEventReminderToActivityReminder1767870784900;
//# sourceMappingURL=1767870784900-MigrateEventReminderToActivityReminder.js.map