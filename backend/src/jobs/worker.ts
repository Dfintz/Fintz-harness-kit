/**
 * Worker Container Entrypoint
 *
 * Runs heavy background jobs in an isolated process, separate from the API server.
 * This prevents long-running tasks (RSI crawler, GDPR cleanup, ship data fetcher)
 * from competing with the API for DB connections, event loop, and memory.
 *
 * Architecture:
 * - Uses the same codebase as the API (same Docker image, different CMD)
 * - Initializes DB + Redis but NOT Express/HTTP/WebSocket
 * - Each job uses its own scheduling (cron, setInterval, setTimeout)
 * - Graceful shutdown on SIGTERM/SIGINT
 *
 * Jobs handled by this worker:
 * - RSI Crawler (6h cycle, up to 30 min per run)
 * - RSI Sync Scheduler (15 min cycle)
 * - RSI Affiliation Batch Refresh (60 min cycle, configurable)
 * - GDPR Data Cleanup (daily 3 AM, production only)
 * - GDPR Export Processing (every 5 min)
 * - Intel Audit Log Rotation (daily 4 AM, production only)
 * - Ship Data Fetcher (daily 2 AM)
 * - Org Deletion Processor (hourly)
 * - Org Deletion Reminders (daily 9 AM)
 * - Export Cleanup (daily 2:30 AM)
 * - Backup Scheduler (every 6h, self-scheduling via node-cron)
 * - Session Cleanup (hourly)
 * - Refresh Token Cleanup (daily)
 * - Sandbox User Cleanup (daily, 30-day TTL by default)
 * - Poll Auto-Close (every 5 min, via node-cron)
 * - CAS Computation (every 15 min)
 *
 * Job staying in API process:
 * - JWT Blacklist Cleanup (flushes process-local cache — must run where cache lives)
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — Architecture Roadmap → A1
 */

import { AppDataSource, initializeDatabase } from '../config/database';
import { getCASActivityLevelBridge } from '../services/organization/CASActivityLevelBridge';
import { startRefreshTokenCleanup } from '../utils/cleanupJobs';
import { logger } from '../utils/logger';

// Job imports — heavy batch jobs that should NOT run in the API process
// NOTE: BackupSchedulerJob, PollCloseScheduler, ShipDataFetcher use lazy imports
// because their modules eagerly create service singletons that require AppDataSource.
import { startCASComputationJob, stopCASComputationJob } from './casComputationJob';
import { scheduleExportCleanup } from './exportCleanupJob';
import { scheduleGdprCleanup } from './gdprDataCleanup';
import { scheduleGdprExportProcessing } from './gdprExportProcessing';
import { scheduleIntelAuditLogRotation } from './intelAuditLogRotation';
import { scheduleOrgDeletionProcessor } from './organizationDeletionProcessor';
import { scheduleOrgDeletionReminders } from './organizationDeletionReminderJob';
import { startRsiAffiliationBatchJob, stopRsiAffiliationBatchJob } from './rsiAffiliationBatchJob';
import { startRsiCrawlerJob } from './rsiCrawlerJob';
import { startRsiSyncSchedulerJob } from './rsiSyncScheduler';
import { startRsiVerificationAutoDetectJob } from './rsiVerificationAutoDetectJob';
import { startSandboxUserCleanupJob } from './sandboxUserCleanupJob';
import { startSessionCleanupJob } from './sessionCleanup';
import { startVoiceTimeTrackingJob } from './voiceTimeTrackingJob';

// Worker configuration
const WORKER_NAME = 'sc-fleet-worker';
const HEALTH_CHECK_PORT = Number(process.env.WORKER_HEALTH_PORT) || 3001;

// Track cleanup handlers for graceful shutdown
const cleanupHandlers: Array<() => void> = [];
let isShuttingDown = false;
let healthServer: import('node:http').Server | null = null;

/**
 * Initialize and start all worker jobs
 */
