/**
 * Tests for BotIPCService — Redis Pub/Sub IPC for bot↔Express communication.
 * Wave 1.9 — Bot Architecture Hardening
 */

// Mock ioredis
const mockSubscribe = jest.fn().mockResolvedValue(undefined);
const mockPublish = jest.fn().mockResolvedValue(1);
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn();
const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    subscribe: mockSubscribe,
    publish: mockPublish,
    disconnect: mockDisconnect,
    unsubscribe: mockUnsubscribe,
    on: mockOn,
  }));
});

import { getRequestContext, requestContextStorage } from '../../utils/requestContext';
import { BotIPCService } from '../BotIPCService';

const wait = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

describe('BotIPCService', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    BotIPCService.resetInstance();
    jest.clearAllMocks();
    // Save and set env vars for Redis connection
    savedEnv.REDIS_HOST = process.env.REDIS_HOST;
    savedEnv.REDIS_PORT = process.env.REDIS_PORT;
    savedEnv.REDIS_TLS_ENABLED = process.env.REDIS_TLS_ENABLED;
    savedEnv.REDIS_TLS_VERIFY_CERTS = process.env.REDIS_TLS_VERIFY_CERTS;
    savedEnv.BOT_IPC_MAX_PENDING_REQUESTS = process.env.BOT_IPC_MAX_PENDING_REQUESTS;
    savedEnv.BOT_IPC_PUBLISH_MAX_RETRIES = process.env.BOT_IPC_PUBLISH_MAX_RETRIES;
    savedEnv.BOT_IPC_PUBLISH_RETRY_BASE_DELAY_MS = process.env.BOT_IPC_PUBLISH_RETRY_BASE_DELAY_MS;
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    delete process.env.REDIS_TLS_ENABLED;
    delete process.env.REDIS_TLS_VERIFY_CERTS;
    delete process.env.BOT_IPC_MAX_PENDING_REQUESTS;
    delete process.env.BOT_IPC_PUBLISH_MAX_RETRIES;
    delete process.env.BOT_IPC_PUBLISH_RETRY_BASE_DELAY_MS;
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  afterAll(() => {
    BotIPCService.resetInstance();
  });

  it('should be a singleton', () => {
    const instance1 = BotIPCService.getInstance();
    const instance2 = BotIPCService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should not be available before initialization', () => {
    const ipc = BotIPCService.getInstance();
    expect(ipc.isAvailable()).toBe(false);
  });

  it('should initialize successfully with Redis', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    expect(ipc.isAvailable()).toBe(true);
    expect(mockConnect).toHaveBeenCalledTimes(2); // pub + sub clients
    expect(mockSubscribe).toHaveBeenCalledWith(
      'bot:ipc:commands',
      'bot:ipc:events',
      'bot:ipc:responses'
    );
  });

  it('should not initialize twice', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();
    await ipc.initialize();

    // Connect should only be called twice (once per pub/sub client)
    expect(mockConnect).toHaveBeenCalledTimes(2);
  });

  it('should register and retrieve handlers', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    const handler = jest.fn().mockResolvedValue({
      correlationId: 'test',
      success: true,
      data: { result: 'ok' },
    });

    ipc.registerHandler('test:action', handler);

    // Verify the handler was registered (will be tested via message simulation)
    expect(ipc.isAvailable()).toBe(true);
  });

  it('should register event listeners', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    const callback = jest.fn();
    ipc.onEvent('test:event', callback);

    // Verify listener was registered (will be tested via message simulation)
    expect(ipc.isAvailable()).toBe(true);
  });

  it('should unsubscribe event listeners via returned function', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    const callback = jest.fn();
    const unsubscribe = ipc.onEvent('test:event', callback);

    // Simulate event via internal message handler
    const messageHandler = mockOn.mock.calls.find((c: string[]) => c[0] === 'message')?.[1] as
      | ((channel: string, message: string) => void)
      | undefined;

    const eventPayload = JSON.stringify({
      correlationId: 'evt-1',
      action: 'test:event',
      data: { key: 'value' },
      timestamp: Date.now(),
    });

    messageHandler?.('bot:ipc:events', eventPayload);
    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe and verify no further calls
    unsubscribe();
    callback.mockClear();
    messageHandler?.('bot:ipc:events', eventPayload);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should return null for requests when unavailable', async () => {
    const ipc = BotIPCService.getInstance();
    // Don't initialize

    const result = await ipc.request('test:action', { key: 'value' });
    expect(result).toBeNull();
  });

  it('should emit events when available', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    await ipc.emit('guild:memberJoined', { guildId: '123', userId: '456' });

    expect(mockPublish).toHaveBeenCalledWith(
      'bot:ipc:events',
      expect.stringContaining('"action":"guild:memberJoined"')
    );
  });

  it('should not emit events when unavailable', async () => {
    const ipc = BotIPCService.getInstance();
    // Don't initialize

    await ipc.emit('guild:memberJoined', { guildId: '123' });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('should send requests with correlation IDs', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    // Start the request (it will timeout since no response comes back)
    const requestPromise = ipc.request('test:action', { key: 'value' }, 100);

    expect(mockPublish).toHaveBeenCalledWith(
      'bot:ipc:commands',
      expect.stringContaining('"action":"test:action"')
    );

    // Wait for timeout
    const result = await requestPromise;
    expect(result).toBeDefined();
    expect(result?.success).toBe(false);
    expect(result?.error).toContain('timed out');
  });

  describe('distributed trace propagation (ARCH-02)', () => {
    /** Helper to grab the most recent published command payload. */
    const lastCommandPayload = (): { traceId?: string; correlationId: string } => {
      const call = mockPublish.mock.calls.findLast((c: unknown[]) => c[0] === 'bot:ipc:commands');
      return JSON.parse(call?.[1] as string) as { traceId?: string; correlationId: string };
    };

    it('stamps a generated traceId on an outbound request when no context is active', async () => {
      const ipc = BotIPCService.getInstance();
      await ipc.initialize();

      const requestPromise = ipc.request('test:action', { key: 'value' }, 100);
      const payload = lastCommandPayload();
      expect(payload.traceId).toMatch(/^trace-\d+-[0-9a-f]{8}$/);

      const result = await requestPromise;
      expect(result?.traceId).toBe(payload.traceId); // echoed on the synthesized timeout response
    });

    it('inherits the active request-context correlationId as the outbound traceId', async () => {
      const ipc = BotIPCService.getInstance();
      await ipc.initialize();

      await requestContextStorage.run(
        { requestId: 'req-1', correlationId: 'corr-abc-123', startTime: Date.now() },
        async () => {
          const requestPromise = ipc.request('test:action', {}, 50);
          expect(lastCommandPayload().traceId).toBe('corr-abc-123');
          await requestPromise;
        }
      );
    });

    it('stamps a traceId on emitted events', async () => {
      const ipc = BotIPCService.getInstance();
      await ipc.initialize();

      await ipc.emit('guild:memberJoined', { guildId: '123' });

      const eventCall = mockPublish.mock.calls.find((c: unknown[]) => c[0] === 'bot:ipc:events');
      const payload = JSON.parse(eventCall?.[1] as string) as { traceId?: string };
      expect(payload.traceId).toMatch(/^trace-\d+-[0-9a-f]{8}$/);
    });

    it('adopts the inbound traceId into the request context for the handler and echoes it', async () => {
      const ipc = BotIPCService.getInstance();
      await ipc.initialize();

      let observedTraceId: string | undefined;
      ipc.registerHandler('trace:probe', async () => {
        observedTraceId = getRequestContext()?.correlationId;
        return { correlationId: 'ignored', success: true, data: { ok: true } };
      });

      const messageHandler = mockOn.mock.calls.find((c: string[]) => c[0] === 'message')?.[1] as
        | ((channel: string, message: string) => void)
        | undefined;

      messageHandler?.(
        'bot:ipc:commands',
        JSON.stringify({
          correlationId: 'corr-1',
          traceId: 'trace-inbound-xyz',
          action: 'trace:probe',
          data: {},
          timestamp: Date.now(),
        })
      );

      await wait(10);

      // The handler ran inside the propagated trace context...
      expect(observedTraceId).toBe('trace-inbound-xyz');
      // ...and the response echoes the same traceId back to the caller.
      expect(mockPublish).toHaveBeenCalledWith(
        'bot:ipc:responses',
        expect.stringContaining('"traceId":"trace-inbound-xyz"')
      );
    });

    it('runs event listeners inside the propagated trace context', async () => {
      const ipc = BotIPCService.getInstance();
      await ipc.initialize();

      let observedTraceId: string | undefined;
      ipc.onEvent('trace:event', () => {
        observedTraceId = getRequestContext()?.correlationId;
      });

      const messageHandler = mockOn.mock.calls.find((c: string[]) => c[0] === 'message')?.[1] as
        | ((channel: string, message: string) => void)
        | undefined;

      messageHandler?.(
        'bot:ipc:events',
        JSON.stringify({
          correlationId: 'evt-1',
          traceId: 'trace-evt-abc',
          action: 'trace:event',
          data: {},
          timestamp: Date.now(),
        })
      );

      await wait(10);
      expect(observedTraceId).toBe('trace-evt-abc');
    });
  });

  it('should reject new requests with overload response when pending queue cap is reached', async () => {
    process.env.BOT_IPC_MAX_PENDING_REQUESTS = '1';
    BotIPCService.resetInstance();

    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    const firstRequest = ipc.request('test:first', { key: 'value' }, 200);
    await wait(10);

    const overloadResponse = await ipc.request('test:second', { key: 'value' }, 200);

    expect(overloadResponse).toEqual(
      expect.objectContaining({
        success: false,
        definitive: true,
      })
    );
    expect(overloadResponse?.error).toContain('IPC overloaded');

    const firstResult = await firstRequest;
    expect(firstResult?.success).toBe(false);
    expect(firstResult?.error).toContain('timed out');
  });

  it('should retry transient publish failures before succeeding', async () => {
    process.env.BOT_IPC_PUBLISH_MAX_RETRIES = '2';
    process.env.BOT_IPC_PUBLISH_RETRY_BASE_DELAY_MS = '1';
    BotIPCService.resetInstance();

    const transientError = Object.assign(new Error('connection is closed'), {
      code: 'ECONNRESET',
    });

    mockPublish.mockReset();
    mockPublish.mockRejectedValueOnce(transientError).mockResolvedValue(1);

    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    const requestPromise = ipc.request('test:retryable', { key: 'value' }, 500);
    await wait(20);

    const commandCall = mockPublish.mock.calls.find(
      (call: unknown[]) => call[0] === 'bot:ipc:commands'
    );
    expect(commandCall).toBeDefined();

    const commandPayload = JSON.parse(commandCall?.[1] as string) as { correlationId: string };
    const messageHandler = mockOn.mock.calls.find((c: string[]) => c[0] === 'message')?.[1] as
      | ((channel: string, message: string) => void)
      | undefined;

    messageHandler?.(
      'bot:ipc:responses',
      JSON.stringify({
        correlationId: commandPayload.correlationId,
        success: true,
        status: 'handled',
        definitive: true,
        data: { ok: true },
      })
    );

    const result = await requestPromise;
    expect(result?.success).toBe(true);

    const commandPublishes = mockPublish.mock.calls.filter(
      (call: unknown[]) => call[0] === 'bot:ipc:commands'
    );
    expect(commandPublishes.length).toBe(2);
  });

  it('should prefer definitive responses over non-definitive shard misses', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    const requestPromise = ipc.request(
      'guild:fetchMember',
      { guildId: 'guild-1', discordUserId: 'user-1' },
      {
        timeoutMs: 1_000,
        requireDefinitiveResponse: true,
        definitiveWaitMs: 200,
        routing: { scope: 'guild', guildId: 'guild-1' },
      }
    );

    const commandCall = mockPublish.mock.calls.find(
      (call: unknown[]) => call[0] === 'bot:ipc:commands'
    );
    const commandPayload = JSON.parse(commandCall?.[1] as string) as { correlationId: string };

    const messageHandler = mockOn.mock.calls.find((c: string[]) => c[0] === 'message')?.[1] as
      | ((channel: string, message: string) => void)
      | undefined;

    messageHandler?.(
      'bot:ipc:responses',
      JSON.stringify({
        correlationId: commandPayload.correlationId,
        success: true,
        status: 'not_handled',
        definitive: false,
        data: { found: false, reason: 'guild_not_cached' },
      })
    );

    await wait(10);

    messageHandler?.(
      'bot:ipc:responses',
      JSON.stringify({
        correlationId: commandPayload.correlationId,
        success: true,
        status: 'handled',
        definitive: true,
        data: { found: true, isInGuild: true, displayName: 'Pilot' },
      })
    );

    const result = await requestPromise;
    expect(result?.success).toBe(true);
    expect(result?.status).toBe('handled');
    expect(result?.definitive).toBe(true);
    expect(result?.data).toEqual(
      expect.objectContaining({
        found: true,
        isInGuild: true,
      })
    );
  });

  it('should resolve with non-definitive fallback when definitive response is absent', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    const startedAt = Date.now();
    const requestPromise = ipc.request(
      'guild:fetchMember',
      { guildId: 'guild-1', discordUserId: 'user-1' },
      {
        timeoutMs: 1_000,
        requireDefinitiveResponse: true,
        definitiveWaitMs: 60,
        routing: { scope: 'guild', guildId: 'guild-1' },
      }
    );

    const commandCall = mockPublish.mock.calls.find(
      (call: unknown[]) => call[0] === 'bot:ipc:commands'
    );
    const commandPayload = JSON.parse(commandCall?.[1] as string) as { correlationId: string };
    const messageHandler = mockOn.mock.calls.find((c: string[]) => c[0] === 'message')?.[1] as
      | ((channel: string, message: string) => void)
      | undefined;

    messageHandler?.(
      'bot:ipc:responses',
      JSON.stringify({
        correlationId: commandPayload.correlationId,
        success: true,
        status: 'not_handled',
        definitive: false,
        data: { found: false, reason: 'guild_not_cached' },
      })
    );

    const result = await requestPromise;
    const durationMs = Date.now() - startedAt;

    expect(durationMs).toBeLessThan(600);
    expect(result?.success).toBe(true);
    expect(result?.status).toBe('not_handled');
    expect(result?.definitive).toBe(false);
  });

  it('should publish non-definitive not_handled response when command has no handler', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    const messageHandler = mockOn.mock.calls.find((c: string[]) => c[0] === 'message')?.[1] as
      | ((channel: string, message: string) => void)
      | undefined;

    messageHandler?.(
      'bot:ipc:commands',
      JSON.stringify({
        correlationId: 'corr-no-handler',
        action: 'unknown:action',
        data: {},
        timestamp: Date.now(),
      })
    );

    await wait(10);

    expect(mockPublish).toHaveBeenCalledWith(
      'bot:ipc:responses',
      expect.stringContaining('"status":"not_handled"')
    );
    expect(mockPublish).toHaveBeenCalledWith(
      'bot:ipc:responses',
      expect.stringContaining('"definitive":false')
    );
  });

  it('should shut down gracefully', async () => {
    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    // Clear counts before shutdown
    mockUnsubscribe.mockClear();
    mockDisconnect.mockClear();

    await ipc.shutdown();

    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalledTimes(2); // pub + sub
    expect(ipc.isAvailable()).toBe(false);
  });

  it('should handle Redis connection failure gracefully', async () => {
    // Override connect to throw
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

    const ipc = BotIPCService.getInstance();
    await ipc.initialize();

    // Should fall back to no-op
    expect(ipc.isAvailable()).toBe(false);
  });

  it('should reset singleton correctly', () => {
    const instance1 = BotIPCService.getInstance();
    BotIPCService.resetInstance();
    const instance2 = BotIPCService.getInstance();

    expect(instance1).not.toBe(instance2);
  });

  describe('TLS configuration', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');

    it('should pass TLS options to Redis when REDIS_TLS_ENABLED is true', async () => {
      process.env.REDIS_TLS_ENABLED = 'true';

      const ipc = BotIPCService.getInstance();
      await ipc.initialize();

      expect(Redis).toHaveBeenCalledTimes(2); // pub + sub
      const firstCallOptions = Redis.mock.calls[0][0];
      expect(firstCallOptions.tls).toEqual({ rejectUnauthorized: true });
    });

    it('should respect REDIS_TLS_VERIFY_CERTS=false', async () => {
      process.env.REDIS_TLS_ENABLED = 'true';
      process.env.REDIS_TLS_VERIFY_CERTS = 'false';

      const ipc = BotIPCService.getInstance();
      await ipc.initialize();

      const firstCallOptions = Redis.mock.calls[0][0];
      expect(firstCallOptions.tls).toEqual({ rejectUnauthorized: false });
    });

    it('should not set TLS options when REDIS_TLS_ENABLED is not set', async () => {
      delete process.env.REDIS_TLS_ENABLED;

      const ipc = BotIPCService.getInstance();
      await ipc.initialize();

      const firstCallOptions = Redis.mock.calls[0][0];
      expect(firstCallOptions.tls).toBeUndefined();
    });
  });
});
