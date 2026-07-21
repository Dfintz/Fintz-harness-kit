jest.mock('../../../config/applicationInsights', () => ({
  trackEvent: jest.fn(),
  trackMetric: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockRedisCheck = jest.fn();
jest.mock('../../../services/shared/RedisRateLimiter', () => ({
  RedisRateLimiter: {
    getInstance: () => ({ check: mockRedisCheck }),
  },
}));

import { trackEvent, trackMetric } from '../../../config/applicationInsights';
import { NotFoundError, RateLimitError, ServiceUnavailableError } from '../../../utils/apiErrors';
import { logger } from '../../../utils/logger';
import { CooldownManager } from '../cooldownManager';
import {
  executeInteraction,
  interactionCooldownMessage,
  interactionErrorMessage,
} from '../interactionExecutor';

type MockInteraction = {
  user: { id: string; username: string };
  guildId: string | null;
  guild: { name: string } | null;
  replied: boolean;
  deferred: boolean;
  reply: jest.Mock;
  followUp: jest.Mock;
  deferReply: jest.Mock;
  deferUpdate: jest.Mock;
};

function createInteraction(overrides: Partial<MockInteraction> = {}): MockInteraction {
  return {
    user: { id: 'user-1', username: 'Pilot' },
    guildId: 'guild-1',
    guild: { name: 'Test Guild' },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('executeInteraction', () => {
  let cooldownManager: CooldownManager;

  beforeEach(() => {
    jest.clearAllMocks();
    cooldownManager = CooldownManager.getInstance();
    cooldownManager.clearUserCooldowns('user-1');
  });

  it('runs the handler and records analytics on success', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);
    const logCommandUsage = jest.fn();

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'ping',
      cooldownKey: 'ping',
      cooldownSeconds: 3,
      cooldownManager,
      commandAnalytics: { logCommandUsage } as never,
      run,
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(logCommandUsage).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: 'ping', success: true, error: undefined })
    );
  });

  it('rejects a second call within the cooldown window with a uniform denial', async () => {
    const first = createInteraction();
    const second = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);

    const options = {
      kind: 'button' as const,
      analyticsLabel: 'btn:event',
      cooldownKey: 'btn_event_join',
      cooldownSeconds: 2,
      cooldownManager,
      run,
    };

    await executeInteraction({ ...options, interaction: first as never });
    await executeInteraction({ ...options, interaction: second as never });

    expect(run).toHaveBeenCalledTimes(1);
    expect(second.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Please wait'),
        flags: expect.any(Number),
      })
    );
    expect(second.followUp).not.toHaveBeenCalled();
  });

  it('sends a uniform error response and logs when the handler throws', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockRejectedValue(new Error('boom'));
    const logCommandUsage = jest.fn();

    await executeInteraction({
      interaction: interaction as never,
      kind: 'modal',
      analyticsLabel: 'modal:poll',
      cooldownKey: 'modal_poll',
      cooldownSeconds: 2,
      cooldownManager,
      commandAnalytics: { logCommandUsage } as never,
      run,
    });

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Something went wrong'),
        flags: expect.any(Number),
      })
    );
    expect(logger.error).toHaveBeenCalled();
    expect(logCommandUsage).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: 'modal:poll', success: false, error: 'boom' })
    );
    // ARCH-08: an unclassified Error is taxonomy class `internal`, surfaced on
    // the failure event, a per-class metric, and the structured error log.
    expect(trackEvent).toHaveBeenCalledWith(
      'BotInteractionFailed',
      expect.objectContaining({ kind: 'modal', commandName: 'modal:poll', errorClass: 'internal' })
    );
    expect(trackMetric).toHaveBeenCalledWith('bot_interaction_failed_internal', 1);
    expect(trackEvent).toHaveBeenCalledWith(
      'BotCommandExecuted',
      expect.objectContaining({ success: 'false', errorClass: 'internal' })
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('class=internal'),
      expect.any(Error)
    );
  });

  it('classifies a typed ApiError onto its taxonomy class in failure telemetry', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockRejectedValue(new NotFoundError('Fleet'));

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'fleet',
      cooldownKey: 'fleet',
      cooldownSeconds: 2,
      cooldownManager,
      run,
    });

    expect(trackEvent).toHaveBeenCalledWith(
      'BotInteractionFailed',
      expect.objectContaining({ commandName: 'fleet', errorClass: 'not_found' })
    );
    expect(trackMetric).toHaveBeenCalledWith('bot_interaction_failed_not_found', 1);
  });

  it('shows a graceful degradation message when the failure is a transient dependency outage', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockRejectedValue(new ServiceUnavailableError('bot offline'));

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'analytics',
      cooldownKey: 'analytics',
      cooldownSeconds: 2,
      cooldownManager,
      run,
    });

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('a bit busy right now') })
    );
    expect(trackMetric).toHaveBeenCalledWith('bot_interaction_failed_dependency', 1);
  });

  it('shows a rate-limit message when the failure is a downstream rate limit', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockRejectedValue(new RateLimitError(30));

    await executeInteraction({
      interaction: interaction as never,
      kind: 'button',
      analyticsLabel: 'btn:sync',
      cooldownKey: 'btn_sync',
      cooldownSeconds: 2,
      cooldownManager,
      run,
    });

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('rate-limited') })
    );
  });

  it('does not emit failure telemetry on success', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'ping',
      cooldownKey: 'ping',
      cooldownSeconds: 3,
      cooldownManager,
      run,
    });

    expect(trackEvent).not.toHaveBeenCalledWith('BotInteractionFailed', expect.anything());
    expect(trackEvent).toHaveBeenCalledWith(
      'BotCommandExecuted',
      expect.objectContaining({ success: 'true' })
    );
  });

  it('uses followUp for the error response when the interaction was already deferred', async () => {
    const interaction = createInteraction({ deferred: true });
    const run = jest.fn().mockRejectedValue(new Error('late failure'));

    await executeInteraction({
      interaction: interaction as never,
      kind: 'select',
      analyticsLabel: 'select:guild',
      cooldownKey: 'select_guild',
      cooldownSeconds: 2,
      cooldownManager,
      run,
    });

    expect(interaction.followUp).toHaveBeenCalledTimes(1);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('does not throw if the handler succeeds without an analytics sink', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);

    await expect(
      executeInteraction({
        interaction: interaction as never,
        kind: 'slash',
        analyticsLabel: 'help',
        cooldownKey: 'help',
        cooldownSeconds: 1,
        cooldownManager,
        run,
      })
    ).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('defers ephemerally before running the handler when defer is set', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockImplementation(async () => {
      // The deferral must already have happened by the time the handler runs.
      expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    });

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'analytics',
      cooldownKey: 'analytics',
      cooldownSeconds: 1,
      cooldownManager,
      defer: 'ephemeral',
      run,
    });

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: expect.any(Number) });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not defer when no defer option is provided', async () => {
    const interaction = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'ping',
      cooldownKey: 'ping',
      cooldownSeconds: 1,
      cooldownManager,
      run,
    });

    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('does not defer when the cooldown denies the interaction', async () => {
    const first = createInteraction();
    const second = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);
    const base = {
      kind: 'slash' as const,
      analyticsLabel: 'analytics',
      cooldownKey: 'analytics',
      cooldownSeconds: 30,
      cooldownManager,
      defer: 'ephemeral' as const,
      run,
    };

    await executeInteraction({ ...base, interaction: first as never });
    await executeInteraction({ ...base, interaction: second as never });

    // Second call is rate-limited: it replies with the cooldown notice and never defers.
    expect(second.deferReply).not.toHaveBeenCalled();
    expect(second.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Please wait') })
    );
  });
});

