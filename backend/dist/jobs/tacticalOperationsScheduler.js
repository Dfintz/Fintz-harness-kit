"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TacticalOperationsScheduler = void 0;
exports.startTacticalOperationsJobs = startTacticalOperationsJobs;
exports.stopTacticalOperationsJobs = stopTacticalOperationsJobs;
exports.getTacticalOperationsJobsStatus = getTacticalOperationsJobsStatus;
const cron = __importStar(require("node-cron"));
const activity_1 = require("../services/activity");
const communication_1 = require("../services/communication");
const logger_1 = require("../utils/logger");
class TacticalOperationsScheduler {
    reminderService;
    attendanceService;
    notificationService;
    jobs = [];
    constructor() {
        this.notificationService = new communication_1.NotificationService();
        this.reminderService = new activity_1.ActivityReminderService(this.notificationService);
        this.attendanceService = new activity_1.ActivityAttendanceService(this.notificationService);
    }
    start() {
        logger_1.logger.info('Starting tactical operations background jobs...');
        const reminderJob = cron.schedule('*/5 * * * *', async () => {
            try {
                logger_1.logger.info('Running scheduled job: Process due reminders');
                const result = await this.reminderService.processDueReminders();
                logger_1.logger.info(`Processed reminders - Sent: ${result.sent}, Failed: ${result.failed}, Errors: ${result.errors}`);
            }
            catch (error) {
                logger_1.logger.error('Error processing due reminders:', error);
            }
        });
        this.jobs.push(reminderJob);
        logger_1.logger.info('✓ Scheduled: Process due reminders (every 5 minutes)');
        const retryJob = cron.schedule('0 * * * *', async () => {
            try {
                logger_1.logger.info('Running scheduled job: Retry failed reminders');
                const retried = await this.reminderService.retryFailedReminders();
                logger_1.logger.info(`Retried ${retried} failed reminders`);
            }
            catch (error) {
                logger_1.logger.error('Error retrying failed reminders:', error);
            }
        });
        this.jobs.push(retryJob);
        logger_1.logger.info('✓ Scheduled: Retry failed reminders (hourly)');
        const attendanceRequestJob = cron.schedule('0 * * * *', async () => {
            try {
                logger_1.logger.info('Running scheduled job: Send attendance confirmation requests');
                logger_1.logger.info('Attendance confirmation requests job completed');
            }
            catch (error) {
                logger_1.logger.error('Error sending attendance confirmation requests:', error);
            }
        });
        this.jobs.push(attendanceRequestJob);
        logger_1.logger.info('✓ Scheduled: Send attendance confirmation requests (hourly)');
        const autoConfirmJob = cron.schedule('0 2 * * *', async () => {
            try {
                logger_1.logger.info('Running scheduled job: Auto-confirm no-shows');
                const confirmed = await this.attendanceService.autoConfirmNoShows(7);
                logger_1.logger.info(`Auto-confirmed ${confirmed} no-shows for activities older than 7 days`);
            }
            catch (error) {
                logger_1.logger.error('Error auto-confirming no-shows:', error);
            }
        });
        this.jobs.push(autoConfirmJob);
        logger_1.logger.info('✓ Scheduled: Auto-confirm no-shows (daily at 2am)');
        logger_1.logger.info(`✅ All tactical operations background jobs started (${this.jobs.length} jobs)`);
    }
    stop() {
        logger_1.logger.info('Stopping tactical operations background jobs...');
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        logger_1.logger.info('✅ All tactical operations background jobs stopped');
    }
    getStatus() {
        return {
            totalJobs: this.jobs.length,
            runningJobs: this.jobs.filter(job => job).length
        };
    }
}
exports.TacticalOperationsScheduler = TacticalOperationsScheduler;
let schedulerInstance = null;
function startTacticalOperationsJobs() {
    if (!schedulerInstance) {
        schedulerInstance = new TacticalOperationsScheduler();
        schedulerInstance.start();
    }
    else {
        logger_1.logger.warn('Tactical operations scheduler is already running');
    }
}
function stopTacticalOperationsJobs() {
    if (schedulerInstance) {
        schedulerInstance.stop();
        schedulerInstance = null;
    }
}
function getTacticalOperationsJobsStatus() {
    return schedulerInstance?.getStatus() || { totalJobs: 0, runningJobs: 0 };
}
//# sourceMappingURL=tacticalOperationsScheduler.js.map