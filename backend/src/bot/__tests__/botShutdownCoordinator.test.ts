import type { BotShutdownStep } from '../botShutdownCoordinator';
import { orderShutdownSteps, runBotShutdownSteps } from '../botShutdownCoordinator';

/** Build a no-op step carrying just the ordering metadata under test. */
function step(
  id: string,
  dependsOn?: readonly string[]
): BotShutdownStep & { readonly id: string } {
  return { id, dependsOn, successMessage: id, run: () => {} };
}

/** Extract the resolved id sequence from an ordering plan. */
function idsOf(steps: readonly BotShutdownStep[]): string[] {
  return steps.map(s => s.id ?? s.successMessage);
}

describe('botShutdownCoordinator', () => {
  it('runs steps in order and continues after a non-fatal failure', async () => {
    const calls: string[] = [];

    const steps: BotShutdownStep[] = [
      {
        successMessage: 'first',
        run: () => {
          calls.push('first');
        },
      },
      {
        successMessage: 'second',
        run: () => {
          calls.push('second');
          throw new Error('expected');
        },
      },
      {
        successMessage: 'third',
        run: async () => {
          calls.push('third');
        },
      },
    ];

    await runBotShutdownSteps('test-bot', steps);

    expect(calls).toEqual(['first', 'second', 'third']);
  });

  it('is reusable across repeated shutdown invocations', async () => {
    let invocationCount = 0;

    const steps: BotShutdownStep[] = [
      {
        successMessage: 'single-step',
        run: () => {
          invocationCount += 1;
        },
      },
    ];

    await runBotShutdownSteps('test-bot', steps);
    await runBotShutdownSteps('test-bot', steps);

    expect(invocationCount).toBe(2);
  });

  it('runs steps in dependency order even when the array is reversed (ARCH-10)', async () => {
    const calls: string[] = [];
    const record = (id: string): BotShutdownStep => ({
      id,
      successMessage: id,
      run: () => {
        calls.push(id);
      },
    });

    // Declared last, but `ipc` depends on it → must actually run last.
    const client: BotShutdownStep = record('discordClient');
    const ipc: BotShutdownStep = { ...record('ipc'), dependsOn: ['discordClient'] };

    await runBotShutdownSteps('test-bot', [client, ipc]);

    expect(calls).toEqual(['ipc', 'discordClient']);
  });
});

describe('orderShutdownSteps (ARCH-10)', () => {
  it('preserves declared order when no dependencies are declared', () => {
    const steps = [step('a'), step('b'), step('c')];

    const { ordered, warnings } = orderShutdownSteps(steps);

    expect(idsOf(ordered)).toEqual(['a', 'b', 'c']);
    expect(warnings).toEqual([]);
  });

  it('places a dependent before its dependency regardless of array position', () => {
    // ipc depends on discordClient → ipc must come first even though it is last.
    const steps = [step('discordClient'), step('ipc', ['discordClient'])];

    const { ordered } = orderShutdownSteps(steps);

    expect(idsOf(ordered)).toEqual(['ipc', 'discordClient']);
  });

  it('reproduces the bot teardown order with a stable tiebreak', () => {
    // Mirrors botEntrypoint: shardManager, ipc, domainEventBridge,
    // connectionMonitor, discordClient — ipc/bridge depend on the client.
    const steps = [
      step('shardManager'),
      step('ipc', ['discordClient']),
      step('domainEventBridge', ['discordClient']),
      step('connectionMonitor'),
      step('discordClient'),
    ];

    const { ordered, warnings } = orderShutdownSteps(steps);

    expect(idsOf(ordered)).toEqual([
      'shardManager',
      'ipc',
      'domainEventBridge',
      'connectionMonitor',
      'discordClient',
    ]);
    expect(warnings).toEqual([]);
  });

  it('keeps the dependency invariant even if the client is declared first', () => {
    // A future reorder that puts the client first must NOT tear it down before
    // its dependents — the declared edges still win.
    const steps = [
      step('discordClient'),
      step('ipc', ['discordClient']),
      step('domainEventBridge', ['discordClient']),
    ];

    const { ordered } = orderShutdownSteps(steps);

    const order = idsOf(ordered);
    expect(order.indexOf('ipc')).toBeLessThan(order.indexOf('discordClient'));
    expect(order.indexOf('domainEventBridge')).toBeLessThan(order.indexOf('discordClient'));
  });

  it('falls back to declared order and warns on an unknown dependency id', () => {
    const steps = [step('ipc', ['nope']), step('discordClient')];

    const { ordered, warnings } = orderShutdownSteps(steps);

    expect(idsOf(ordered)).toEqual(['ipc', 'discordClient']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('unknown id "nope"');
  });

  it('falls back to declared order and warns on a dependency cycle', () => {
    const steps = [step('a', ['b']), step('b', ['a'])];

    const { ordered, warnings } = orderShutdownSteps(steps);

    expect(idsOf(ordered)).toEqual(['a', 'b']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Cyclic');
  });

  it('falls back to declared order and warns on a duplicate id', () => {
    const steps = [step('dup'), step('dup')];

    const { ordered, warnings } = orderShutdownSteps(steps);

    expect(idsOf(ordered)).toEqual(['dup', 'dup']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Duplicate shutdown step id "dup"');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
