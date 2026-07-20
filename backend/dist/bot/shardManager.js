"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startShardManager = startShardManager;
exports.stopShardManager = stopShardManager;
exports.getManager = getManager;
const node_path_1 = __importDefault(require("node:path"));
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../utils/logger");
let manager = null;
function startShardManager(options) {
    dotenv_1.default.config();
    const registerProcessHandlers = options?.registerProcessHandlers ?? true;
    const exitOnSpawnFailure = options?.exitOnSpawnFailure ?? true;
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        logger_1.logger.error('❌ DISCORD_BOT_TOKEN is not set in environment variables');
        process.exit(1);
    }
    const botEntry = process.env.BOT_SHARD_ENTRY ||
        node_path_1.default.join(__dirname, process.env.NODE_ENV === 'production' ? 'botApp.js' : 'botApp.ts');
    const totalShardsEnv = process.env.BOT_TOTAL_SHARDS;
    const totalShards = totalShardsEnv && totalShardsEnv !== 'auto' ? Number.parseInt(totalShardsEnv, 10) : 'auto';
    const respawnDelay = Number.parseInt(process.env.BOT_RESPAWN_DELAY ?? '5000', 10);
    const isProduction = process.env.NODE_ENV === 'production';
    const shardManager = new discord_js_1.ShardingManager(botEntry, {
        token,
        totalShards,
        respawn: true,
        execArgv: isProduction ? [] : ['-r', 'ts-node/register'],
    });
    manager = shardManager;
    shardManager.on('shardCreate', shard => {
        const shardTag = `[Shard ${shard.id}]`;
        logger_1.logger.info(`🚀 ${shardTag} Launched`);
        shard.on('ready', () => {
            logger_1.logger.info(`✅ ${shardTag} Ready`);
        });
        shard.on('disconnect', () => {
            logger_1.logger.warn(`⚠️ ${shardTag} Disconnected`);
        });
        shard.on('reconnecting', () => {
            logger_1.logger.info(`🔄 ${shardTag} Reconnecting...`);
        });
        shard.on('death', childProcess => {
            const pid = childProcess.pid ?? 'N/A';
            const exitCode = childProcess.exitCode ?? 'N/A';
            logger_1.logger.error(`💀 ${shardTag} Died (PID: ${pid}, exit code: ${exitCode})`);
        });
        shard.on('error', error => {
            logger_1.logger.error(`❌ ${shardTag} Error:`, error);
        });
    });
    logger_1.logger.info(`🤖 Starting ShardingManager with totalShards=${totalShards}, respawnDelay=${respawnDelay}ms`);
    shardManager
        .spawn({ delay: respawnDelay, timeout: 60_000 })
        .then(shards => {
        logger_1.logger.info(`✅ ShardingManager spawned ${shards.size} shard(s)`);
        options?.onSpawnComplete?.(shards.size);
    })
        .catch(error => {
        logger_1.logger.error('❌ ShardingManager failed to spawn shards:', error);
        options?.onSpawnFailure?.(error);
        if (exitOnSpawnFailure) {
            process.exit(1);
        }
    });
    function handleShutdown(signal) {
        logger_1.logger.info(`\n📥 Received ${signal}, shutting down shards...`);
        stopShardManager();
        process.exit(0);
    }
    if (registerProcessHandlers) {
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    }
    return shardManager;
}
function stopShardManager() {
    if (!manager) {
        return;
    }
    for (const [id, shard] of manager.shards) {
        logger_1.logger.info(`  ⏹️ Killing shard ${id} (PID: ${shard.process?.pid})`);
        shard.kill();
    }
}
if (require.main === module) {
    startShardManager();
}
function getManager() {
    return manager;
}
//# sourceMappingURL=shardManager.js.map