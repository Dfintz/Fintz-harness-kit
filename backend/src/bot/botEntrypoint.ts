/**
 * Bot Container Entrypoint
 *
 * Runs the Discord bot in an isolated process, separate from the API server.
 * This provides fault isolation — a bot crash (OOM from guild.fetch() on a
 * 25K-member guild) no longer takes down the API.
 *
 * Architecture:
 * - Uses the same codebase as the API (same Docker image, different CMD)
 * - Initializes DB + Redis but NOT Express/HTTP/WebSocket
 * - Calls the existing startBot() from botApp.ts
 * - Has its own DB connection pool (DB_POOL_MAX=15)
 * - Graceful shutdown on SIGTERM/SIGINT
 *
 * When running:
 * - API container sets DISABLE_BOT=true to skip in-process bot startup
 * - Bot container runs this entrypoint instead of app.ts
 * - Both share the same DB and Redis but with isolated connection pools
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — Architecture Roadmap → P5
 */

import net from 'node:net';

import type { Shard, ShardingManager } from 'discord.js';

import { AppDataSource, initializeDatabase } from '../config/database';
import { logger } from '../utils/logger';

import { shutdownBotRuntime, startBot } from './botApp';
import { BotClientManager } from './BotClientManager';
import { BotIPCService } from './BotIPCService';
import { BotReadinessStateMachine } from './BotReadinessStateMachine';
import { type BotShutdownStep, runBotShutdownSteps } from './botShutdownCoordinator';
import { API_BASE_URL } from './constants/api';
import { startShardManager } from './shardManager';
import { validateBotInternalSecret } from './utils/startupValidation';
import { clearDeletionTimers } from './voice/voiceAutoCreate';

// Bot process configuration
const BOT_PROCESS_NAME = 'sc-fleet-bot';
const HEALTH_CHECK_PORT = Number(process.env.BOT_HEALTH_PORT) || 3002;

const TRANSIENT_NETWORK_ERROR_CODES = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN']);
const TRANSIENT_ERROR_WINDOW_MS = 60_000;
const MAX_TRANSIENT_ERRORS_PER_WINDOW = 8;

/** Max time to wait for the API to become reachable before starting the bot. */
const API_READY_TIMEOUT_MS = Number(process.env.BOT_API_READY_TIMEOUT_MS) || 60_000;
/** Interval between API health-check polls. */
const API_READY_POLL_MS = 2_000;

let isShuttingDown = false;
let healthServer: net.Server | null = null;
let shutdownPromise: Promise<void> | null = null;
let transientErrorWindowStart = 0;
let transientErrorCount = 0;

const clientManager = BotClientManager.getInstance();
const readinessStateMachine = new BotReadinessStateMachine();

interface NodeNetworkError extends Error {
  code?: string;
}

function isNodeNetworkError(error: unknown): error is NodeNetworkError {
  return error instanceof Error;
}

function isTransientNetworkError(error: unknown): error is NodeNetworkError {
  if (!isNodeNetworkError(error)) {
    return false;
  }

  if (typeof error.code === 'string' && TRANSIENT_NETWORK_ERROR_CODES.has(error.code)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('econnreset') ||
    message.includes('socket hang up') ||
    message.includes('connection reset by peer')
  );
}

function shouldEscalateTransientError(): boolean {
  const now = Date.now();

  if (
    transientErrorWindowStart === 0 ||
    now - transientErrorWindowStart > TRANSIENT_ERROR_WINDOW_MS
  ) {
    transientErrorWindowStart = now;
    transientErrorCount = 0;
  }

  transientErrorCount += 1;
  return transientErrorCount > MAX_TRANSIENT_ERRORS_PER_WINDOW;
}