async function startWorker(): Promise<void> {
  logger.info(`[${WORKER_NAME}] Starting worker process (PID: ${process.pid})`);

  // Initialize database (includes connection health monitoring + auto-reconnect)
  // RUN_MIGRATIONS=false in docker-compose prevents migrations
  try {
    await initializeDatabase();
    logger.info(`[${WORKER_NAME}] Database initialized (with health monitoring)`);
  } catch (error) {
    logger.error(`[${WORKER_NAME}] Failed to initialize database:`, error);
    process.exit(1);
  }

  // Register CAS tier -> public directory activity-level sync listener.
  // CAS computation runs in the worker, so this process must subscribe.
  getCASActivityLevelBridge();

  // Redis auto-initializes on first import (singleton in utils/redis.ts)

  // Initialize IPC client for communicating with the bot container (role management, etc.)
  try {
    const { BotIPCService } = await import('../bot/BotIPCService');
    const ipcService = BotIPCService.getInstance();
    await ipcService.initialize();
    logger.info(`[${WORKER_NAME}] BotIPCService initialized (worker → bot IPC ready)`);
  } catch (err) {
    logger.warn(`[${WORKER_NAME}] BotIPCService: Failed to initialize (non-fatal):`, err);
  }

  // ==================== JOB SCHEDULING MODE ====================
  // USE_BULLMQ=true → BullMQ queues with retry/monitoring (P8)
  // Otherwise → legacy setInterval/node-cron (existing behavior)

  const useBullMQ = process.env.USE_BULLMQ === 'true';

  if (useBullMQ) {
    const { registerBullMQJobs, shutdownBullMQJobs } =
      await import('../services/shared/JobQueueWorkers');
    await registerBullMQJobs();
    cleanupHandlers.push(() => {
      shutdownBullMQJobs().catch(() => {});
    });
    logger.info(`[${WORKER_NAME}] All jobs registered via BullMQ`);
  } else {
    // Legacy scheduling (setInterval / node-cron)
    logger.info(`[${WORKER_NAME}] Using legacy job scheduling (set USE_BULLMQ=true for BullMQ)`);

    // ==================== REGISTER JOBS ====================

    // GDPR Data Cleanup — daily at 3 AM (production only)
    const gdprHandle = scheduleGdprCleanup();
    if (gdprHandle) {
      cleanupHandlers.push(gdprHandle.cleanup);
      logger.info(`[${WORKER_NAME}] GDPR cleanup job scheduled`);
    }

    // GDPR Export Processing — every 5 min
    const gdprExportHandle = scheduleGdprExportProcessing();
    cleanupHandlers.push(gdprExportHandle.cleanup);
    logger.info(`[${WORKER_NAME}] GDPR export processing scheduled (every 5 min)`);

    // Intel Audit Log Rotation — daily at 4 AM (production only)
    const intelHandle = scheduleIntelAuditLogRotation();
    if (intelHandle) {
      cleanupHandlers.push(intelHandle.cleanup);
      logger.info(`[${WORKER_NAME}] Intel audit log rotation scheduled`);
    }

    // Organization Deletion Processor — hourly
    const orgDeletionHandle = scheduleOrgDeletionProcessor();
    cleanupHandlers.push(orgDeletionHandle.cleanup);
    logger.info(`[${WORKER_NAME}] Org deletion processor scheduled (hourly)`);

    // Organization Deletion Reminders — daily at 9 AM UTC
    const orgReminderHandle = scheduleOrgDeletionReminders();
    cleanupHandlers.push(orgReminderHandle.cleanup);
    logger.info(`[${WORKER_NAME}] Org deletion reminders scheduled (daily 9 AM)`);

    // Export Cleanup — daily at 2 AM UTC
    const exportCleanupHandle = scheduleExportCleanup();
    cleanupHandlers.push(exportCleanupHandle.cleanup);
    logger.info(`[${WORKER_NAME}] Export cleanup scheduled (daily 2 AM)`);

    // Backup Scheduler — every 6h cleanup (self-scheduling via node-cron)
    const { BackupSchedulerJob } = await import('./BackupSchedulerJob');
    BackupSchedulerJob.start();
    cleanupHandlers.push(() => BackupSchedulerJob.stop());
    logger.info(`[${WORKER_NAME}] Backup scheduler started (every 6h cleanup)`);

    // Dues Collection — daily at 00:00 UTC
    const { DuesCollectionScheduler } = await import('./DuesCollectionScheduler');
    const duesScheduler = new DuesCollectionScheduler();
    duesScheduler.start();
    cleanupHandlers.push(() => duesScheduler.stop());
    logger.info(`[${WORKER_NAME}] Dues collection scheduler started (daily 00:00 UTC)`);

    // Report Scheduler — runs scheduled report generation per its own cron
    const { ReportSchedulerJob } = await import('./ReportSchedulerJob');
    ReportSchedulerJob.start();
    cleanupHandlers.push(() => ReportSchedulerJob.stop());
    logger.info(`[${WORKER_NAME}] Report scheduler started`);

    // Tactical Operations — multi-job background runner
    const { startTacticalOperationsJobs, stopTacticalOperationsJobs } =
      await import('./tacticalOperationsScheduler');
    startTacticalOperationsJobs();
    cleanupHandlers.push(() => stopTacticalOperationsJobs());
    logger.info(`[${WORKER_NAME}] Tactical operations scheduler started`);

    // ==================== LIGHTWEIGHT TIMER JOBS ====================
    // These were candidates for Azure Functions but are simpler in the worker
    // (sub-second DB queries, no external APIs, worker already has DB+Redis)

    // Session cleanup — every 1 hour
    const sessionInterval = startSessionCleanupJob();
    cleanupHandlers.push(() => clearInterval(sessionInterval));
    logger.info(`[${WORKER_NAME}] Session cleanup job started (hourly)`);

    // Refresh token cleanup — every 24 hours
    const refreshTokenInterval = startRefreshTokenCleanup();
    cleanupHandlers.push(() => clearInterval(refreshTokenInterval));
    logger.info(`[${WORKER_NAME}] Refresh token cleanup started (daily)`);

    // Sandbox user cleanup — every 24 hours
    const sandboxCleanupInterval = startSandboxUserCleanupJob();
    cleanupHandlers.push(() => clearInterval(sandboxCleanupInterval));
    logger.info(`[${WORKER_NAME}] Sandbox user cleanup started (daily)`);

    // Poll auto-close — every 5 min (self-scheduling via node-cron)
    const { PollCloseScheduler } = await import('./PollCloseScheduler');
    const pollScheduler = new PollCloseScheduler();
    pollScheduler.start();
    cleanupHandlers.push(() => pollScheduler.stop());
    logger.info(`[${WORKER_NAME}] Poll auto-close scheduler started (every 5 min)`);

    // Application time-limit auto-cancel — every 5 min
    const { ApplicationTimeLimitJob } = await import('./applicationTimeLimitJob');
    const appTimeLimitJob = new ApplicationTimeLimitJob();
    appTimeLimitJob.start();
    cleanupHandlers.push(() => appTimeLimitJob.stop());
    logger.info(`[${WORKER_NAME}] Application time-limit job started (every 5 min)`);

    // CAS computation — every 15 minutes
    startCASComputationJob();
    cleanupHandlers.push(() => stopCASComputationJob());
    logger.info(`[${WORKER_NAME}] CAS computation job started (every 15 min)`);

    // Voice time tracking — every 5 minutes (polls CVP bridges for voice minutes)
    const voiceTrackingHandle = startVoiceTimeTrackingJob();
    cleanupHandlers.push(voiceTrackingHandle.cleanup);
    logger.info(`[${WORKER_NAME}] Voice time tracking job started (every 5 min)`);

    // NOTE: JWT blacklist cleanup stays in API process (flushes process-local cache)
  } // end legacy scheduling else block

  // ==================== RSI + EXTERNAL FETCH JOBS ====================
  // RSI Crawler and RSI Sync use complex internal guards (isRunning, circuit breaker,
  // distributed locks) tightly coupled to their setInterval pattern. They always run
  // via legacy scheduling regardless of BullMQ mode.
  // ShipDataFetcher.schedule() provides an initial 60s fetch + daily cron backup that
  // complements the BullMQ daily-at-2AM repeatable (which has no initial fetch).

  const externalFetchesEnabled = process.env.DISABLE_EXTERNAL_FETCHES !== 'true';

  if (externalFetchesEnabled) {
    // Only start legacy schedule if BullMQ isn't handling the daily cron
    if (!useBullMQ) {
      const { ShipDataFetcher } = await import('./shipDataFetcher');
      ShipDataFetcher.schedule();
      logger.info(`[${WORKER_NAME}] Ship data fetcher scheduled (legacy)`);
    }

    // RSI Crawler — every 6h (opt-in via ENABLE_RSI_CRAWLER_JOB)
    if (process.env.ENABLE_RSI_CRAWLER_JOB === 'true') {
      startRsiCrawlerJob();
      logger.info(`[${WORKER_NAME}] RSI crawler job started`);
    }

    // RSI Sync Scheduler — every 15 min (no Discord client needed for worker)
    startRsiSyncSchedulerJob();
    logger.info(`[${WORKER_NAME}] RSI sync scheduler started`);

    // RSI Verification Auto-Detect — every 2 min
    startRsiVerificationAutoDetectJob();
    logger.info(`[${WORKER_NAME}] RSI verification auto-detect started`);

    // RSI Affiliation Batch Refresh — periodic batched membership crawl by handle
    if (process.env.ENABLE_RSI_AFFILIATION_BATCH_JOB === 'false') {
      logger.info(`[${WORKER_NAME}] RSI affiliation batch refresh disabled`);
    } else {
      startRsiAffiliationBatchJob();
      cleanupHandlers.push(() => stopRsiAffiliationBatchJob());
      logger.info(`[${WORKER_NAME}] RSI affiliation batch refresh started`);
    }
  } else {
    logger.info(`[${WORKER_NAME}] External fetch jobs disabled (DISABLE_EXTERNAL_FETCHES=true)`);
  }

  // ==================== ADMIN JOB REGISTRY ====================
  // Register all known jobs so the admin operations dashboard can display and control them
  try {
    const { registerKnownJobs } = await import('../services/jobs/registerKnownJobs');
    await registerKnownJobs();
    logger.info(`[${WORKER_NAME}] Admin job registry populated`);
  } catch (err) {
    logger.warn(`[${WORKER_NAME}] Failed to register jobs in admin registry:`, err);
  }

  // ==================== HEALTH CHECK ====================

  // Minimal HTTP health check for container orchestration (no Express needed)
  const http = await import('node:http');
  healthServer = http.createServer((_req, res) => {
    if (isShuttingDown || !AppDataSource.isInitialized) {
      res.writeHead(503);
      res.end('not ready');
    } else {
      res.writeHead(200);
      res.end('ok');
    }
  });

  healthServer.listen(HEALTH_CHECK_PORT, () => {
    logger.info(`[${WORKER_NAME}] Health check listening on port ${HEALTH_CHECK_PORT}`);
  });

  logger.info(`[${WORKER_NAME}] All jobs registered. Worker is running.`);
}

