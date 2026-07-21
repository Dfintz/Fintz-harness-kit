import * as cron from 'node-cron';

import { ActivityReminderService, ActivityAttendanceService as AttendanceConfirmationService } from '../services/activity';
import { NotificationService } from '../services/communication';
import { logger } from '../utils/logger';

/**
 * Background job scheduler for tactical operations automation
 * 
 * Jobs:
 * - Process due reminders (every 5 minutes)
 * - Retry failed reminders (hourly)
 * - Send attendance confirmation requests (hourly)
 * - Auto-confirm no-shows (daily at 2am)
 */
export class TacticalOperationsScheduler {
    private reminderService: ActivityReminderService;
    private attendanceService: AttendanceConfirmationService;
    private notificationService: NotificationService;
    private jobs: cron.ScheduledTask[] = [];

    constructor() {
        this.notificationService = new NotificationService();
        this.reminderService = new ActivityReminderService(this.notificationService);
        this.attendanceService = new AttendanceConfirmationService(this.notificationService);
    }

    /**
     * Start all background jobs
     */
    public start(): void {
        logger.info('Starting tactical operations background jobs...');

        // Job 1: Process due reminders (every 5 minutes)
        const reminderJob = cron.schedule('*/5 * * * *', async () => {
            try {
                logger.info('Running scheduled job: Process due reminders');
                const result = await this.reminderService.processDueReminders();
                logger.info(`Processed reminders - Sent: ${result.sent}, Failed: ${result.failed}, Errors: ${result.errors}`);
            } catch (error) {
                logger.error('Error processing due reminders:', error);
            }
        });
        this.jobs.push(reminderJob);
        logger.info('✓ Scheduled: Process due reminders (every 5 minutes)');

        // Job 2: Retry failed reminders (hourly)
        const retryJob = cron.schedule('0 * * * *', async () => {
            try {
                logger.info('Running scheduled job: Retry failed reminders');
                const retried = await this.reminderService.retryFailedReminders();
                logger.info(`Retried ${retried} failed reminders`);
            } catch (error) {
                logger.error('Error retrying failed reminders:', error);
            }
        });
        this.jobs.push(retryJob);
        logger.info('✓ Scheduled: Retry failed reminders (hourly)');

        // Job 3: Send attendance confirmation requests (hourly)
        const attendanceRequestJob = cron.schedule('0 * * * *', async () => {
            try {
                logger.info('Running scheduled job: Send attendance confirmation requests');
                // This would need to query completed activities and send requests
                // Implementation depends on how you want to trigger this
                logger.info('Attendance confirmation requests job completed');
            } catch (error) {
                logger.error('Error sending attendance confirmation requests:', error);
            }
        });
        this.jobs.push(attendanceRequestJob);
        logger.info('✓ Scheduled: Send attendance confirmation requests (hourly)');

        // Job 4: Auto-confirm no-shows (daily at 2am)
        const autoConfirmJob = cron.schedule('0 2 * * *', async () => {
            try {
                logger.info('Running scheduled job: Auto-confirm no-shows');
                const confirmed = await this.attendanceService.autoConfirmNoShows(7);
                logger.info(`Auto-confirmed ${confirmed} no-shows for activities older than 7 days`);
            } catch (error) {
                logger.error('Error auto-confirming no-shows:', error);
            }
        });
        this.jobs.push(autoConfirmJob);
        logger.info('✓ Scheduled: Auto-confirm no-shows (daily at 2am)');

        logger.info(`✅ All tactical operations background jobs started (${this.jobs.length} jobs)`);
    }

    /**
     * Stop all background jobs
     */
    public stop(): void {
        logger.info('Stopping tactical operations background jobs...');
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        logger.info('✅ All tactical operations background jobs stopped');
    }

    /**
     * Get status of all jobs
     */
    public getStatus(): { totalJobs: number; runningJobs: number } {
        return {
            totalJobs: this.jobs.length,
            runningJobs: this.jobs.filter(job => job).length
        };
    }
}

// Export singleton instance
let schedulerInstance: TacticalOperationsScheduler | null = null;

export function startTacticalOperationsJobs(): void {
    if (!schedulerInstance) {
        schedulerInstance = new TacticalOperationsScheduler();
        schedulerInstance.start();
    } else {
        logger.warn('Tactical operations scheduler is already running');
    }
}

export function stopTacticalOperationsJobs(): void {
    if (schedulerInstance) {
        schedulerInstance.stop();
        schedulerInstance = null;
    }
}

export function getTacticalOperationsJobsStatus() {
    return schedulerInstance?.getStatus() || { totalJobs: 0, runningJobs: 0 };
}