describe('interactionCooldownMessage', () => {
  it('formats the remaining seconds to one decimal place', () => {
    expect(interactionCooldownMessage(1.234)).toContain('1.2s');
    expect(interactionCooldownMessage(1.234)).toContain('Please wait');
  });
});

describe('executeInteraction (distributed cooldown, BOT_DISTRIBUTED_COOLDOWN=true)', () => {
  const ORIGINAL_FLAG = process.env.BOT_DISTRIBUTED_COOLDOWN;
  let cooldownManager: CooldownManager;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BOT_DISTRIBUTED_COOLDOWN = 'true';
    cooldownManager = CooldownManager.getInstance();
    cooldownManager.clearUserCooldowns('user-1');
  });

  afterAll(() => {
    if (ORIGINAL_FLAG === undefined) {
      delete process.env.BOT_DISTRIBUTED_COOLDOWN;
    } else {
      process.env.BOT_DISTRIBUTED_COOLDOWN = ORIGINAL_FLAG;
    }
  });

  it('runs the handler when the distributed limiter allows the call', async () => {
    mockRedisCheck.mockResolvedValue({
      allowed: true,
      remaining: 0,
      resetAt: new Date(Date.now() + 3000),
    });
    const interaction = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'ping',
      cooldownKey: 'ping',
      cooldownSeconds: 3,
      cooldownManager,
      run,
    });

    expect(run).toHaveBeenCalledTimes(1);
    // A command cooldown ("1 use per cooldownSeconds") maps to check(key, 1, seconds),
    // keyed `cooldown:<cooldownKey>:<userId>` via buildRateLimitKey.
    expect(mockRedisCheck).toHaveBeenCalledWith('cooldown:ping:user-1', 1, 3);
  });

  it('rejects with the cooldown notice when the distributed limiter denies the call', async () => {
    mockRedisCheck.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 2000),
    });
    const interaction = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'ping',
      cooldownKey: 'ping',
      cooldownSeconds: 3,
      cooldownManager,
      run,
    });

    expect(run).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Please wait') })
    );
    expect(trackMetric).toHaveBeenCalledWith('bot_slash_cooldown_rejected', 1);
  });

  it('does not touch the in-memory cooldown store when distributed mode is enabled', async () => {
    mockRedisCheck.mockResolvedValue({
      allowed: true,
      remaining: 0,
      resetAt: new Date(Date.now() + 3000),
    });
    const interaction = createInteraction();
    const run = jest.fn().mockResolvedValue(undefined);
    const setSpy = jest.spyOn(cooldownManager, 'setCooldown');

    await executeInteraction({
      interaction: interaction as never,
      kind: 'slash',
      analyticsLabel: 'ping',
      cooldownKey: 'ping',
      cooldownSeconds: 3,
      cooldownManager,
      run,
    });

    // The distributed path checks-and-consumes atomically in Redis; the
    // per-process manager must not be written (it would drift across shards).
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });
});

describe('interactionErrorMessage', () => {
  it('returns the degradation message for transient timeout/dependency failures', () => {
    expect(interactionErrorMessage('slash', 'timeout')).toContain('a bit busy right now');
    expect(interactionErrorMessage('button', 'dependency')).toContain('a bit busy right now');
  });

  it('returns the rate-limit message for rate_limit failures', () => {
    expect(interactionErrorMessage('slash', 'rate_limit')).toContain('rate-limited');
  });

  it('returns the uniform per-kind copy for internal and user-correctable failures', () => {
    expect(interactionErrorMessage('slash', 'internal')).toContain('running that command');
    expect(interactionErrorMessage('modal', 'user_input')).toContain('processing that form');
    expect(interactionErrorMessage('select', 'not_found')).toContain('processing that selection');
    expect(interactionErrorMessage('button', 'permission')).toContain('processing that action');
  });
});