function registerShardReadinessListeners(shardManager: ShardingManager): void {
  const registerShardLifecycle = (shard: Shard): void => {
    readinessStateMachine.recordShardCreated(shard.id);

    shard.on('ready', () => {
      readinessStateMachine.recordShardReady(shard.id);
    });

    const markShardNotReady = (): void => {
      readinessStateMachine.recordShardNotReady(shard.id);
    };

    shard.on('disconnect', markShardNotReady);
    shard.on('death', markShardNotReady);
  };

  for (const shard of shardManager.shards.values()) {
    registerShardLifecycle(shard);
  }

  shardManager.on('shardCreate', registerShardLifecycle);
}

function buildHealthSocketLine(): string {
  const shardingEnabled = process.env.BOT_USE_SHARDING === 'true';

  if (shardingEnabled) {
    return readinessStateMachine.toHealthSocketLine(isShuttingDown);
  }

  return readinessStateMachine.toHealthSocketLine(isShuttingDown, {
    ipcReady: BotIPCService.getInstance().isAvailable(),
    discordReady: clientManager.isReady(),
  });
}

/**
 * Poll the API's /health endpoint until it responds 200, or until timeout.
 * If the API never becomes reachable the bot still starts — Discord interactions
 * will surface the existing "API did not respond" message — but we log a clear
 * warning so operators can diagnose the issue from container logs.
 */
async function waitForApi(): Promise<void> {
  const healthUrl = `${API_BASE_URL.replace(/\/api\/?$/, '')}/health`;
  const deadline = Date.now() + API_READY_TIMEOUT_MS;

  readinessStateMachine.markApiReachable(false);

  logger.info(
    `[${BOT_PROCESS_NAME}] Waiting for API to become ready at ${healthUrl} (timeout: ${API_READY_TIMEOUT_MS / 1000}s)`
  );

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        readinessStateMachine.markApiReachable(true);
        logger.info(`[${BOT_PROCESS_NAME}] API is reachable ✅`);
        return;
      }
      logger.warn(
        `[${BOT_PROCESS_NAME}] API health check returned ${response.status}, retrying...`
      );
    } catch {
      // Connection refused, timeout, DNS failure — expected during cold start
    }
    await new Promise(resolve => setTimeout(resolve, API_READY_POLL_MS));
  }

  logger.warn(
    `[${BOT_PROCESS_NAME}] ⚠️ API did not become ready within ${API_READY_TIMEOUT_MS / 1000}s. ` +
      'Bot will start anyway — interactions may fail until the API is up.'
  );
}

/**
 * Initialize and start the Discord bot process
 */
