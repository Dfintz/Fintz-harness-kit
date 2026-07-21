/**
 * Unit tests for the role-sync backpressure glue: the Discord rate-limit
 * classifier, retry-after extraction, the limiter-backed decorator, and the
 * env-driven limiter factory.
 */
import {
  createRoleSyncRateLimiter,
  extractRetryAfterMs,
  isDiscordRateLimitError,
  RoleSyncDiscordService,
  wrapWithRoleSyncBackpressure,
} from '../../services/external/roleSyncBackpressure';
import { AdaptiveRateLimiter } from '../../utils/adaptiveRateLimiter';

/** Spy limiter implementing only the surface the decorator uses. */
function createSpyLimiter() {
  const acquire = jest.fn(async (): Promise<number> => 0);
  const recordSuccess = jest.fn();
  const recordBackpressure = jest.fn();
  const limiter = { acquire, recordSuccess, recordBackpressure } as unknown as AdaptiveRateLimiter;
  return { limiter, acquire, recordSuccess, recordBackpressure };
}

describe('isDiscordRateLimitError', () => {
  it.each([
    ['discord.js RateLimitError', { name: 'RateLimitError' }],
    ['numeric status 429', { status: 429 }],
    ['numeric statusCode 429', { statusCode: 429 }],
    ['numeric httpStatus 429', { httpStatus: 429 }],
    ['REST fallback message', new Error('Discord API returned 429 when trying to assign role')],
    ['rate limit phrase', new Error('You are being rate limited')],
    ['too many requests phrase', { message: 'Too Many Requests' }],
  ])('returns true for %s', (_label, error) => {
    expect(isDiscordRateLimitError(error)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'rate limit'],
    ['permission error', new Error('Bot lacks "Manage Roles" permission')],
    ['forbidden status', { status: 403 }],
    ['unknown member', new Error('User is not a member of guild')],
    ['discord permission code', { code: 50013, message: 'missing permissions' }],
  ])('returns false for %s', (_label, error) => {
    expect(isDiscordRateLimitError(error)).toBe(false);
  });
});

describe('extractRetryAfterMs', () => {
  it('reads retryAfter (milliseconds) first', () => {
    expect(extractRetryAfterMs({ retryAfter: 1500, timeToReset: 9999 })).toBe(1500);
  });

  it('falls back to timeToReset (milliseconds)', () => {
    expect(extractRetryAfterMs({ timeToReset: 2000 })).toBe(2000);
  });

  it('converts a raw retry_after (seconds) to milliseconds', () => {
    expect(extractRetryAfterMs({ retry_after: 3 })).toBe(3000);
  });

  it('returns undefined when no hint is present', () => {
    expect(extractRetryAfterMs(new Error('boom'))).toBeUndefined();
    expect(extractRetryAfterMs(null)).toBeUndefined();
    expect(extractRetryAfterMs({ retryAfter: 0 })).toBeUndefined();
  });
});

describe('wrapWithRoleSyncBackpressure', () => {
  const baseService: RoleSyncDiscordService = {
    assignRole: jest.fn(async () => 'assigned'),
    removeRole: jest.fn(async () => 'removed'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('paces and records success on a successful assign', async () => {
    const { limiter, acquire, recordSuccess, recordBackpressure } = createSpyLimiter();
    const service: RoleSyncDiscordService = {
      assignRole: jest.fn(async () => 'assigned'),
      removeRole: jest.fn(async () => 'removed'),
    };

    const wrapped = wrapWithRoleSyncBackpressure(service, limiter);
    const result = await wrapped.assignRole('guild-1', 'user-1', 'role-1');

    expect(result).toBe('assigned');
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(service.assignRole).toHaveBeenCalledWith('guild-1', 'user-1', 'role-1');
    expect(recordSuccess).toHaveBeenCalledTimes(1);
    expect(recordBackpressure).not.toHaveBeenCalled();
  });

  it('records backpressure with a retry-after hint on a rate-limit failure', async () => {
    const { limiter, acquire, recordSuccess, recordBackpressure } = createSpyLimiter();
    const rateLimitError = Object.assign(new Error('rate limited'), { retryAfter: 1200 });
    const service: RoleSyncDiscordService = {
      assignRole: jest.fn(async () => {
        throw rateLimitError;
      }),
      removeRole: jest.fn(async () => 'removed'),
    };

    const wrapped = wrapWithRoleSyncBackpressure(service, limiter);

    await expect(wrapped.assignRole('g', 'u', 'r')).rejects.toBe(rateLimitError);
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(recordBackpressure).toHaveBeenCalledWith(1200);
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it('does not record backpressure on a non-rate-limit failure', async () => {
    const { limiter, acquire, recordSuccess, recordBackpressure } = createSpyLimiter();
    const permissionError = new Error('Bot lacks "Manage Roles" permission');
    const service: RoleSyncDiscordService = {
      assignRole: jest.fn(async () => 'assigned'),
      removeRole: jest.fn(async () => {
        throw permissionError;
      }),
    };

    const wrapped = wrapWithRoleSyncBackpressure(service, limiter);

    await expect(wrapped.removeRole('g', 'u', 'r')).rejects.toBe(permissionError);
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(recordBackpressure).not.toHaveBeenCalled();
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it('passes through removeRole arguments and result', async () => {
    const { limiter } = createSpyLimiter();
    const wrapped = wrapWithRoleSyncBackpressure(baseService, limiter);

    const result = await wrapped.removeRole('guild-9', 'user-9', 'role-9');

    expect(result).toBe('removed');
    expect(baseService.removeRole).toHaveBeenCalledWith('guild-9', 'user-9', 'role-9');
  });
});

describe('createRoleSyncRateLimiter', () => {
  const ENV_KEYS = [
    'RSI_ROLE_SYNC_MIN_INTERVAL_MS',
    'RSI_ROLE_SYNC_MAX_INTERVAL_MS',
    'RSI_ROLE_SYNC_BACKOFF_MULTIPLIER',
    'RSI_ROLE_SYNC_RECOVERY_MULTIPLIER',
    'RSI_ROLE_SYNC_MAX_COOLDOWN_MS',
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it('uses conservative defaults when no env overrides are set', () => {
    const limiter = createRoleSyncRateLimiter();
    expect(limiter.getLabel()).toBe('rsi-role-sync');
    expect(limiter.getStats().currentIntervalMs).toBe(250);
  });

  it('honors a valid min-interval override', () => {
    process.env.RSI_ROLE_SYNC_MIN_INTERVAL_MS = '500';
    const limiter = createRoleSyncRateLimiter();
    expect(limiter.getStats().currentIntervalMs).toBe(500);
  });

  it('ignores an invalid override and falls back to the default', () => {
    process.env.RSI_ROLE_SYNC_MIN_INTERVAL_MS = 'not-a-number';
    const limiter = createRoleSyncRateLimiter();
    expect(limiter.getStats().currentIntervalMs).toBe(250);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
