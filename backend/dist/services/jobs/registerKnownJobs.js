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
exports.registerKnownJobs = registerKnownJobs;
const logger_1 = require("../../utils/logger");
const AdminJobRegistry_1 = require("../admin/AdminJobRegistry");
async function registerKnownJobs() {
    const jobs = [
        {
            id: 'ship-data-fetcher',
            name: 'Ship Data Fetcher',
            description: 'Fetches ship and vehicle data from RSI ship matrix',
            category: 'sync',
            schedule: 'Daily at 02:00 UTC',
            handler: async () => {
                const { ShipDataFetcher } = await Promise.resolve().then(() => __importStar(require('../../jobs/shipDataFetcher')));
                await ShipDataFetcher.execute();
            },
        },
        {
            id: 'regolith-data-fetcher',
            name: 'Regolith Data Fetcher',
            description: 'Fetches mining ore and market data from Regolith sources',
            category: 'sync',
            schedule: 'Every 6 hours',
            handler: async () => {
                const { RegolithDataFetcher } = await Promise.resolve().then(() => __importStar(require('../../jobs/regolithDataFetcher')));
                await RegolithDataFetcher.execute();
            },
        },
        {
            id: 'gdpr-data-cleanup',
            name: 'GDPR Data Cleanup',
            description: 'Enforces data retention policies: deletes old access logs, anonymizes activities, processes due deletions',
            category: 'gdpr',
            schedule: 'Daily at 03:00 UTC',
            handler: async () => {
                const { GdprDataCleanupJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/gdprDataCleanup')));
                await new GdprDataCleanupJob().execute();
            },
        },
        {
            id: 'gdpr-export-processing',
            name: 'GDPR Export Processing',
            description: 'Processes pending GDPR data export requests',
            category: 'gdpr',
            schedule: 'Every 5 minutes',
            handler: async () => {
                const { GdprExportProcessingJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/gdprExportProcessing')));
                await new GdprExportProcessingJob().execute();
            },
        },
        {
            id: 'intel-audit-log-rotation',
            name: 'Intel Audit Log Rotation',
            description: 'Rotates and archives old intel audit log entries beyond retention period',
            category: 'maintenance',
            schedule: 'Daily at 04:00 UTC',
            handler: async () => {
                const { IntelAuditLogRotationJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/intelAuditLogRotation')));
                await new IntelAuditLogRotationJob().execute();
            },
        },
        {
            id: 'org-deletion-processor',
            name: 'Organization Deletion Processor',
            description: 'Processes approved organization deletion requests',
            category: 'cleanup',
            schedule: 'Hourly',
            handler: async () => {
                const { runOrganizationDeletionProcessor } = await Promise.resolve().then(() => __importStar(require('../../jobs/organizationDeletionProcessor')));
                await runOrganizationDeletionProcessor();
            },
        },
        {
            id: 'org-deletion-reminders',
            name: 'Organization Deletion Reminders',
            description: 'Sends reminder notifications for pending organization deletions',
            category: 'cleanup',
            schedule: 'Daily at 09:00 UTC',
            handler: async () => {
                const { runOrganizationDeletionReminderJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/organizationDeletionReminderJob')));
                await runOrganizationDeletionReminderJob();
            },
        },
        {
            id: 'export-cleanup',
            name: 'Export Cleanup',
            description: 'Cleans up old export files from blob storage',
            category: 'cleanup',
            schedule: 'Daily at 02:30 UTC',
            handler: async () => {
                const { runExportCleanupJob } = await Promise.resolve().then(() => __importStar(require('../../jobs/exportCleanupJob')));
                await runExportCleanupJob();
            },
        },
        {
            id: 'cas-computation',
            name: 'CAS Computation',
            description: 'Computes Community Activity Scores for organizations',
            category: 'analytics',
            schedule: 'Every 15 minutes',
            handler: async () => {
                const { runCASComputationCycle } = await Promise.resolve().then(() => __importStar(require('../../jobs/casComputationJob')));
                await runCASComputationCycle();
            },
        },
        {
            id: 'poll-close-scheduler',
            name: 'Poll Auto-Close',
            description: 'Automatically closes polls that have passed their expiration date',
            category: 'maintenance',
            schedule: 'Every 5 minutes',
            handler: async () => {
                const { PollService } = await Promise.resolve().then(() => __importStar(require('../poll/PollService')));
                const pollService = new PollService();
                await pollService.closeExpiredPolls();
            },
        },
        {
            id: 'session-cleanup',
            name: 'Session Cleanup',
            description: 'Removes expired sessions from the database',
            category: 'security',
            schedule: 'Hourly',
            handler: async () => {
                const { AuthenticationService } = await Promise.resolve().then(() => __importStar(require('../authentication')));
                const authService = new AuthenticationService();
                const cleaned = await authService.cleanupExpiredSessions();
                logger_1.logger.info('Manual session cleanup completed', { cleanedCount: cleaned });
            },
        },
        {
            id: 'rsi-sync',
            name: 'RSI Sync Scheduler',
            description: 'Syncs RSI organization member data for linked organizations (auto-managed)',
            category: 'integration',
            schedule: 'Every 15 minutes',
            enabled: true,
            handler: async () => {
                logger_1.logger.info('RSI Sync runs automatically via distributed scheduler. ' +
                    'Use the organization RSI sync page for manual per-org syncs.');
            },
        },
        {
            id: 'rsi-verification-auto-detect',
            name: 'RSI Verification Auto-Detect',
            description: 'Automatically completes pending RSI user and org verifications by scanning verification links',
            category: 'integration',
            schedule: 'Every 2 minutes',
            enabled: true,
            handler: async () => {
                const { runRsiVerificationAutoDetectOnce } = await Promise.resolve().then(() => __importStar(require('../../jobs/rsiVerificationAutoDetectJob')));
                const result = await runRsiVerificationAutoDetectOnce();
                if (result.outcome === 'skipped') {
                    logger_1.logger.info('RSI verification auto-detect manual trigger skipped', {
                        reason: result.reason,
                    });
                    return {
                        outcome: 'skipped',
                        reason: result.reason,
                    };
                }
                return {
                    outcome: 'executed',
                    details: {
                        usersChecked: result.usersChecked,
                        usersVerified: result.usersVerified,
                        organizationsChecked: result.organizationsChecked,
                        organizationsVerified: result.organizationsVerified,
                    },
                };
            },
        },
        {
            id: 'rsi-affiliation-batch',
            name: 'RSI Affiliation Batch Refresh',
            description: 'Refreshes RSI handle affiliations and account lifecycle status in configurable batches',
            category: 'integration',
            schedule: 'Every 60 minutes (configurable)',
            enabled: true,
            handler: async () => {
                const { runRsiAffiliationBatchJobNow } = await Promise.resolve().then(() => __importStar(require('../../jobs/rsiAffiliationBatchJob')));
                await runRsiAffiliationBatchJobNow();
            },
        },
    ];
    for (const job of jobs) {
        try {
            AdminJobRegistry_1.adminJobRegistry.registerJob(job);
        }
        catch (error) {
            logger_1.logger.warn('Failed to register job in admin registry', {
                jobId: job.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    logger_1.logger.info(`Registered ${jobs.length} jobs in admin registry`);
}
//# sourceMappingURL=registerKnownJobs.js.map