async function startBotProcess(): Promise<void> {
  logger.info(`[${BOT_PROCESS_NAME}] Starting bot process (PID: ${process.pid})`);

  const useSharding = process.env.BOT_USE_SHARDING === 'true';
  readinessStateMachine.setShardingEnabled(useSharding);
  readinessStateMachine.markDatabaseReady(false);
  readinessStateMachine.markApiReachable(false);
  readinessStateMachine.markIpcReady(false);
  readinessStateMachine.markDiscordReady(false);

  validateBotInternalSecret({
    contextLabel: `[${BOT_PROCESS_NAME}] ❌`,
    onFailure: 'exit',
  });

  // Initialize database with own connection pool
  // (DB_POOL_MAX=15 in docker-compose for bot container)
  try {
    await initializeDatabase();
    readinessStateMachine.markDatabaseReady(true);
    logger.info(`[${BOT_PROCESS_NAME}] Database initialized`);
  } catch (error) {
    logger.error(`[${BOT_PROCESS_NAME}] Failed to initialize database:`, error);
    process.exit(1);
  }

  // Redis auto-initializes on first import (singleton in utils/redis.ts)

  // Wait for the API container to become reachable before accepting interactions
  await waitForApi();

  // Initialize DomainEventBridge for cross-process event propagation
  try {
    const { initializeDomainEventBridge } = await import('../services/shared/DomainEventBridge');
    await initializeDomainEventBridge();
    logger.info(`[${BOT_PROCESS_NAME}] DomainEventBridge initialized`);
  } catch (error) {
    logger.warn(`[${BOT_PROCESS_NAME}] DomainEventBridge init failed (non-fatal):`, error);
  }

  // ==================== BOT STARTUP MODE ====================
  // BOT_USE_SHARDING=true → ShardingManager spawns shard child processes
  // Otherwise → single-process bot (existing behavior)
  if (useSharding) {
    logger.info(`[${BOT_PROCESS_NAME}] Starting in SHARDED mode`);
    const shardManager = startShardManager({
      registerProcessHandlers: false,
      exitOnSpawnFailure: false,
      onSpawnComplete: (spawnedShards: unknown) => {
        readinessStateMachine.markShardSpawnCompleted(
          typeof spawnedShards === 'number' ? spawnedShards : 0
        );
      },
      onSpawnFailure: () => {
        readinessStateMachine.markShardSpawnFailed();
      },
    });
    registerShardReadinessListeners(shardManager);
    // ShardingManager spawns botApp.ts as child processes — each child does its own DB init.
    // The parent process (this file) keeps running for health check + graceful shutdown.
    logger.info(`[${BOT_PROCESS_NAME}] ShardingManager launched — shard children initializing`);
  } else {
    // Single-process mode — direct bot startup (no sharding)
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_BOT_CLIENT_ID ?? process.env.DISCORD_CLIENT_ID;

    if (!token || !clientId) {
      logger.error(
        `[${BOT_PROCESS_NAME}] DISCORD_BOT_TOKEN or bot application client ID (DISCORD_BOT_CLIENT_ID/DISCORD_CLIENT_ID) not set. Cannot start bot.`
      );
      process.exit(1);
    }

    try {
      await startBot();
      logger.info(`[${BOT_PROCESS_NAME}] Discord bot started successfully`);
    } catch (error) {
      logger.error(`[${BOT_PROCESS_NAME}] Failed to start Discord bot:`, error);
      process.exit(1);
    }
  }

  // Local TCP health socket for container orchestration.
  healthServer = net.createServer(socket => {
    socket.end(`${buildHealthSocketLine()}\n`);
  });

  healthServer.listen(HEALTH_CHECK_PORT, () => {
    logger.info(`[${BOT_PROCESS_NAME}] Health check listening on port ${HEALTH_CHECK_PORT}`);
  });

  logger.info(`[${BOT_PROCESS_NAME}] Bot process is running.`);
}

/**
 * Stable ids for dependency-ordered shutdown (ARCH-10). A step's `dependsOn`
 * lists components that must remain available while it runs, so they are torn
 * down strictly afterwards. The declared edges — not array position — drive the
 * teardown order via {@link runBotShutdownSteps}, so reordering the step array
 * can never silently break the contract (e.g. destroying the Discord client
 * before IPC/DomainEventBridge, whose handlers still send through it).
 */
