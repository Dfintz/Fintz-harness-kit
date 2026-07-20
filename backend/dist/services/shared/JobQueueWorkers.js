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
exports.registerBullMQJobs = registerBullMQJobs;
exports.shutdownBullMQJobs = shutdownBullMQJobs;
const logger_1 = require("../../utils/logger");
const JobQueue_1 = require("./JobQueue");
async function registerBullMQJobs() {
    logger_1.logger.info('[BullMQ] Registering job workers and schedules...');
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.GDPR_EXPORT, async () => {
        const { GdprExportProcessingJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/gdprExportProcessing')));
        const job = new GdprExportProcessingJob();
        await job.execute();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.GDPR_EXPORT, 'process-exports', '*/5 * * * *');
    if (process.env.NODE_ENV === 'production') {
        await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.GDPR_CLEANUP, async () => {
            const { GdprDataCleanupJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/gdprDataCleanup')));
            const job = new GdprDataCleanupJob();
            await job.execute();
        });
        await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.GDPR_CLEANUP, 'cleanup-pii', '0 3 * * *');
    }
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.ORG_DELETION, async () => {
        const { OrganizationDeletionProcessorJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/organizationDeletionProcessor')));
        const job = new OrganizationDeletionProcessorJob();
        await job.execute();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.ORG_DELETION, 'process-deletions', '0 * * * *');
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.ORG_DELETION_REMINDER, async () => {
        const { OrganizationDeletionReminderJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/organizationDeletionReminderJob')));
        const job = new OrganizationDeletionReminderJob();
        await job.execute();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.ORG_DELETION_REMINDER, 'send-reminders', '0 9 * * *');
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.CAS_COMPUTATION, async () => {
        const { runCASComputationCycle } = await Promise.resolve().then(() => __importStar(require('../../jobs/casComputationJob')));
        await runCASComputationCycle();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.CAS_COMPUTATION, 'compute-cas', '*/15 * * * *');
    let cachedAuthService = null;
    const getAuthService = async () => {
        if (!cachedAuthService) {
            const { AuthenticationService } = await Promise.resolve().then(() => __importStar(require('../../services/authentication')));
            cachedAuthService = new AuthenticationService();
        }
        return cachedAuthService;
    };
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.SESSION_CLEANUP, async () => {
        const authService = await getAuthService();
        await authService.cleanupExpiredSessions();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.SESSION_CLEANUP, 'cleanup-sessions', '0 * * * *');
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.TOKEN_CLEANUP, async () => {
        const authService = await getAuthService();
        await authService.cleanupExpiredTokens();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.TOKEN_CLEANUP, 'cleanup-tokens', '0 0 * * *');
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.EXPORT_CLEANUP, async () => {
        const { ExportCleanupJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/exportCleanupJob')));
        const job = new ExportCleanupJob();
        await job.execute();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.EXPORT_CLEANUP, 'cleanup-exports', '30 2 * * *');
    let cachedBackupService = null;
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.BACKUP_CLEANUP, async () => {
        if (!cachedBackupService) {
            const { BackupService } = await Promise.resolve().then(() => __importStar(require('../../services/backup/BackupService')));
            cachedBackupService = new BackupService();
        }
        await cachedBackupService.cleanupExpiredBackups();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.BACKUP_CLEANUP, 'cleanup-backups', '0 */6 * * *');
    let cachedPollService = null;
    await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.POLL_CLOSE, async () => {
        if (!cachedPollService) {
            const { PollService } = await Promise.resolve().then(() => __importStar(require('../../services/poll/PollService')));
            cachedPollService = new PollService();
        }
        await cachedPollService.closeExpiredPolls();
    });
    await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.POLL_CLOSE, 'close-polls', '*/5 * * * *');
    if (process.env.NODE_ENV === 'production') {
        await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.INTEL_AUDIT_ROTATION, async () => {
            const { IntelAuditLogRotationJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/intelAuditLogRotation')));
            const job = new IntelAuditLogRotationJob();
            await job.execute();
        });
        await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.INTEL_AUDIT_ROTATION, 'rotate-audit-logs', '0 4 * * *');
    }
    if (process.env.DISABLE_EXTERNAL_FETCHES !== 'true') {
        await (0, JobQueue_1.createWorker)(JobQueue_1.QueueName.SHIP_DATA_FETCH, async () => {
            const { ShipDataFetcher } = await Promise.resolve().then(() => __importStar(require('../../jobs/shipDataFetcher')));
            await ShipDataFetcher.execute();
        });
        await (0, JobQueue_1.addRepeatableJob)(JobQueue_1.QueueName.SHIP_DATA_FETCH, 'fetch-ships', '0 2 * * *');
    }
    logger_1.logger.info('[BullMQ] All job workers and schedules registered.');
}
async function shutdownBullMQJobs() {
    await (0, JobQueue_1.shutdownQueues)();
}
//# sourceMappingURL=JobQueueWorkers.js.map