/**
 * Graceful shutdown handler.
 *
 * @param signal - The signal or error reason that triggered shutdown.
 * @param exitCode - Process exit code. Use a non-zero value for fail-fast
 *   error paths (uncaught exception / unhandled rejection) so the orchestrator
 *   treats the stop as a crash and surfaces it to alerting; signals exit 0.
 */
function shutdown(signal: string, exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`[${WORKER_NAME}] Received ${signal}. Shutting down gracefully...`, { exitCode });

  // Close health check server
  if (healthServer) {
    healthServer.close();
  }

  // Call cleanup handlers (e.g., IntelAuditLogJobHandle.cleanup())
  for (const cleanup of cleanupHandlers) {
    try {
      cleanup();
    } catch {
      // Best-effort cleanup during shutdown
    }
  }

  // Give in-flight operations 10 seconds to complete, then close DB pool
  setTimeout(() => {
    AppDataSource.destroy().catch(() => {});
    logger.info(`[${WORKER_NAME}] Shutdown complete.`);
    process.exit(exitCode);
  }, 10_000);
}

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors — fail fast with a non-zero exit so the orchestrator
// restarts the worker and the crash is visible to monitoring.
process.on('uncaughtException', error => {
  logger.error(`[${WORKER_NAME}] Uncaught exception:`, error);
  shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', reason => {
  logger.error(`[${WORKER_NAME}] Unhandled rejection:`, reason);
  shutdown('unhandledRejection', 1);
});

process.on('warning', warning => {
  const isPgConcurrentQueryDeprecation =
    warning.name === 'DeprecationWarning' &&
    warning.message.includes('Calling client.query() when the client is already executing a query');

  if (isPgConcurrentQueryDeprecation) {
    logger.warn(`[${WORKER_NAME}] PostgreSQL concurrent-query deprecation warning observed`, {
      warningName: warning.name,
      warningMessage: warning.message,
      stack: warning.stack,
    });
    return;
  }

  logger.warn(`[${WORKER_NAME}] Process warning`, {
    warningName: warning.name,
    warningMessage: warning.message,
    stack: warning.stack,
  });
});

// Start the worker
startWorker().catch(error => {
  logger.error(`[${WORKER_NAME}] Fatal startup error:`, error);
  process.exit(1);
});