const SHUTDOWN_STEP = {
  shardManager: 'shardManager',
  ipc: 'ipc',
  domainEventBridge: 'domainEventBridge',
  connectionMonitor: 'connectionMonitor',
  discordClient: 'discordClient',
} as const;

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    if (shutdownPromise) {
      await shutdownPromise;
    }
    return;
  }
  isShuttingDown = true;

  readinessStateMachine.markDatabaseReady(false);
  readinessStateMachine.markApiReachable(false);
  readinessStateMachine.markIpcReady(false);
  readinessStateMachine.markDiscordReady(false);

  logger.info(`[${BOT_PROCESS_NAME}] Received ${signal}. Shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error(`[${BOT_PROCESS_NAME}] Graceful shutdown timed out — forcing exit`);
    process.exit(1);
  }, 30_000);
  forceExitTimer.unref();

  shutdownPromise = (async () => {
    // Clear pending voice channel deletion timers first to avoid delayed work after shutdown starts.
    clearDeletionTimers();

    if (healthServer) {
      await new Promise<void>(resolve => {
        healthServer?.close(() => resolve());
      });
      healthServer = null;
    }

    await shutdownBotRuntime().catch(error =>
      logger.warn(`[${BOT_PROCESS_NAME}] Bot runtime shutdown failed (non-fatal):`, error)
    );

    const shutdownSteps: BotShutdownStep[] = [];

    if (process.env.BOT_USE_SHARDING === 'true') {
      shutdownSteps.push({
        id: SHUTDOWN_STEP.shardManager,
        successMessage: 'Shard manager stopped',
        failureMessage: 'Shard manager stop failed (non-fatal)',
        run: async () => {
          const shardManagerModule: { stopShardManager: () => void } =
            await import('./shardManager');
          shardManagerModule.stopShardManager();
        },
      });
    }

    shutdownSteps.push(
      {
        // IPC handlers dispatch bot work that sends through the Discord client,
        // so the client must outlive IPC teardown.
        id: SHUTDOWN_STEP.ipc,
        dependsOn: [SHUTDOWN_STEP.discordClient],
        successMessage: 'BotIPCService stopped',
        failureMessage: 'BotIPCService shutdown failed (non-fatal)',
        run: async () => {
          const { BotIPCService } = await import('./BotIPCService');
          await BotIPCService.getInstance().shutdown();
        },
      },
      {
        // Bridged domain-event handlers also emit through the Discord client.
        id: SHUTDOWN_STEP.domainEventBridge,
        dependsOn: [SHUTDOWN_STEP.discordClient],
        successMessage: 'DomainEventBridge stopped',
        failureMessage: 'DomainEventBridge shutdown failed (non-fatal)',
        run: async () => {
          const { shutdownDomainEventBridge } =
            await import('../services/shared/DomainEventBridge');
          await shutdownDomainEventBridge();
        },
      },
      {
        id: SHUTDOWN_STEP.connectionMonitor,
        successMessage: 'Database connection monitor stopped',
        failureMessage: 'Connection monitor stop failed (non-fatal)',
        run: async () => {
          const { stopConnectionMonitor } = await import('../config/database');
          stopConnectionMonitor();
        },
      },
      {
        id: SHUTDOWN_STEP.discordClient,
        successMessage: 'Discord client destroyed',
        failureMessage: 'Discord client destroy failed (non-fatal)',
        run: async () => {
          await clientManager.destroy();
        },
      }
    );

    await runBotShutdownSteps(BOT_PROCESS_NAME, shutdownSteps);

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info(`[${BOT_PROCESS_NAME}] Database pool closed`);
    }

    logger.info(`[${BOT_PROCESS_NAME}] Shutdown complete.`);
    process.exit(0);
  })()
    .catch(error => {
      logger.error(`[${BOT_PROCESS_NAME}] Shutdown failed:`, error);
      process.exit(1);
    })
    .finally(() => {
      clearTimeout(forceExitTimer);
    });

  await shutdownPromise;
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('uncaughtException', error => {
  if (isTransientNetworkError(error)) {
    const shouldEscalate = shouldEscalateTransientError();

    logger.warn(`[${BOT_PROCESS_NAME}] Transient uncaught network error observed`, {
      code: error.code,
      message: error.message,
      transientErrorCount,
      transientErrorWindowMs: TRANSIENT_ERROR_WINDOW_MS,
      shouldEscalate,
    });

    if (!shouldEscalate) {
      return;
    }

    logger.error(
      `[${BOT_PROCESS_NAME}] Too many transient network errors in a short window; forcing restart`
    );
  }

  logger.error(`[${BOT_PROCESS_NAME}] Uncaught exception:`, error);
  void shutdown('uncaughtException');
});

process.on('unhandledRejection', reason => {
  logger.error(`[${BOT_PROCESS_NAME}] Unhandled rejection:`, reason);
});

// Start
startBotProcess().catch(error => {
  logger.error(`[${BOT_PROCESS_NAME}] Fatal error during startup:`, error);
  process.exit(1);
});
