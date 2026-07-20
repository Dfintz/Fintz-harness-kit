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
const database_1 = require("../config/database");
const CASActivityLevelBridge_1 = require("../services/organization/CASActivityLevelBridge");
const cleanupJobs_1 = require("../utils/cleanupJobs");
const logger_1 = require("../utils/logger");
const casComputationJob_1 = require("./casComputationJob");
const exportCleanupJob_1 = require("./exportCleanupJob");
const gdprDataCleanup_1 = require("./gdprDataCleanup");
const gdprExportProcessing_1 = require("./gdprExportProcessing");
const intelAuditLogRotation_1 = require("./intelAuditLogRotation");
const organizationDeletionProcessor_1 = require("./organizationDeletionProcessor");
const organizationDeletionReminderJob_1 = require("./organizationDeletionReminderJob");
const rsiAffiliationBatchJob_1 = require("./rsiAffiliationBatchJob");
const rsiCrawlerJob_1 = require("./rsiCrawlerJob");
const rsiSyncScheduler_1 = require("./rsiSyncScheduler");
const rsiVerificationAutoDetectJob_1 = require("./rsiVerificationAutoDetectJob");
const sandboxUserCleanupJob_1 = require("./sandboxUserCleanupJob");
const sessionCleanup_1 = require("./sessionCleanup");
const voiceTimeTrackingJob_1 = require("./voiceTimeTrackingJob");
const WORKER_NAME = 'sc-fleet-worker';
const HEALTH_CHECK_PORT = Number(process.env.WORKER_HEALTH_PORT) || 3001;
const cleanupHandlers = [];
let isShuttingDown = false;
let healthServer = null;
async function startWorker() {
    logger_1.logger.info(`[${WORKER_NAME}] Starting worker process (PID: ${process.pid})`);
    try {
        await (0, database_1.initializeDatabase)();
        logger_1.logger.info(`[${WORKER_NAME}] Database initialized (with health monitoring)`);
    }
    catch (error) {
        logger_1.logger.error(`[${WORKER_NAME}] Failed to initialize database:`, error);
        process.exit(1);
    }
    (0, CASActivityLevelBridge_1.getCASActivityLevelBridge)();
    try {
        const { BotIPCService } = await Promise.resolve().then(() => __importStar(require('../bot/BotIPCService')));
        const ipcService = BotIPCService.getInstance();
        await ipcService.initialize();
        logger_1.logger.info(`[${WORKER_NAME}] BotIPCService initialized (worker → bot IPC ready)`);
    }
    catch (err) {
        logger_1.logger.warn(`[${WORKER_NAME}] BotIPCService: Failed to initialize (non-fatal):`, err);
    }
    const useBullMQ = process.env.USE_BULLMQ === 'true';
    if (useBullMQ) {
        const { registerBullMQJobs, shutdownBullMQJobs } = await Promise.resolve().then(() => __importStar(require('../services/shared/JobQueueWorkers')));
        await registerBullMQJobs();
        cleanupHandlers.push(() => {
            shutdownBullMQJobs().catch(() => { });
        });
        logger_1.logger.info(`[${WORKER_NAME}] All jobs registered via BullMQ`);
    }
    else {
        logger_1.logger.info(`[${WORKER_NAME}] Using legacy job scheduling (set USE_BULLMQ=true for BullMQ)`);
        const gdprHandle = (0, gdprDataCleanup_1.scheduleGdprCleanup)();
        if (gdprHandle) {
            cleanupHandlers.push(gdprHandle.cleanup);
            logger_1.logger.info(`[${WORKER_NAME}] GDPR cleanup job scheduled`);
        }
        const gdprExportHandle = (0, gdprExportProcessing_1.scheduleGdprExportProcessing)();
        cleanupHandlers.push(gdprExportHandle.cleanup);
        logger_1.logger.info(`[${WORKER_NAME}] GDPR export processing scheduled (every 5 min)`);
        const intelHandle = (0, intelAuditLogRotation_1.scheduleIntelAuditLogRotation)();
        if (intelHandle) {
            cleanupHandlers.push(intelHandle.cleanup);
            logger_1.logger.info(`[${WORKER_NAME}] Intel audit log rotation scheduled`);
        }
        const orgDeletionHandle = (0, organizationDeletionProcessor_1.scheduleOrgDeletionProcessor)();
        cleanupHandlers.push(orgDeletionHandle.cleanup);
        logger_1.logger.info(`[${WORKER_NAME}] Org deletion processor scheduled (hourly)`);
        const orgReminderHandle = (0, organizationDeletionReminderJob_1.scheduleOrgDeletionReminders)();
        cleanupHandlers.push(orgReminderHandle.cleanup);
        logger_1.logger.info(`[${WORKER_NAME}] Org deletion reminders scheduled (daily 9 AM)`);
        const exportCleanupHandle = (0, exportCleanupJob_1.scheduleExportCleanup)();
        cleanupHandlers.push(exportCleanupHandle.cleanup);
        logger_1.logger.info(`[${WORKER_NAME}] Export cleanup scheduled (daily 2 AM)`);
        const { BackupSchedulerJob } = await Promise.resolve().then(() => __importStar(require('./BackupSchedulerJob')));
        BackupSchedulerJob.start();
        cleanupHandlers.push(() => BackupSchedulerJob.stop());
        logger_1.logger.info(`[${WORKER_NAME}] Backup scheduler started (every 6h cleanup)`);
        const { DuesCollectionScheduler } = await Promise.resolve().then(() => __importStar(require('./DuesCollectionScheduler')));
        const duesScheduler = new DuesCollectionScheduler();
        duesScheduler.start();
        cleanupHandlers.push(() => duesScheduler.stop());
        logger_1.logger.info(`[${WORKER_NAME}] Dues collection scheduler started (daily 00:00 UTC)`);
        const { ReportSchedulerJob } = await Promise.resolve().then(() => __importStar(require('./ReportSchedulerJob')));
        ReportSchedulerJob.start();
        cleanupHandlers.push(() => ReportSchedulerJob.stop());
        logger_1.logger.info(`[${WORKER_NAME}] Report scheduler started`);
        const { startTacticalOperationsJobs, stopTacticalOperationsJobs } = await Promise.resolve().then(() => __importStar(require('./tacticalOperationsScheduler')));
        startTacticalOperationsJobs();
        cleanupHandlers.push(() => stopTacticalOperationsJobs());
        logger_1.logger.info(`[${WORKER_NAME}] Tactical operations scheduler started`);
        const sessionInterval = (0, sessionCleanup_1.startSessionCleanupJob)();
        cleanupHandlers.push(() => clearInterval(sessionInterval));
        logger_1.logger.info(`[${WORKER_NAME}] Session cleanup job started (hourly)`);
        const refreshTokenInterval = (0, cleanupJobs_1.startRefreshTokenCleanup)();
        cleanupHandlers.push(() => clearInterval(refreshTokenInterval));
        logger_1.logger.info(`[${WORKER_NAME}] Refresh token cleanup started (daily)`);
        const sandboxCleanupInterval = (0, sandboxUserCleanupJob_1.startSandboxUserCleanupJob)();
        cleanupHandlers.push(() => clearInterval(sandboxCleanupInterval));
        logger_1.logger.info(`[${WORKER_NAME}] Sandbox user cleanup started (daily)`);
        const { PollCloseScheduler } = await Promise.resolve().then(() => __importStar(require('./PollCloseScheduler')));
        const pollScheduler = new PollCloseScheduler();
        pollScheduler.start();
        cleanupHandlers.push(() => pollScheduler.stop());
        logger_1.logger.info(`[${WORKER_NAME}] Poll auto-close scheduler started (every 5 min)`);
        const { ApplicationTimeLimitJob } = await Promise.resolve().then(() => __importStar(require('./applicationTimeLimitJob')));
        const appTimeLimitJob = new ApplicationTimeLimitJob();
        appTimeLimitJob.start();
        cleanupHandlers.push(() => appTimeLimitJob.stop());
        logger_1.logger.info(`[${WORKER_NAME}] Application time-limit job started (every 5 min)`);
        (0, casComputationJob_1.startCASComputationJob)();
        cleanupHandlers.push(() => (0, casComputationJob_1.stopCASComputationJob)());
        logger_1.logger.info(`[${WORKER_NAME}] CAS computation job started (every 15 min)`);
        const voiceTrackingHandle = (0, voiceTimeTrackingJob_1.startVoiceTimeTrackingJob)();
        cleanupHandlers.push(voiceTrackingHandle.cleanup);
        logger_1.logger.info(`[${WORKER_NAME}] Voice time tracking job started (every 5 min)`);
    }
    const externalFetchesEnabled = process.env.DISABLE_EXTERNAL_FETCHES !== 'true';
    if (externalFetchesEnabled) {
        if (!useBullMQ) {
            const { ShipDataFetcher } = await Promise.resolve().then(() => __importStar(require('./shipDataFetcher')));
            ShipDataFetcher.schedule();
            logger_1.logger.info(`[${WORKER_NAME}] Ship data fetcher scheduled (legacy)`);
        }
        if (process.env.ENABLE_RSI_CRAWLER_JOB === 'true') {
            (0, rsiCrawlerJob_1.startRsiCrawlerJob)();
            logger_1.logger.info(`[${WORKER_NAME}] RSI crawler job started`);
        }
        (0, rsiSyncScheduler_1.startRsiSyncSchedulerJob)();
        logger_1.logger.info(`[${WORKER_NAME}] RSI sync scheduler started`);
        (0, rsiVerificationAutoDetectJob_1.startRsiVerificationAutoDetectJob)();
        logger_1.logger.info(`[${WORKER_NAME}] RSI verification auto-detect started`);
        if (process.env.ENABLE_RSI_AFFILIATION_BATCH_JOB === 'false') {
            logger_1.logger.info(`[${WORKER_NAME}] RSI affiliation batch refresh disabled`);
        }
        else {
            (0, rsiAffiliationBatchJob_1.startRsiAffiliationBatchJob)();
            cleanupHandlers.push(() => (0, rsiAffiliationBatchJob_1.stopRsiAffiliationBatchJob)());
            logger_1.logger.info(`[${WORKER_NAME}] RSI affiliation batch refresh started`);
        }
    }
    else {
        logger_1.logger.info(`[${WORKER_NAME}] External fetch jobs disabled (DISABLE_EXTERNAL_FETCHES=true)`);
    }
    try {
        const { registerKnownJobs } = await Promise.resolve().then(() => __importStar(require('../services/jobs/registerKnownJobs')));
        await registerKnownJobs();
        logger_1.logger.info(`[${WORKER_NAME}] Admin job registry populated`);
    }
    catch (err) {
        logger_1.logger.warn(`[${WORKER_NAME}] Failed to register jobs in admin registry:`, err);
    }
    const http = await Promise.resolve().then(() => __importStar(require('node:http')));
    healthServer = http.createServer((_req, res) => {
        if (isShuttingDown || !database_1.AppDataSource.isInitialized) {
            res.writeHead(503);
            res.end('not ready');
        }
        else {
            res.writeHead(200);
            res.end('ok');
        }
    });
    healthServer.listen(HEALTH_CHECK_PORT, () => {
        logger_1.logger.info(`[${WORKER_NAME}] Health check listening on port ${HEALTH_CHECK_PORT}`);
    });
    logger_1.logger.info(`[${WORKER_NAME}] All jobs registered. Worker is running.`);
}
function shutdown(signal, exitCode = 0) {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;
    logger_1.logger.info(`[${WORKER_NAME}] Received ${signal}. Shutting down gracefully...`, { exitCode });
    if (healthServer) {
        healthServer.close();
    }
    for (const cleanup of cleanupHandlers) {
        try {
            cleanup();
        }
        catch {
        }
    }
    setTimeout(() => {
        database_1.AppDataSource.destroy().catch(() => { });
        logger_1.logger.info(`[${WORKER_NAME}] Shutdown complete.`);
        process.exit(exitCode);
    }, 10_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', error => {
    logger_1.logger.error(`[${WORKER_NAME}] Uncaught exception:`, error);
    shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', reason => {
    logger_1.logger.error(`[${WORKER_NAME}] Unhandled rejection:`, reason);
    shutdown('unhandledRejection', 1);
});
process.on('warning', warning => {
    const isPgConcurrentQueryDeprecation = warning.name === 'DeprecationWarning' &&
        warning.message.includes('Calling client.query() when the client is already executing a query');
    if (isPgConcurrentQueryDeprecation) {
        logger_1.logger.warn(`[${WORKER_NAME}] PostgreSQL concurrent-query deprecation warning observed`, {
            warningName: warning.name,
            warningMessage: warning.message,
            stack: warning.stack,
        });
        return;
    }
    logger_1.logger.warn(`[${WORKER_NAME}] Process warning`, {
        warningName: warning.name,
        warningMessage: warning.message,
        stack: warning.stack,
    });
});
startWorker().catch(error => {
    logger_1.logger.error(`[${WORKER_NAME}] Fatal startup error:`, error);
    process.exit(1);
});
//# sourceMappingURL=worker.js.map