import { EnhancedCacheService } from '../../services/caching/EnhancedCacheService';

describe('EnhancedCacheService', () => {
  let cacheService: EnhancedCacheService;

  beforeEach(() => {
    cacheService = new EnhancedCacheService({
      stdTTL: 60,
      checkperiod: 10,
    });
  });

  afterEach(() => {
    cacheService.shutdown();
    cacheService.flushAll();
  });

  describe('get and set', () => {
    it('should store and retrieve a value', () => {
      cacheService.set('test:key', { data: 'value' });
      const result = cacheService.get('test:key');
      expect(result).toEqual({ data: 'value' });
    });

    it('should return undefined for non-existent keys', () => {
      const result = cacheService.get('non:existent');
      expect(result).toBeUndefined();
    });

    it('should store different types of values', () => {
      cacheService.set('string:key', 'test');
      cacheService.set('number:key', 42);
      cacheService.set('array:key', [1, 2, 3]);
      cacheService.set('object:key', { foo: 'bar' });

      expect(cacheService.get('string:key')).toBe('test');
      expect(cacheService.get('number:key')).toBe(42);
      expect(cacheService.get('array:key')).toEqual([1, 2, 3]);
      expect(cacheService.get('object:key')).toEqual({ foo: 'bar' });
    });

    it('should support tags when setting values', () => {
      cacheService.set('user:1', { id: 1 }, { tags: ['user', 'active'] });
      cacheService.set('user:2', { id: 2 }, { tags: ['user', 'inactive'] });

      const tags = cacheService.getTags();
      expect(tags).toContain('user');
      expect(tags).toContain('active');
      expect(tags).toContain('inactive');
    });

    it('should support custom TTL option', () => {
      // Just verify TTL is set correctly
      cacheService.set('expire:key', 'value', { ttl: 60 });

      // Should exist immediately
      expect(cacheService.get('expire:key')).toBe('value');

      // TTL should be set
      const ttl = cacheService.ttl('expire:key');
      expect(ttl).toBeGreaterThan(55);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });

  describe('del', () => {
    it('should delete a cached value', () => {
      cacheService.set('test:key', 'value');
      expect(cacheService.get('test:key')).toBe('value');

      cacheService.del('test:key');
      expect(cacheService.get('test:key')).toBeUndefined();
    });

    it('should return number of deleted keys', () => {
      cacheService.set('test:key', 'value');
      const deleted = cacheService.del('test:key');
      expect(deleted).toBe(1);
    });
  });

  describe('delByTag', () => {
    it('should delete all keys with a specific tag', () => {
      cacheService.set('user:1', { id: 1 }, { tags: ['user'] });
      cacheService.set('user:2', { id: 2 }, { tags: ['user'] });
      cacheService.set('event:1', { id: 1 }, { tags: ['event'] });

      const deleted = cacheService.delByTag('user');

      expect(deleted).toBe(2);
      expect(cacheService.get('user:1')).toBeUndefined();
      expect(cacheService.get('user:2')).toBeUndefined();
      expect(cacheService.get('event:1')).toEqual({ id: 1 });
    });

    it('should return 0 for non-existent tags', () => {
      cacheService.set('user:1', { id: 1 }, { tags: ['user'] });
      const deleted = cacheService.delByTag('nonexistent');
      expect(deleted).toBe(0);
    });
  });

  describe('delByPattern', () => {
    it('should delete all keys matching a pattern', () => {
      cacheService.set('user:1', { id: 1 });
      cacheService.set('user:2', { id: 2 });
      cacheService.set('user:3', { id: 3 });
      cacheService.set('event:1', { id: 1 });

      const deleted = cacheService.delByPattern('user:*');

      expect(deleted).toBe(3);
      expect(cacheService.get('user:1')).toBeUndefined();
      expect(cacheService.get('event:1')).toEqual({ id: 1 });
    });
  });

  describe('wrap', () => {
    it('should execute query on cache miss', async () => {
      const queryFn = jest.fn(async () => ({ data: 'test' }));

      const result = await cacheService.wrap('test:key', queryFn);

      expect(result).toEqual({ data: 'test' });
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should return cached value on cache hit', async () => {
      const queryFn = jest.fn(async () => ({ data: 'test' }));

      // First call - cache miss
      await cacheService.wrap('test:key', queryFn);

      // Second call - cache hit
      const result = await cacheService.wrap('test:key', queryFn);

      expect(result).toEqual({ data: 'test' });
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should support tags in wrap', async () => {
      const queryFn = jest.fn(async () => ({ data: 'test' }));

      await cacheService.wrap('test:key', queryFn, { tags: ['test-tag'] });

      expect(cacheService.getKeysByTag('test-tag')).toContain('test:key');
    });
  });

  describe('getMetrics', () => {
    it('should return cache metrics', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.get('key1'); // Hit
      cacheService.get('non:existent'); // Miss

      const metrics = cacheService.getMetrics();

      expect(metrics.keys).toBe(2);
      expect(metrics.hits).toBeGreaterThan(0);
      expect(metrics.misses).toBeGreaterThan(0);
      expect(metrics.hitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.hitRate).toBeLessThanOrEqual(100);
    });

    it('should track average latencies', () => {
      // Perform some cache operations
      cacheService.set('key1', 'value1');
      cacheService.get('key1'); // Hit
      cacheService.get('non:existent'); // Miss

      const metrics = cacheService.getMetrics();

      expect(metrics.avgHitLatency).toBeDefined();
      expect(metrics.avgMissLatency).toBeDefined();
    });
  });

  describe('getKeyInfo', () => {
    it('should return key information', () => {
      cacheService.set('test:key', 'value', { tags: ['test'] });

      const info = cacheService.getKeyInfo('test:key');

      expect(info.exists).toBe(true);
      expect(info.ttl).toBeGreaterThan(0);
      expect(info.metadata?.tags).toContain('test');
      expect(info.metadata?.createdAt).toBeDefined();
    });

    it('should return exists: false for missing keys', () => {
      const info = cacheService.getKeyInfo('non:existent');

      expect(info.exists).toBe(false);
      expect(info.ttl).toBeUndefined();
      expect(info.metadata).toBeUndefined();
    });
  });

  describe('getKeysByTag', () => {
    it('should return all keys with a specific tag', () => {
      cacheService.set('user:1', { id: 1 }, { tags: ['user', 'active'] });
      cacheService.set('user:2', { id: 2 }, { tags: ['user'] });
      cacheService.set('event:1', { id: 1 }, { tags: ['event'] });

      const userKeys = cacheService.getKeysByTag('user');
      const activeKeys = cacheService.getKeysByTag('active');

      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('user:1');
      expect(userKeys).toContain('user:2');
      expect(activeKeys).toHaveLength(1);
      expect(activeKeys).toContain('user:1');
    });
  });

  describe('cache warming', () => {
    it('should register warming configuration', () => {
      cacheService.registerWarming({
        key: 'warm:key',
        loader: async () => ({ data: 'warmed' }),
        priority: 'high',
        schedule: 'startup',
      });

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should warm a specific key', async () => {
      cacheService.registerWarming({
        key: 'warm:key',
        loader: async () => ({ data: 'warmed' }),
        priority: 'high',
        schedule: 'on-demand',
      });

      const result = await cacheService.warmKey('warm:key');

      expect(result).toBe(true);
      expect(cacheService.get('warm:key')).toEqual({ data: 'warmed' });
    });

    it('should return false for unregistered warming key', async () => {
      const result = await cacheService.warmKey('unregistered:key');
      expect(result).toBe(false);
    });

    it('should warm all startup keys', async () => {
      cacheService.registerWarming({
        key: 'startup:1',
        loader: async () => ({ id: 1 }),
        priority: 'high',
        schedule: 'startup',
      });
      cacheService.registerWarming({
        key: 'startup:2',
        loader: async () => ({ id: 2 }),
        priority: 'medium',
        schedule: 'startup',
      });
      cacheService.registerWarming({
        key: 'on-demand:1',
        loader: async () => ({ id: 3 }),
        priority: 'low',
        schedule: 'on-demand',
      });

      await cacheService.warmStartupKeys();

      expect(cacheService.get('startup:1')).toEqual({ id: 1 });
      expect(cacheService.get('startup:2')).toEqual({ id: 2 });
      expect(cacheService.get('on-demand:1')).toBeUndefined();
    });
  });

  describe('has and ttl', () => {
    it('should check if key exists', () => {
      cacheService.set('exists:key', 'value');

      expect(cacheService.has('exists:key')).toBe(true);
      expect(cacheService.has('nonexistent:key')).toBe(false);
    });

    it('should return remaining TTL', () => {
      cacheService.set('ttl:key', 'value', { ttl: 60 });

      const ttl = cacheService.ttl('ttl:key');

      expect(ttl).toBeGreaterThan(55);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should return undefined TTL for missing key', () => {
      const ttl = cacheService.ttl('nonexistent:key');
      expect(ttl).toBeUndefined();
    });
  });

  describe('keys', () => {
    it('should return all cache keys', () => {
      cacheService.set('key:1', 'value1');
      cacheService.set('key:2', 'value2');
      cacheService.set('key:3', 'value3');

      const keys = cacheService.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key:1');
      expect(keys).toContain('key:2');
      expect(keys).toContain('key:3');
    });
  });

  describe('metrics history', () => {
    it('should track metrics over time', async () => {
      // Perform some operations
      cacheService.set('key1', 'value1');
      cacheService.get('key1');

      // Get history (might be empty if not enough time passed)
      const history = cacheService.getMetricsHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should not collect snapshots by default in Jest runtime', () => {
      jest.useFakeTimers();

      const defaultSnapshotsOff = new EnhancedCacheService({
        stdTTL: 60,
        checkperiod: 10,
      });

      try {
        jest.advanceTimersByTime(120000);
        expect(defaultSnapshotsOff.getMetricsHistory()).toHaveLength(0);
      } finally {
        defaultSnapshotsOff.shutdown();
        defaultSnapshotsOff.flushAll();
        jest.useRealTimers();
      }
    });

    it('should collect snapshots when explicitly enabled in Jest runtime', () => {
      jest.useFakeTimers();

      const snapshotsEnabled = new EnhancedCacheService({
        stdTTL: 60,
        checkperiod: 10,
        enableMetricsSnapshots: true,
      });

      try {
        jest.advanceTimersByTime(60000);
        expect(snapshotsEnabled.getMetricsHistory().length).toBeGreaterThan(0);
      } finally {
        snapshotsEnabled.shutdown();
        snapshotsEnabled.flushAll();
        jest.useRealTimers();
      }
    });
  });

  describe('resetMetrics', () => {
    it('should reset latency tracking', () => {
      cacheService.set('key1', 'value1');
      cacheService.get('key1');

      cacheService.resetMetrics();

      const metrics = cacheService.getMetrics();
      expect(metrics.lastReset).toBeDefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
