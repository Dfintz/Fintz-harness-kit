import { BotReadinessStateMachine } from '../BotReadinessStateMachine';

describe('BotReadinessStateMachine', () => {
  it('returns ok when all single-process readiness dimensions are satisfied', () => {
    const machine = new BotReadinessStateMachine();
    machine.setShardingEnabled(false);
    machine.markDatabaseReady(true);
    machine.markApiReachable(true);
    machine.markIpcReady(true);
    machine.markDiscordReady(true);

    const snapshot = machine.getSnapshot();

    expect(snapshot.status).toBe('ok');
    expect(snapshot.reasonCodes).toHaveLength(0);
  });

  it('reports missing single-process dimensions with reason codes', () => {
    const machine = new BotReadinessStateMachine();
    machine.setShardingEnabled(false);
    machine.markDatabaseReady(true);
    machine.markApiReachable(true);
    machine.markIpcReady(false);
    machine.markDiscordReady(false);

    const snapshot = machine.getSnapshot();

    expect(snapshot.status).toBe('not_ready');
    expect(snapshot.reasonCodes).toEqual(
      expect.arrayContaining(['ipc_unavailable', 'discord_not_ready'])
    );
  });

  it('requires shard spawn and full shard readiness in sharded mode', () => {
    const machine = new BotReadinessStateMachine();
    machine.setShardingEnabled(true);
    machine.markDatabaseReady(true);
    machine.markApiReachable(true);

    machine.recordShardCreated(0);
    machine.recordShardCreated(1);
    machine.recordShardReady(0);

    let snapshot = machine.getSnapshot();
    expect(snapshot.status).toBe('not_ready');
    expect(snapshot.reasonCodes).toEqual(
      expect.arrayContaining(['shard_spawn_in_progress', 'discord_not_ready'])
    );

    machine.markShardSpawnCompleted(2);
    snapshot = machine.getSnapshot();

    expect(snapshot.status).toBe('not_ready');
    expect(snapshot.reasonCodes).toEqual(expect.arrayContaining(['shards_not_ready']));

    machine.recordShardReady(1);
    snapshot = machine.getSnapshot();

    expect(snapshot.status).toBe('ok');
    expect(snapshot.checks.readyShards).toBe(2);
    expect(snapshot.checks.expectedShards).toBe(2);
  });

  it('exposes shard spawn failure in readiness reasons', () => {
    const machine = new BotReadinessStateMachine();
    machine.setShardingEnabled(true);
    machine.markDatabaseReady(true);
    machine.markApiReachable(true);
    machine.markShardSpawnFailed();

    const snapshot = machine.getSnapshot();

    expect(snapshot.status).toBe('not_ready');
    expect(snapshot.reasonCodes).toEqual(
      expect.arrayContaining(['shard_spawn_failed', 'discord_not_ready'])
    );
  });

  it('treats zero expected shards as ready after successful spawn completion', () => {
    const machine = new BotReadinessStateMachine();
    machine.setShardingEnabled(true);
    machine.markDatabaseReady(true);
    machine.markApiReachable(true);
    machine.markShardSpawnCompleted(0);

    const snapshot = machine.getSnapshot();

    expect(snapshot.status).toBe('ok');
    expect(snapshot.checks.expectedShards).toBe(0);
    expect(snapshot.reasonCodes).toHaveLength(0);
  });

  it('uses runtime overrides without mutating stored single-process readiness state', () => {
    const machine = new BotReadinessStateMachine();
    machine.setShardingEnabled(false);
    machine.markDatabaseReady(true);
    machine.markApiReachable(true);
    machine.markIpcReady(false);
    machine.markDiscordReady(false);

    const runtimeSnapshot = machine.getSnapshot({
      ipcReady: true,
      discordReady: true,
    });
    const storedSnapshot = machine.getSnapshot();

    expect(runtimeSnapshot.status).toBe('ok');
    expect(storedSnapshot.status).toBe('not_ready');
    expect(storedSnapshot.reasonCodes).toEqual(
      expect.arrayContaining(['ipc_unavailable', 'discord_not_ready'])
    );
  });

  it('includes shutdown reason in health socket output while forcing not_ready', () => {
    const machine = new BotReadinessStateMachine();
    machine.setShardingEnabled(false);
    machine.markDatabaseReady(true);
    machine.markApiReachable(true);
    machine.markIpcReady(true);
    machine.markDiscordReady(true);

    const line = machine.toHealthSocketLine(true);

    expect(line.startsWith('not_ready;')).toBe(true);
    expect(line).toContain('reasonCodes=shutdown_in_progress');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
