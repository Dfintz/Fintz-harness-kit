export type BotReadinessReasonCode =
  | 'shutdown_in_progress'
  | 'database_not_ready'
  | 'api_unreachable'
  | 'ipc_unavailable'
  | 'discord_not_ready'
  | 'shard_spawn_in_progress'
  | 'shard_spawn_failed'
  | 'shards_not_ready';

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

/**
 * Bot runtime readiness state machine used by the container health socket.
 *
 * The machine tracks readiness dimensions separately and computes a compact
 * readiness snapshot for probes. In sharded mode, Discord readiness is based
 * on shard progression instead of single-client readiness.
 */
export class BotReadinessStateMachine {
  private databaseReady = false;
  private apiReachable = false;
  private ipcReady = false;
  private discordReady = false;

  private shardingEnabled = false;
  private shardSpawnCompleted = false;
  private shardSpawnFailed = false;

  private readonly createdShardIds = new Set<number>();
  private readonly readyShardIds = new Set<number>();
  private expectedShards: number | null = null;

  public setShardingEnabled(enabled: boolean): void {
    this.shardingEnabled = enabled;

    if (!enabled) {
      this.shardSpawnCompleted = false;
      this.shardSpawnFailed = false;
      this.createdShardIds.clear();
      this.readyShardIds.clear();
      this.expectedShards = null;
    }
  }

  public markDatabaseReady(ready: boolean): void {
    this.databaseReady = ready;
  }

  public markApiReachable(reachable: boolean): void {
    this.apiReachable = reachable;
  }

  public markIpcReady(ready: boolean): void {
    this.ipcReady = ready;
  }

  public markDiscordReady(ready: boolean): void {
    this.discordReady = ready;
  }

  public recordShardCreated(shardId: number): void {
    if (!this.shardingEnabled) {
      return;
    }

    this.createdShardIds.add(shardId);
  }

  public recordShardReady(shardId: number): void {
    if (!this.shardingEnabled) {
      return;
    }

    this.readyShardIds.add(shardId);
  }

  public recordShardNotReady(shardId: number): void {
    if (!this.shardingEnabled) {
      return;
    }

    this.readyShardIds.delete(shardId);
  }

  public markShardSpawnCompleted(expectedShards: number): void {
    this.shardSpawnCompleted = true;
    this.shardSpawnFailed = false;
    this.expectedShards = Math.max(expectedShards, 0);
  }

  public markShardSpawnFailed(): void {
    this.shardSpawnCompleted = true;
    this.shardSpawnFailed = true;
  }

  public getReadyShardCount(): number {
    return this.readyShardIds.size;
  }

  public getSnapshot(overrides?: RuntimeReadinessOverrides): BotReadinessSnapshot {
    const effectiveDiscordReady = this.computeDiscordReady(overrides?.discordReady);
    const effectiveIpcReady = this.computeIpcReady(overrides?.ipcReady);

    const reasonCodes: BotReadinessReasonCode[] = [];

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

      if (
        this.shardSpawnCompleted &&
        this.expectedShards !== null &&
        this.readyShardIds.size < this.expectedShards
      ) {
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

  public toHealthSocketLine(
    isShuttingDown: boolean,
    overrides?: RuntimeReadinessOverrides
  ): string {
    const snapshot = this.getSnapshot(overrides);
    const reasonCodes = new Set<BotReadinessReasonCode>(snapshot.reasonCodes);

    if (isShuttingDown) {
      reasonCodes.add('shutdown_in_progress');
    }

    const status = !isShuttingDown && snapshot.ready ? 'ok' : 'not_ready';
    const reasonCodesValue = reasonCodes.size > 0 ? [...reasonCodes].join(',') : 'none';
    const expectedShardsValue =
      snapshot.checks.expectedShards === null ? 'unknown' : String(snapshot.checks.expectedShards);

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

  private computeDiscordReady(discordReadyOverride?: boolean): boolean {
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

  private computeIpcReady(ipcReadyOverride?: boolean): boolean {
    if (!this.shardingEnabled) {
      return ipcReadyOverride ?? this.ipcReady;
    }

    // In sharded mode the parent process does not own IPC clients;
    // proxy readiness through shard readiness progression.
    if (!this.shardSpawnCompleted || this.shardSpawnFailed || this.expectedShards === null) {
      return false;
    }

    return this.readyShardIds.size >= this.expectedShards;
  }
}
