import { ShardingManager } from 'discord.js';
export declare function startShardManager(options?: {
    registerProcessHandlers?: boolean;
    exitOnSpawnFailure?: boolean;
    onSpawnComplete?: (spawnedShards: number) => void;
    onSpawnFailure?: (error: unknown) => void;
}): ShardingManager;
export declare function stopShardManager(): void;
export declare function getManager(): ShardingManager | null;
//# sourceMappingURL=shardManager.d.ts.map