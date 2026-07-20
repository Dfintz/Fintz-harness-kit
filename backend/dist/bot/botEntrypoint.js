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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_net_1 = __importDefault(require("node:net"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const botApp_1 = require("./botApp");
const BotClientManager_1 = require("./BotClientManager");
const BotIPCService_1 = require("./BotIPCService");
const BotReadinessStateMachine_1 = require("./BotReadinessStateMachine");
const botShutdownCoordinator_1 = require("./botShutdownCoordinator");
const api_1 = require("./constants/api");
const shardManager_1 = require("./shardManager");
const startupValidation_1 = require("./utils/startupValidation");
const voiceAutoCreate_1 = require("./voice/voiceAutoCreate");
const BOT_PROCESS_NAME = 'sc-fleet-bot';
const HEALTH_CHECK_PORT = Number(process.env.BOT_HEALTH_PORT) || 3002;
const TRANSIENT_NETWORK_ERROR_CODES = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN']);
const TRANSIENT_ERROR_WINDOW_MS = 60_000;
const MAX_TRANSIENT_ERRORS_PER_WINDOW = 8;
const API_READY_TIMEOUT_MS = Number(process.env.BOT_API_READY_TIMEOUT_MS) || 60_000;
const API_READY_POLL_MS = 2_000;
let isShuttingDown = false;
let healthServer = null;
let shutdownPromise = null;
let transientErrorWindowStart = 0;
let transientErrorCount = 0;
const clientManager = BotClientManager_1.BotClientManager.getInstance();
const readinessStateMachine = new BotReadinessStateMachine_1.BotReadinessStateMachine();
function isNodeNetworkError(error) {
    return error instanceof Error;
}
function isTransientNetworkError(error) {
    if (!isNodeNetworkError(error)) {
        return false;
    }
    if (typeof error.code === 'string' && TRANSIENT_NETWORK_ERROR_CODES.has(error.code)) {
        return true;
    }
    const message = error.message.toLowerCase();
    return (message.includes('econnreset') ||
        message.includes('socket hang up') ||
        message.includes('connection reset by peer'));
}
function shouldEscalateTransientError() {
    const now = Date.now();
    if (transientErrorWindowStart === 0 ||
        now - transientErrorWindowStart > TRANSIENT_ERROR_WINDOW_MS) {
        transientErrorWindowStart = now;
        transientErrorCount = 0;
    }
    transientErrorCount += 1;
    return transientErrorCount > MAX_TRANSIENT_ERRORS_PER_WINDOW;
}
function registerShardReadinessListeners(shardManager) {
    const registerShardLifecycle = (shard) => {
        readinessStateMachine.recordShardCreated(shard.id);
        shard.on('ready', () => {
            readinessStateMachine.recordShardReady(shard.id);
        });
        const markShardNotReady = () => {
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
function buildHealthSocketLine() {
    const shardingEnabled = process.env.BOT_USE_SHARDING === 'true';
    if (shardingEnabled) {
        return readinessStateMachine.toHealthSocketLine(isShuttingDown);
    }
    return readinessStateMachine.toHealthSocketLine(isShuttingDown, {
        ipcReady: BotIPCService_1.BotIPCService.getInstance().isAvailable(),
        discordReady: clientManager.isReady(),
    });
}
async function waitForApi() {
    const healthUrl = `${api_1.API_BASE_URL.replace(/\/api\/?$/, '')}/health`;
    const deadline = Date.now() + API_READY_TIMEOUT_MS;
    readinessStateMachine.markApiReachable(false);
    logger_1.logger.info(`[${BOT_PROCESS_NAME}] Waiting for API to become ready at ${healthUrl} (timeout: ${API_READY_TIMEOUT_MS / 1000}s)`);
    while (Date.now() < deadline) {
        try {
            const response = await fetch(healthUrl, {
                signal: AbortSignal.timeout(5_000),
            });
            if (response.ok) {
                readinessStateMachine.markApiReachable(true);
                logger_1.logger.info(`[${BOT_PROCESS_NAME}] API is reachable ✅`);
                return;
            }
            logger_1.logger.warn(`[${BOT_PROCESS_NAME}] API health check returned ${response.status}, retrying...`);
        }
        catch {
        }
        await new Promise(resolve => setTimeout(resolve, API_READY_POLL_MS));
    }
    logger_1.logger.warn(`[${BOT_PROCESS_NAME}] ⚠️ API did not become ready within ${API_READY_TIMEOUT_MS / 1000}s. ` +
        'Bot will start anyway — interactions may fail until the API is up.');
}
async function startBotProcess() {
    logger_1.logger.info(`[${BOT_PROCESS_NAME}] Starting bot process (PID: ${process.pid})`);
    const useSharding = process.env.BOT_USE_SHARDING === 'true';
    readinessStateMachine.setShardingEnabled(useSharding);
    readinessStateMachine.markDatabaseReady(false);
    readinessStateMachine.markApiReachable(false);
    readinessStateMachine.markIpcReady(false);
    readinessStateMachine.markDiscordReady(false);
    (0, startupValidation_1.validateBotInternalSecret)({
        contextLabel: `[${BOT_PROCESS_NAME}] ❌`,
        onFailure: 'exit',
    });
    try {
        await (0, database_1.initializeDatabase)();
        readinessStateMachine.markDatabaseReady(true);
        logger_1.logger.info(`[${BOT_PROCESS_NAME}] Database initialized`);
    }
    catch (error) {
        logger_1.logger.error(`[${BOT_PROCESS_NAME}] Failed to initialize database:`, error);
        process.exit(1);
    }
    await waitForApi();
    try {
        const { initializeDomainEventBridge } = await Promise.resolve().then(() => __importStar(require('../services/shared/DomainEventBridge')));
        await initializeDomainEventBridge();
        logger_1.logger.info(`[${BOT_PROCESS_NAME}] DomainEventBridge initialized`);
    }
    catch (error) {
        logger_1.logger.warn(`[${BOT_PROCESS_NAME}] DomainEventBridge init failed (non-fatal):`, error);
    }
    if (useSharding) {
        logger_1.logger.info(`[${BOT_PROCESS_NAME}] Starting in SHARDED mode`);
        const shardManager = (0, shardManager_1.startShardManager)({
            registerProcessHandlers: false,
            exitOnSpawnFailure: false,
            onSpawnComplete: (spawnedShards) => {
                readinessStateMachine.markShardSpawnCompleted(typeof spawnedShards === 'number' ? spawnedShards : 0);
            },
            onSpawnFailure: () => {
                readinessStateMachine.markShardSpawnFailed();
            },
        });
        registerShardReadinessListeners(shardManager);
        logger_1.logger.info(`[${BOT_PROCESS_NAME}] ShardingManager launched — shard children initializing`);
    }
    else {
        const token = process.env.DISCORD_BOT_TOKEN;
        const clientId = process.env.DISCORD_BOT_CLIENT_ID ?? process.env.DISCORD_CLIENT_ID;
        if (!token || !clientId) {
            logger_1.logger.error(`[${BOT_PROCESS_NAME}] DISCORD_BOT_TOKEN or bot application client ID (DISCORD_BOT_CLIENT_ID/DISCORD_CLIENT_ID) not set. Cannot start bot.`);
            process.exit(1);
        }
        try {
            await (0, botApp_1.startBot)();
            logger_1.logger.info(`[${BOT_PROCESS_NAME}] Discord bot started successfully`);
        }
        catch (error) {
            logger_1.logger.error(`[${BOT_PROCESS_NAME}] Failed to start Discord bot:`, error);
            process.exit(1);
        }
    }
    healthServer = node_net_1.default.createServer(socket => {
        socket.end(`${buildHealthSocketLine()}\n`);
    });
    healthServer.listen(HEALTH_CHECK_PORT, () => {
        logger_1.logger.info(`[${BOT_PROCESS_NAME}] Health check listening on port ${HEALTH_CHECK_PORT}`);
    });
    logger_1.logger.info(`[${BOT_PROCESS_NAME}] Bot process is running.`);
}
const SHUTDOWN_STEP = {
    shardManager: 'shardManager',
    ipc: 'ipc',
    domainEventBridge: 'domainEventBridge',
    connectionMonitor: 'connectionMonitor',
    discordClient: 'discordClient',
};
async function shutdown(signal) {
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
    logger_1.logger.info(`[${BOT_PROCESS_NAME}] Received ${signal}. Shutting down gracefully...`);
    const forceExitTimer = setTimeout(() => {
        logger_1.logger.error(`[${BOT_PROCESS_NAME}] Graceful shutdown timed out — forcing exit`);
        process.exit(1);
    }, 30_000);
    forceExitTimer.unref();
    shutdownPromise = (async () => {
        (0, voiceAutoCreate_1.clearDeletionTimers)();
        if (healthServer) {
            await new Promise(resolve => {
                healthServer?.close(() => resolve());
            });
            healthServer = null;
        }
        await (0, botApp_1.shutdownBotRuntime)().catch(error => logger_1.logger.warn(`[${BOT_PROCESS_NAME}] Bot runtime shutdown failed (non-fatal):`, error));
        const shutdownSteps = [];
        if (process.env.BOT_USE_SHARDING === 'true') {
            shutdownSteps.push({
                id: SHUTDOWN_STEP.shardManager,
                successMessage: 'Shard manager stopped',
                failureMessage: 'Shard manager stop failed (non-fatal)',
                run: async () => {
                    const shardManagerModule = await Promise.resolve().then(() => __importStar(require('./shardManager')));
                    shardManagerModule.stopShardManager();
                },
            });
        }
        shutdownSteps.push({
            id: SHUTDOWN_STEP.ipc,
            dependsOn: [SHUTDOWN_STEP.discordClient],
            successMessage: 'BotIPCService stopped',
            failureMessage: 'BotIPCService shutdown failed (non-fatal)',
            run: async () => {
                const { BotIPCService } = await Promise.resolve().then(() => __importStar(require('./BotIPCService')));
                await BotIPCService.getInstance().shutdown();
            },
        }, {
            id: SHUTDOWN_STEP.domainEventBridge,
            dependsOn: [SHUTDOWN_STEP.discordClient],
            successMessage: 'DomainEventBridge stopped',
            failureMessage: 'DomainEventBridge shutdown failed (non-fatal)',
            run: async () => {
                const { shutdownDomainEventBridge } = await Promise.resolve().then(() => __importStar(require('../services/shared/DomainEventBridge')));
                await shutdownDomainEventBridge();
            },
        }, {
            id: SHUTDOWN_STEP.connectionMonitor,
            successMessage: 'Database connection monitor stopped',
            failureMessage: 'Connection monitor stop failed (non-fatal)',
            run: async () => {
                const { stopConnectionMonitor } = await Promise.resolve().then(() => __importStar(require('../config/database')));
                stopConnectionMonitor();
            },
        }, {
            id: SHUTDOWN_STEP.discordClient,
            successMessage: 'Discord client destroyed',
            failureMessage: 'Discord client destroy failed (non-fatal)',
            run: async () => {
                await clientManager.destroy();
            },
        });
        await (0, botShutdownCoordinator_1.runBotShutdownSteps)(BOT_PROCESS_NAME, shutdownSteps);
        if (database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.destroy();
            logger_1.logger.info(`[${BOT_PROCESS_NAME}] Database pool closed`);
        }
        logger_1.logger.info(`[${BOT_PROCESS_NAME}] Shutdown complete.`);
        process.exit(0);
    })()
        .catch(error => {
        logger_1.logger.error(`[${BOT_PROCESS_NAME}] Shutdown failed:`, error);
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
        logger_1.logger.warn(`[${BOT_PROCESS_NAME}] Transient uncaught network error observed`, {
            code: error.code,
            message: error.message,
            transientErrorCount,
            transientErrorWindowMs: TRANSIENT_ERROR_WINDOW_MS,
            shouldEscalate,
        });
        if (!shouldEscalate) {
            return;
        }
        logger_1.logger.error(`[${BOT_PROCESS_NAME}] Too many transient network errors in a short window; forcing restart`);
    }
    logger_1.logger.error(`[${BOT_PROCESS_NAME}] Uncaught exception:`, error);
    void shutdown('uncaughtException');
});
process.on('unhandledRejection', reason => {
    logger_1.logger.error(`[${BOT_PROCESS_NAME}] Unhandled rejection:`, reason);
});
startBotProcess().catch(error => {
    logger_1.logger.error(`[${BOT_PROCESS_NAME}] Fatal error during startup:`, error);
    process.exit(1);
});
//# sourceMappingURL=botEntrypoint.js.map