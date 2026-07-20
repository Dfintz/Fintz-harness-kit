export type BotReadinessReasonCode = 'shutdown_in_progress' | 'database_not_ready' | 'api_unreachable' | 'ipc_unavailable' | 'discord_not_ready' | 'shard_spawn_in_progress' | 'shard_spawn_failed' | 'shards_not_ready';
export interface BotReadinessSnapshot {
    status: 'ok' | 'not_ready';
    ready: boolean;
    checks: {
        databaseReady: boolean;
        apiReachable: boolean;
        ipcReady: boolean;
        discordReady: boolean;
        shardingEnabled: boolean;
        shardSpawnCompleted: boolean;
        shardSpawnFailed: boolean;
        createdShards: number;
        readyShards: number;
        expectedShards: number | null;
    };
    reasonCodes: BotReadinessReasonCode[];
}
interface RuntimeReadinessOverrides {
    ipcReady?: boolean;
    discordReady?: boolean;
}
export declare class BotReadinessStateMachine {
    private databaseReady;
    private apiReachable;
    private ipcReady;
    private discordReady;
    private shardingEnabled;
    private shardSpawnCompleted;
    private shardSpawnFailed;
    private readonly createdShardIds;
    private readonly readyShardIds;
    private expectedShards;
    setShardingEnabled(enabled: boolean): void;
    markDatabaseReady(ready: boolean): void;
    markApiReachable(reachable: boolean): void;
    markIpcReady(ready: boolean): void;
    markDiscordReady(ready: boolean): void;
    recordShardCreated(shardId: number): void;
    recordShardReady(shardId: number): void;
    recordShardNotReady(shardId: number): void;
    markShardSpawnCompleted(expectedShards: number): void;
    markShardSpawnFailed(): void;
    getReadyShardCount(): number;
    getSnapshot(overrides?: RuntimeReadinessOverrides): BotReadinessSnapshot;
    toHealthSocketLine(isShuttingDown: boolean, overrides?: RuntimeReadinessOverrides): string;
    private computeDiscordReady;
    private computeIpcReady;
}
export {};
//# sourceMappingURL=BotReadinessStateMachine.d.ts.map