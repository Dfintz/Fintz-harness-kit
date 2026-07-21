interface MockRedisLike {
  on: jest.Mock;
  smembers: jest.Mock;
  del: jest.Mock;
  srem: jest.Mock;
  scard: jest.Mock;
}

interface RedisModuleContext {
  cache: {
    delOrgCacheKeys: (organizationId: string, keyPrefixes?: string[]) => Promise<number>;
  };
  redisClient: {
    isEnabled: boolean;
    isConnected: boolean;
    client: MockRedisLike | null;
  };
  mockRedisClient: MockRedisLike;
  mockTrackMetric: jest.Mock;
}

const ORIGINAL_ENV = process.env;

async function loadRedisModuleWithTelemetry(
  telemetryEnabled: boolean
): Promise<RedisModuleContext> {
  jest.resetModules();

  process.env = {
    ...ORIGINAL_ENV,
    REDIS_ORG_REGISTRY_TELEMETRY_ENABLED: telemetryEnabled ? 'true' : 'false',
  };

  const mockTrackMetric: jest.Mock = jest.fn();

  const mockRedisClient: MockRedisLike = {
    on: jest.fn(),
    smembers: jest.fn(),
    del: jest.fn(),
    srem: jest.fn(),
    scard: jest.fn(),
  };

  jest.doMock('ioredis', () => {
    const RedisCtor = jest.fn().mockImplementation(() => mockRedisClient);
    const ClusterCtor = jest.fn().mockImplementation(() => mockRedisClient);

    return {
      __esModule: true,
      default: RedisCtor,
      Cluster: ClusterCtor,
    };
  });

  jest.doMock('../../config/applicationInsights', () => ({
    trackMetric: mockTrackMetric,
  }));

  jest.doMock('../logger', () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  }));

  const redisModule = await import('../redis');

  const redisClient = redisModule.redisClient as unknown as {
    isEnabled: boolean;
    isConnected: boolean;
    client: MockRedisLike | null;
  };

  redisClient.isEnabled = true;
  redisClient.isConnected = true;
  redisClient.client = mockRedisClient;

  return {
    cache: redisModule.cache,
    redisClient,
    mockRedisClient,
    mockTrackMetric,
  };
}

describe('redis org registry telemetry', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.clearAllMocks();
    jest.resetModules();
    jest.dontMock('ioredis');
    jest.dontMock('../../config/applicationInsights');
    jest.dontMock('../logger');
  });

  it('emits deletion batch and registry size metrics when telemetry is enabled', async () => {
    const { cache, mockRedisClient, mockTrackMetric } = await loadRedisModuleWithTelemetry(true);

    const trackedKeys = Array.from({ length: 501 }, (_, idx) => `org:org-1:activity:key:${idx}`);

    mockRedisClient.smembers.mockResolvedValue(trackedKeys);
    mockRedisClient.del.mockImplementation(async (...keys: string[]) => keys.length);
    mockRedisClient.srem.mockResolvedValue(1);
    mockRedisClient.scard.mockResolvedValue(0);

    const deleted = await cache.delOrgCacheKeys('org-1', ['org:org-1:activity:']);

    expect(deleted).toBe(501);
    expect(mockTrackMetric).toHaveBeenCalledWith(
      'cache.redis.org_registry.deletion_batch_count',
      2
    );
    expect(mockTrackMetric).toHaveBeenCalledWith(
      'cache.redis.org_registry.deletion_candidate_count',
      501
    );
    expect(mockTrackMetric).toHaveBeenCalledWith(
      'cache.redis.org_registry.deletion_batch_size',
      500
    );
    expect(mockTrackMetric).toHaveBeenCalledWith('cache.redis.org_registry.deletion_batch_size', 1);
    expect(mockTrackMetric).toHaveBeenCalledWith(
      'cache.redis.org_registry.deletion_deleted_count',
      501
    );
    expect(mockTrackMetric).toHaveBeenCalledWith('cache.redis.org_registry.size', 0);
  });

  it('does not emit telemetry metrics when telemetry is disabled', async () => {
    const { cache, mockRedisClient, mockTrackMetric } = await loadRedisModuleWithTelemetry(false);

    mockRedisClient.smembers.mockResolvedValue(['org:org-2:trade:key:1']);
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.srem.mockResolvedValue(1);
    mockRedisClient.scard.mockResolvedValue(0);

    await cache.delOrgCacheKeys('org-2', ['org:org-2:trade:']);

    expect(mockTrackMetric).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
