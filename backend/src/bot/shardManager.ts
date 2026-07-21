import path from 'node:path';

import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';

import { logger } from '../utils/logger';

/**
 * ShardingManager Entry Point — Spawns and manages Discord bot shards.
 *
 * This is the production entry point for the bot. It launches botApp.ts
 * as separate shard processes, each handling a subset of guilds.
 *
 * Discord mandates sharding at 2,500 guilds. Using `totalShards: 'auto'`
 * lets Discord recommend the optimal shard count based on the bot's guild count.
 *
 * Environment variables:
 *   DISCORD_BOT_TOKEN      — Required. Bot authentication token.
 *   BOT_TOTAL_SHARDS       — Optional. Override shard count ('auto' or number).
 *   BOT_SHARDS_PER_CLUSTER — Optional. Not used with basic ShardingManager.
 *   BOT_RESPAWN_DELAY      — Optional. Delay between shard respawns (ms, default: 5000).
 *   BOT_SHARD_ENTRY        — Optional. Override the bot entry file path.
 *
 * Usage:
 *   npx ts-node backend/src/bot/shardManager.ts
 *   node dist/bot/shardManager.js
 *
 * Wave 1.9 — Bot Architecture Hardening
 */

// Exported manager handle for testing; will be assigned when startShardManager() runs.
let manager: ShardingManager | null = null;

/**
 * Start the ShardingManager. Wrapped in a function so that importing this
 * module (e.g. from tests) doesn't immediately attempt to spawn shards or
 * call process.exit(1) when env vars are missing.
 */
export function startShardManager(options?: {
  registerProcessHandlers?: boolean;
  exitOnSpawnFailure?: boolean;
  onSpawnComplete?: (spawnedShards: number) => void;
  onSpawnFailure?: (error: unknown) => void;
}): ShardingManager {
  dotenv.config();

  const registerProcessHandlers = options?.registerProcessHandlers ?? true;
  const exitOnSpawnFailure = options?.exitOnSpawnFailure ?? true;

  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    logger.error('❌ DISCORD_BOT_TOKEN is not set in environment variables');
    process.exit(1);
  }

  // Determine the bot entry file.
  // In production (compiled JS), use botApp.js; in development (ts-node), use botApp.ts.
  const botEntry =
    process.env.BOT_SHARD_ENTRY ||
    path.join(__dirname, process.env.NODE_ENV === 'production' ? 'botApp.js' : 'botApp.ts');

  // Determine shard count
  const totalShardsEnv = process.env.BOT_TOTAL_SHARDS;
  const totalShards: 'auto' | number =
    totalShardsEnv && totalShardsEnv !== 'auto' ? Number.parseInt(totalShardsEnv, 10) : 'auto';

  // Respawn delay (ms between shard spawns)
  const respawnDelay = Number.parseInt(process.env.BOT_RESPAWN_DELAY ?? '5000', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  // Create the ShardingManager
  const shardManager = new ShardingManager(botEntry, {
    token,
    totalShards,
    respawn: true,
    execArgv: isProduction ? [] : ['-r', 'ts-node/register'],
  });

  // Expose for testing/introspection
  manager = shardManager;

  /* ------------------------------------------------------------------ */
  /*  Shard lifecycle events                                             */
  /* ------------------------------------------------------------------ */

  shardManager.on('shardCreate', shard => {
    const shardTag = `[Shard ${shard.id}]`;

    logger.info(`🚀 ${shardTag} Launched`);

    shard.on('ready', () => {
      logger.info(`✅ ${shardTag} Ready`);
    });

    shard.on('disconnect', () => {
      logger.warn(`⚠️ ${shardTag} Disconnected`);
    });

    shard.on('reconnecting', () => {
      logger.info(`🔄 ${shardTag} Reconnecting...`);
    });

    shard.on('death', childProcess => {
      const pid = (childProcess as { pid?: number }).pid ?? 'N/A';
      const exitCode = (childProcess as { exitCode?: number | null }).exitCode ?? 'N/A';
      logger.error(`💀 ${shardTag} Died (PID: ${pid}, exit code: ${exitCode})`);
    });

    shard.on('error', error => {
      logger.error(`❌ ${shardTag} Error:`, error);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Spawn shards                                                       */
  /* ------------------------------------------------------------------ */

  logger.info(
    `🤖 Starting ShardingManager with totalShards=${totalShards}, respawnDelay=${respawnDelay}ms`
  );

  shardManager
    .spawn({ delay: respawnDelay, timeout: 60_000 })
    .then(shards => {
      logger.info(`✅ ShardingManager spawned ${shards.size} shard(s)`);
      options?.onSpawnComplete?.(shards.size);
    })
    .catch(error => {
      logger.error('❌ ShardingManager failed to spawn shards:', error);
      options?.onSpawnFailure?.(error);

      if (exitOnSpawnFailure) {
        process.exit(1);
      }
    });

  /* ------------------------------------------------------------------ */
  /*  Graceful shutdown                                                  */
  /* ------------------------------------------------------------------ */

  function handleShutdown(signal: string): void {
    logger.info(`\n📥 Received ${signal}, shutting down shards...`);

    stopShardManager();

    process.exit(0);
  }

  if (registerProcessHandlers) {
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  }

  return shardManager;
}

export function stopShardManager(): void {
  if (!manager) {
    return;
  }

  for (const [id, shard] of manager.shards) {
    logger.info(`  ⏹️ Killing shard ${id} (PID: ${shard.process?.pid})`);
    shard.kill();
  }
}

// Only spawn shards when run directly (not when imported by tests)
if (require.main === module) {
  startShardManager();
}

// Export getter for testing (avoids mutable let export)
export function getManager(): ShardingManager | null {
  return manager;
}
