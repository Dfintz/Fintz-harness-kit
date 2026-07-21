import {
  CacheBackend,
  DistributedCacheService,
  createDistributedCache,
} from '../caching/DistributedCacheService';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn(),
    ttl: jest.fn(),
    flushAll: jest.fn(),
  },
  redisClient: {
    getStatus: jest.fn().mockReturnValue({ enabled: false, connected: false }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const redisMock = require('../../utils/redis') as {
  cache: Record<string, jest.Mock>;
  redisClient: { getStatus: jest.Mock };
};

describe('DistributedCacheService', () => {
  let cache: DistributedCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisMock.redisClient.getStatus.mockReturnValue({ enabled: false, connected: false });
    cache = new DistributedCacheService({
      backend: CacheBackend.MEMORY,
      defaultTTL: 300,
      keyPrefix: 'test',
    });
  });

  afterEach(async () => {
    await cache.close();
  });

  // --- constructor ---

  describe('constructor', () => {
    it('should initialize with memory backend', () => {
      const c = new DistributedCacheService({
        backend: CacheBackend.MEMORY,
        defaultTTL: 60,
      });
      expect(c).toBeInstanceOf(DistributedCacheService);
      c.close();
    });

    it('should initialize with prefix', () => {
      const c = new DistributedCacheService({
        backend: CacheBackend.MEMORY,
        defaultTTL: 60,
        keyPrefix: 'myprefix',
      });
      expect(c).toBeInstanceOf(DistributedCacheService);
      c.close();
    });
  });

  // --- get / set ---

  describe('get and set', () => {
    it('should return null for missing key', async () => {
      const result = await cache.get('missing');
      expect(result).toBeNull();
    });

    it('should set and get a value', async () => {
      await cache.set('key1', { data: 'hello' });
      const result = await cache.get<{ data: string }>('key1');
      expect(result).toEqual({ data: 'hello' });
    });

    it('should set with custom TTL', async () => {
      const success = await cache.set('key2', 'value', 10);
      expect(success).toBe(true);
    });

    it('should track hit/miss stats', async () => {
      await cache.get('nonexistent'); // miss
      await cache.set('exists', 'val');
      await cache.get('exists'); // hit

      const stats = await cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  // --- del ---

  describe('del', () => {
    it('should delete a single key', async () => {
      await cache.set('delme', 'value');
      const deleted = await cache.del('delme');
      expect(deleted).toBe(true);
      const result = await cache.get('delme');
      expect(result).toBeNull();
    });

    it('should delete multiple keys', async () => {
      await cache.set('k1', 'v1');
      await cache.set('k2', 'v2');
      const deleted = await cache.del(['k1', 'k2']);
      expect(deleted).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const deleted = await cache.del('does-not-exist');
      expect(deleted).toBe(false);
    });
  });

  // --- delPattern ---

  describe('delPattern', () => {
    it('should delete keys matching a pattern (memory)', async () => {
      await cache.set('user:1', 'a');
      await cache.set('user:2', 'b');
      await cache.set('post:1', 'c');

      const count = await cache.delPattern('user:*');
      expect(count).toBe(2);

      const remaining = await cache.get('post:1');
      expect(remaining).toBe('c');
    });

    it('should return 0 when no keys match', async () => {
      const count = await cache.delPattern('nothing:*');
      expect(count).toBe(0);
    });
  });

  // --- exists ---

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await cache.set('key', 'val');
      const result = await cache.exists('key');
      expect(result).toBe(true);
    });

    it('should return false for missing key', async () => {
      const result = await cache.exists('nonexistent');
      expect(result).toBe(false);
    });
  });

  // --- keys ---

  describe('keys', () => {
    it('should list all keys (memory mode)', async () => {
      await cache.set('a', 1);
      await cache.set('b', 2);

      const keys = await cache.keys();
      expect(keys).toHaveLength(2);
    });

    it('should return empty array when no keys', async () => {
      const keys = await cache.keys();
      expect(keys).toHaveLength(0);
    });
  });

  // --- flushAll ---

  describe('flushAll', () => {
    it('should flush all keys (memory mode)', async () => {
      await cache.set('x', 1);
      await cache.set('y', 2);

      const result = await cache.flushAll();
      expect(result).toBe(true);

      const keys = await cache.keys();
      expect(keys).toHaveLength(0);
    });
  });

  // --- getStats ---

  describe('getStats', () => {
    it('should return stats with correct backend', async () => {
      const stats = await cache.getStats();
      expect(stats.backend).toBe(CacheBackend.MEMORY);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.keys).toBe(0);
    });

    it('should include ksize/vsize for memory backend', async () => {
      await cache.set('key', 'value');
      const stats = await cache.getStats();
      expect(stats.ksize).toBeDefined();
      expect(stats.vsize).toBeDefined();
    });
  });

  // --- ttl ---

  describe('ttl', () => {
    it('should return -1 for memory backend', async () => {
      await cache.set('key', 'val');
      const ttl = await cache.ttl('key');
      expect(ttl).toBe(-1);
    });
  });

  // --- close ---

  describe('close', () => {
    it('should close without error', async () => {
      await cache.close();
    });

    it('should be idempotent', async () => {
      await cache.close();
      await cache.close();
    });
  });

  // --- Redis backend ---

  describe('redis backend', () => {
    let redisCache: DistributedCacheService;

    beforeEach(() => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: true, connected: true });
      redisCache = new DistributedCacheService({
        backend: CacheBackend.REDIS,
        defaultTTL: 300,
        keyPrefix: 'test',
      });
    });

    afterEach(async () => {
      await redisCache.close();
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: false, connected: false });
    });

    it('should use Redis get when connected', async () => {
      redisMock.cache.get.mockResolvedValue({ data: 'from-redis' });

      const result = await redisCache.get('key');
      expect(result).toEqual({ data: 'from-redis' });
      expect(redisMock.cache.get).toHaveBeenCalledWith('test:key');
    });

    it('should track miss when Redis returns null', async () => {
      redisMock.cache.get.mockResolvedValue(null);

      const result = await redisCache.get('miss');
      expect(result).toBeNull();
    });

    it('should use Redis set', async () => {
      redisMock.cache.set.mockResolvedValue(true);

      const result = await redisCache.set('key', 'value', 60);
      expect(result).toBe(true);
      expect(redisMock.cache.set).toHaveBeenCalledWith('test:key', 'value', 60);
    });

    it('should use Redis del', async () => {
      redisMock.cache.del.mockResolvedValue(true);

      const result = await redisCache.del('key');
      expect(result).toBe(true);
      expect(redisMock.cache.del).toHaveBeenCalledWith(['test:key']);
    });

    it('should use Redis delPattern', async () => {
      redisMock.cache.delPattern.mockResolvedValue(5);

      const count = await redisCache.delPattern('user:*');
      expect(count).toBe(5);
      expect(redisMock.cache.delPattern).toHaveBeenCalledWith('test:user:*');
    });

    it('should use Redis exists', async () => {
      redisMock.cache.exists.mockResolvedValue(true);

      const result = await redisCache.exists('key');
      expect(result).toBe(true);
      expect(redisMock.cache.exists).toHaveBeenCalledWith('test:key');
    });

    it('should use Redis keys', async () => {
      redisMock.cache.keys.mockResolvedValue(['test:a', 'test:b']);

      const keys = await redisCache.keys();
      expect(keys).toEqual(['a', 'b']);
    });

    it('should use Redis ttl', async () => {
      redisMock.cache.ttl.mockResolvedValue(120);

      const ttl = await redisCache.ttl('key');
      expect(ttl).toBe(120);
      expect(redisMock.cache.ttl).toHaveBeenCalledWith('test:key');
    });

    it('should fallback to memory when Redis is unavailable', async () => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: false, connected: false });

      await redisCache.set('fallback', 'value');
      const result = await redisCache.get('fallback');
      expect(result).toBe('value');
      expect(redisMock.cache.get).not.toHaveBeenCalled();
    });
  });

  // --- Hybrid backend ---

  describe('hybrid backend', () => {
    it('should use Redis when available', async () => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: true, connected: true });
      redisMock.cache.get.mockResolvedValue('hybrid-redis');

      const hybrid = new DistributedCacheService({
        backend: CacheBackend.HYBRID,
        defaultTTL: 300,
      });

      const result = await hybrid.get('key');
      expect(result).toBe('hybrid-redis');
      await hybrid.close();
    });

    it('should fallback to memory when Redis unavailable', async () => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: false, connected: false });

      const hybrid = new DistributedCacheService({
        backend: CacheBackend.HYBRID,
        defaultTTL: 300,
      });

      await hybrid.set('key', 'memory-val');
      const result = await hybrid.get('key');
      expect(result).toBe('memory-val');
      await hybrid.close();
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should return null on get error', async () => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: true, connected: true });
      redisMock.cache.get.mockRejectedValue(new Error('Redis down'));

      const c = new DistributedCacheService({
        backend: CacheBackend.REDIS,
        defaultTTL: 60,
      });

      const result = await c.get('key');
      expect(result).toBeNull();
      await c.close();
    });

    it('should return false on set error', async () => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: true, connected: true });
      redisMock.cache.set.mockRejectedValue(new Error('Redis down'));

      const c = new DistributedCacheService({
        backend: CacheBackend.REDIS,
        defaultTTL: 60,
      });

      const result = await c.set('key', 'val');
      expect(result).toBe(false);
      await c.close();
    });

    it('should return false on del error', async () => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: true, connected: true });
      redisMock.cache.del.mockRejectedValue(new Error('Redis down'));

      const c = new DistributedCacheService({
        backend: CacheBackend.REDIS,
        defaultTTL: 60,
      });

      const result = await c.del('key');
      expect(result).toBe(false);
      await c.close();
    });
  });

  // --- createDistributedCache factory ---

  describe('createDistributedCache', () => {
    it('should create with defaults (memory when Redis unavailable)', () => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: false, connected: false });

      const c = createDistributedCache();
      expect(c).toBeInstanceOf(DistributedCacheService);
      c.close();
    });

    it('should auto-select Redis when available', () => {
      redisMock.redisClient.getStatus.mockReturnValue({ enabled: true, connected: true });

      const c = createDistributedCache();
      expect(c).toBeInstanceOf(DistributedCacheService);
      c.close();
    });

    it('should respect explicit backend config', () => {
      const c = createDistributedCache({
        backend: CacheBackend.MEMORY,
        defaultTTL: 120,
        keyPrefix: 'custom',
      });
      expect(c).toBeInstanceOf(DistributedCacheService);
      c.close();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

