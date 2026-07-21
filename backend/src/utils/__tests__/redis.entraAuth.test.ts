interface MockLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

interface LoadedRedisModule {
  attachRedisErrorObserver: (
    client: { on: (event: string, handler: (error: Error) => unknown) => unknown },
    clientLabel: string,
    onWrongPass?: () => void
  ) => void;
  sanitizeRedisErrorForLogging: (error: unknown) => Record<string, unknown>;
  setupEntraTokenRefreshForClient: (
    client: {
      status: string;
      options: { username?: string; password?: string };
      on: (event: string, handler: (error: Error) => unknown) => unknown;
      call: jest.Mock;
    },
    clientLabel: string
  ) => Promise<{ stop: () => void; refreshNow: () => Promise<void> } | null>;
}

interface RedisTestContext {
  redisModule: LoadedRedisModule;
  mockGetToken: jest.Mock;
  mockLogger: MockLogger;
}

const ORIGINAL_ENV = process.env;

async function loadRedisModuleForAuthTests(): Promise<RedisTestContext> {
  jest.resetModules();

  let tokenCounter = 0;

  // Keep singleton Redis client initialization in key mode to avoid background Entra timers.
  process.env = {
    ...ORIGINAL_ENV,
    REDIS_AUTH_MODE: 'key',
    REDIS_AUTH_OBJECT_ID: 'test-managed-identity-object-id',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
  };

  const mockGetToken = jest.fn().mockImplementation(async () => ({
    token: `eyJ.token.segment.${++tokenCounter}.signature.payload.segment`,
    expiresOnTimestamp: Date.now() + 60 * 60 * 1000,
  }));

  const mockLogger: MockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  jest.doMock('@azure/identity', () => ({
    DefaultAzureCredential: jest.fn().mockImplementation(() => ({
      getToken: mockGetToken,
    })),
  }));

  jest.doMock('ioredis', () => {
    class MockCluster {
      options = {};
      on = jest.fn();
      nodes = jest.fn().mockReturnValue([]);
      disconnect = jest.fn();
      quit = jest.fn().mockResolvedValue(undefined);
    }

    const RedisCtor = jest.fn().mockImplementation(() => ({
      options: {},
      status: 'ready',
      on: jest.fn(),
      call: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      nodes: jest.fn().mockReturnValue([]),
    }));

    return {
      __esModule: true,
      default: RedisCtor,
      Cluster: MockCluster,
    };
  });

  jest.doMock('../logger', () => ({
    logger: mockLogger,
  }));

  jest.doMock('../../config/applicationInsights', () => ({
    trackMetric: jest.fn(),
  }));

  const redisModule = (await import('../redis')) as unknown as LoadedRedisModule;

  return {
    redisModule,
    mockGetToken,
    mockLogger,
  };
}

describe('redis Entra auth helpers', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.clearAllMocks();
    jest.resetModules();
    jest.dontMock('@azure/identity');
    jest.dontMock('ioredis');
    jest.dontMock('../logger');
    jest.dontMock('../../config/applicationInsights');
  });

  it('redacts AUTH args and token-like values in Redis errors', async () => {
    const { redisModule } = await loadRedisModuleForAuthTests();

    const rawError = {
      name: 'ReplyError',
      message: 'WRONGPASS invalid username-password pair',
      command: {
        name: 'auth',
        args: [
          'test-managed-identity-object-id',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature.segment',
        ],
      },
      stack:
        'ReplyError: WRONGPASS with eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature.segment',
    };

    const sanitized = redisModule.sanitizeRedisErrorForLogging(rawError);

    expect(sanitized.command).toEqual({
      name: 'AUTH',
      argc: 2,
      args: ['[REDACTED_USERNAME]', '[REDACTED_SECRET]'],
    });
    expect(JSON.stringify(sanitized)).not.toContain(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature.segment'
    );
  });

  it('attaches Redis error observer and triggers WRONGPASS recovery callback', async () => {
    const { redisModule, mockLogger } = await loadRedisModuleForAuthTests();

    process.env.REDIS_AUTH_MODE = 'entra';

    const listeners = new Map<string, (error: Error) => unknown>();
    const fakeClient = {
      on: jest.fn((event: string, handler: (error: Error) => unknown) => {
        listeners.set(event, handler);
        return fakeClient;
      }),
    };

    const onWrongPass = jest.fn();

    redisModule.attachRedisErrorObserver(fakeClient, 'RedisTestClient', onWrongPass);

    const errorHandler = listeners.get('error');
    expect(errorHandler).toBeDefined();

    const wrongPassError = Object.assign(
      new Error('WRONGPASS invalid username-password pair or user is disabled'),
      {
        command: {
          name: 'AUTH',
          args: [
            'test-managed-identity-object-id',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature.segment',
          ],
        },
      }
    );

    errorHandler?.(wrongPassError);

    expect(onWrongPass).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'RedisTestClient Redis client error',
      expect.objectContaining({
        command: {
          name: 'AUTH',
          argc: 2,
          args: ['[REDACTED_USERNAME]', '[REDACTED_SECRET]'],
        },
      })
    );
  });

  it('refreshes Entra credentials for reconnect-safe Redis auth', async () => {
    const { redisModule, mockGetToken } = await loadRedisModuleForAuthTests();

    process.env.REDIS_AUTH_MODE = 'entra';

    const fakeClient = {
      status: 'ready',
      options: {},
      on: jest.fn(),
      call: jest.fn().mockResolvedValue('OK'),
    };

    const refreshHandle = await redisModule.setupEntraTokenRefreshForClient(
      fakeClient,
      'RedisRefreshClient'
    );

    expect(refreshHandle).not.toBeNull();
    expect(fakeClient.options).toMatchObject({
      username: 'test-managed-identity-object-id',
    });

    const firstAuthToken = fakeClient.call.mock.calls[0]?.[2] as string;
    expect(firstAuthToken).toBeTruthy();

    await refreshHandle?.refreshNow();

    const secondAuthToken = fakeClient.call.mock.calls.at(-1)?.[2] as string;
    expect(secondAuthToken).toBeTruthy();
    expect(secondAuthToken).not.toBe(firstAuthToken);

    expect(mockGetToken).toHaveBeenCalledTimes(2);
    refreshHandle?.stop();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
