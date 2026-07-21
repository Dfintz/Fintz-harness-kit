import type { InvalidRequestWarningData, RateLimitData, REST } from 'discord.js';

import {
  describeInvalidRequestWarning,
  describeRateLimit,
  registerRestRateLimitObserver,
  type RateLimitObserverLogger,
} from '../restRateLimitObserver';

/** Representative non-global per-bucket rate-limit payload. */
function createRateLimitData(overrides: Partial<RateLimitData> = {}): RateLimitData {
  return {
    global: false,
    hash: 'abcd1234',
    limit: 5,
    majorParameter: '123456789012345678',
    method: 'POST',
    retryAfter: 1500,
    route: '/channels/:id/messages',
    scope: 'user',
    sublimitTimeout: 0,
    timeToReset: 2000,
    ...overrides,
  };
}

/**
 * Minimal REST stub capturing registered listeners so the wiring can be
 * exercised without constructing a real discord.js REST manager.
 */
function createFakeRest() {
  const listeners = new Map<string, (data: unknown) => void>();
  const on = jest.fn((event: string, listener: (data: unknown) => void) => {
    listeners.set(event, listener);
  });
  return {
    rest: { on } as unknown as Pick<REST, 'on'>,
    on,
    emit: (event: string, data: unknown) => listeners.get(event)?.(data),
  };
}

describe('restRateLimitObserver', () => {
  describe('describeRateLimit', () => {
    it('logs routine per-bucket limits at debug with the full structured context', () => {
      const entry = describeRateLimit(createRateLimitData());

      expect(entry.level).toBe('debug');
      expect(entry.message).toContain('queued and retried automatically');
      expect(entry.context).toEqual({
        scope: 'user',
        global: false,
        method: 'POST',
        route: '/channels/:id/messages',
        majorParameter: '123456789012345678',
        limit: 5,
        retryAfterMs: 1500,
        timeToResetMs: 2000,
        sublimitTimeoutMs: 0,
      });
    });

    it('escalates to warn when the global flag is set', () => {
      const entry = describeRateLimit(createRateLimitData({ global: true }));

      expect(entry.level).toBe('warn');
      expect(entry.message).toContain('global rate limit');
      expect(entry.context.global).toBe(true);
    });

    it('escalates to warn when the scope is global even if the flag is false', () => {
      const entry = describeRateLimit(createRateLimitData({ global: false, scope: 'global' }));

      expect(entry.level).toBe('warn');
      expect(entry.context.scope).toBe('global');
    });
  });

  describe('describeInvalidRequestWarning', () => {
    it('always warns and surfaces the ban-threshold counters', () => {
      const data: InvalidRequestWarningData = { count: 200, remainingTime: 60_000 };

      const entry = describeInvalidRequestWarning(data);

      expect(entry.level).toBe('warn');
      expect(entry.message).toContain('Cloudflare ban threshold');
      expect(entry.context).toEqual({ invalidRequestCount: 200, windowResetMs: 60_000 });
    });
  });

  describe('registerRestRateLimitObserver', () => {
    it('subscribes to both REST rate-limit events exactly once', () => {
      const fake = createFakeRest();

      registerRestRateLimitObserver(fake.rest);

      expect(fake.on).toHaveBeenCalledTimes(2);
      expect(fake.on).toHaveBeenCalledWith('rateLimited', expect.any(Function));
      expect(fake.on).toHaveBeenCalledWith('invalidRequestWarning', expect.any(Function));
    });

    it('routes a global rate-limit event to logger.warn with structured context', () => {
      const fake = createFakeRest();
      const warn = jest.fn();
      const debug = jest.fn();
      const log = { warn, debug } as unknown as RateLimitObserverLogger;

      registerRestRateLimitObserver(fake.rest, log);
      fake.emit('rateLimited', createRateLimitData({ global: true }));

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('global rate limit'),
        expect.objectContaining({ global: true, scope: 'user' })
      );
      expect(debug).not.toHaveBeenCalled();
    });

    it('routes a routine rate-limit event to logger.debug', () => {
      const fake = createFakeRest();
      const warn = jest.fn();
      const debug = jest.fn();
      const log = { warn, debug } as unknown as RateLimitObserverLogger;

      registerRestRateLimitObserver(fake.rest, log);
      fake.emit('rateLimited', createRateLimitData());

      expect(debug).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    });

    it('routes an invalid-request warning to logger.warn', () => {
      const fake = createFakeRest();
      const warn = jest.fn();
      const debug = jest.fn();
      const log = { warn, debug } as unknown as RateLimitObserverLogger;

      registerRestRateLimitObserver(fake.rest, log);
      fake.emit('invalidRequestWarning', { count: 500, remainingTime: 120_000 });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid-request warning'),
        expect.objectContaining({ invalidRequestCount: 500 })
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
