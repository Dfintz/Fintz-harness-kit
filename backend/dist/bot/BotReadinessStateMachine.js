"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotReadinessStateMachine = void 0;
class BotReadinessStateMachine {
    databaseReady = false;
    apiReachable = false;
    ipcReady = false;
    discordReady = false;
    shardingEnabled = false;
    shardSpawnCompleted = false;
    shardSpawnFailed = false;
    createdShardIds = new Set();
    readyShardIds = new Set();
    expectedShards = null;
    setShardingEnabled(enabled) {
        this.shardingEnabled = enabled;
        if (!enabled) {
            this.shardSpawnCompleted = false;
            this.shardSpawnFailed = false;
            this.createdShardIds.clear();
            this.readyShardIds.clear();
            this.expectedShards = null;
        }
    }
    markDatabaseReady(ready) {
        this.databaseReady = ready;
    }
    markApiReachable(reachable) {
        this.apiReachable = reachable;
    }
    markIpcReady(ready) {
        this.ipcReady = ready;
    }
    markDiscordReady(ready) {
        this.discordReady = ready;
    }
    recordShardCreated(shardId) {
        if (!this.shardingEnabled) {
            return;
        }
        this.createdShardIds.add(shardId);
    }
    recordShardReady(shardId) {
        if (!this.shardingEnabled) {
            return;
        }
        this.readyShardIds.add(shardId);
    }
    recordShardNotReady(shardId) {
        if (!this.shardingEnabled) {
            return;
        }
        this.readyShardIds.delete(shardId);
    }
    markShardSpawnCompleted(expectedShards) {
        this.shardSpawnCompleted = true;
        this.shardSpawnFailed = false;
        this.expectedShards = Math.max(expectedShards, 0);
    }
    markShardSpawnFailed() {
        this.shardSpawnCompleted = true;
        this.shardSpawnFailed = true;
    }
    getReadyShardCount() {
        return this.readyShardIds.size;
    }
    getSnapshot(overrides) {
        const effectiveDiscordReady = this.computeDiscordReady(overrides?.discordReady);
        const effectiveIpcReady = this.computeIpcReady(overrides?.ipcReady);
        const reasonCodes = [];
        if (!this.databaseReady) {
            reasonCodes.push('database_not_ready');
        }
        if (!this.apiReachable) {
            reasonCodes.push('api_unreachable');
        }
        if (!effectiveIpcReady) {
            reasonCodes.push('ipc_unavailable');
        }
        if (!effectiveDiscordReady) {
            reasonCodes.push('discord_not_ready');
        }
        if (this.shardingEnabled) {
            if (!this.shardSpawnCompleted) {
                reasonCodes.push('shard_spawn_in_progress');
            }
            if (this.shardSpawnFailed) {
                reasonCodes.push('shard_spawn_failed');
            }
            if (this.shardSpawnCompleted &&
                this.expectedShards !== null &&
                this.readyShardIds.size < this.expectedShards) {
                reasonCodes.push('shards_not_ready');
            }
        }
        const ready = reasonCodes.length === 0;
        return {
            status: ready ? 'ok' : 'not_ready',
            ready,
            checks: {
                databaseReady: this.databaseReady,
                apiReachable: this.apiReachable,
                ipcReady: effectiveIpcReady,
                discordReady: effectiveDiscordReady,
                shardingEnabled: this.shardingEnabled,
                shardSpawnCompleted: this.shardSpawnCompleted,
                shardSpawnFailed: this.shardSpawnFailed,
                createdShards: this.createdShardIds.size,
                readyShards: this.readyShardIds.size,
                expectedShards: this.expectedShards,
            },
            reasonCodes,
        };
    }
    toHealthSocketLine(isShuttingDown, overrides) {
        const snapshot = this.getSnapshot(overrides);
        const reasonCodes = new Set(snapshot.reasonCodes);
        if (isShuttingDown) {
            reasonCodes.add('shutdown_in_progress');
        }
        const status = !isShuttingDown && snapshot.ready ? 'ok' : 'not_ready';
        const reasonCodesValue = reasonCodes.size > 0 ? [...reasonCodes].join(',') : 'none';
        const expectedShardsValue = snapshot.checks.expectedShards === null ? 'unknown' : String(snapshot.checks.expectedShards);
        return [
            status,
            `apiReachable=${snapshot.checks.apiReachable}`,
            `databaseReady=${snapshot.checks.databaseReady}`,
            `ipcReady=${snapshot.checks.ipcReady}`,
            `discordReady=${snapshot.checks.discordReady}`,
            `shardingEnabled=${snapshot.checks.shardingEnabled}`,
            `shardSpawnCompleted=${snapshot.checks.shardSpawnCompleted}`,
            `shardsReady=${snapshot.checks.readyShards}/${expectedShardsValue}`,
            `reasonCodes=${reasonCodesValue}`,
        ].join(';');
    }
    computeDiscordReady(discordReadyOverride) {
        if (!this.shardingEnabled) {
            return discordReadyOverride ?? this.discordReady;
        }
        if (!this.shardSpawnCompleted || this.shardSpawnFailed) {
            return false;
        }
        if (this.expectedShards === null) {
            return false;
        }
        return this.readyShardIds.size >= this.expectedShards;
    }
    computeIpcReady(ipcReadyOverride) {
        if (!this.shardingEnabled) {
            return ipcReadyOverride ?? this.ipcReady;
        }
        if (!this.shardSpawnCompleted || this.shardSpawnFailed || this.expectedShards === null) {
            return false;
        }
        return this.readyShardIds.size >= this.expectedShards;
    }
}
exports.BotReadinessStateMachine = BotReadinessStateMachine;
//# sourceMappingURL=BotReadinessStateMachine.js.map