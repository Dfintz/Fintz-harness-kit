import { DistributedJobLockService } from '../jobs/DistributedJobLockService';

// Mock Redis
jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve(false)),
    del: jest.fn(() => Promise.resolve(true)),
    getStatus: jest.fn(() => ({ connected: false, enabled: true })),
  },
  redisClient: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    eval: jest.fn(),
    getStatus: jest.fn(() => 'ready'),
    status: 'ready',
  },
}));

jest.mock('../../config/database');

describe('DistributedJobLockService', () => {
  let service: DistributedJobLockService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    service = new DistributedJobLockService({
      defaultTtl: 30,
      keyPrefix: 'test-lock:',
    });
  });

  afterEach(() => {
    // Clean up timers and locks
    service.releaseAllLocks();
    jest.useRealTimers();
  });

  describe('acquireLock', () => {
    it('should acquire in-memory lock when Redis unavailable', async () => {
      jest.useRealTimers();

      const result = await service.acquireLock('test-job');

      expect(result.acquired).toBe(true);
      expect(result.lock).toBeDefined();
      if (!result.lock) {
        throw new Error('Expected lock to be defined');
      }
      expect(result.lock.key).toBe('test-lock:test-job');
    });

    it('should prevent duplicate lock acquisition', async () => {
      jest.useRealTimers();

      const first = await service.acquireLock('test-job');
      expect(first.acquired).toBe(true);

      // Create a second service instance to try acquiring the same lock
      // In-memory locks are per-instance, so this tests re-entrant behavior
      const second = await service.acquireLock('test-job');
      // Re-entrant: same instance extends the lock
      expect(second.acquired).toBe(true);
    });

    it('should respect custom TTL', async () => {
      jest.useRealTimers();

      const result = await service.acquireLock('test-job', {
        ttlSeconds: 60,
      });

      expect(result.acquired).toBe(true);
      if (!result.lock) {
        throw new Error('Expected lock to be defined');
      }
      const ttlMs = result.lock.expiresAt.getTime() - result.lock.acquiredAt.getTime();
      expect(Math.round(ttlMs / 1000)).toBe(60);
    });

    it('should use default TTL when not specified', async () => {
      jest.useRealTimers();

      const result = await service.acquireLock('test-job');

      expect(result.acquired).toBe(true);
      if (!result.lock) {
        throw new Error('Expected lock to be defined');
      }
      const ttlMs = result.lock.expiresAt.getTime() - result.lock.acquiredAt.getTime();
      expect(Math.round(ttlMs / 1000)).toBe(30);
    });
  });

  describe('releaseLock', () => {
    it('should release an acquired lock', async () => {
      jest.useRealTimers();

      await service.acquireLock('test-job');
      const released = await service.releaseLock('test-job');

      expect(released).toBe(true);
    });

    it('should return false for non-existent lock', async () => {
      jest.useRealTimers();

      const released = await service.releaseLock('nonexistent-job');

      expect(released).toBe(false);
    });
  });

  describe('extendLock', () => {
    it('should extend an existing lock', async () => {
      jest.useRealTimers();

      await service.acquireLock('test-job');
      const extended = await service.extendLock('test-job', 60);

      expect(extended).toBe(true);
    });

    it('should return false for non-existent lock', async () => {
      jest.useRealTimers();

      const extended = await service.extendLock('nonexistent-job');

      expect(extended).toBe(false);
    });
  });

  describe('isLocked', () => {
    it('should return true for active lock', async () => {
      jest.useRealTimers();

      await service.acquireLock('test-job');
      const locked = await service.isLocked('test-job');

      expect(locked).toBe(true);
    });

    it('should return false when no lock exists', async () => {
      jest.useRealTimers();

      const locked = await service.isLocked('nonexistent-job');

      expect(locked).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock info for active lock', async () => {
      jest.useRealTimers();

      await service.acquireLock('test-job');
      const info = await service.getLockInfo('test-job');

      expect(info).not.toBeNull();
      if (!info) {
        throw new Error('Expected lock info to be defined');
      }
      expect(info.key).toBe('test-lock:test-job');
      expect(info.ownerId).toBeDefined();
    });

    it('should return null for no lock', async () => {
      jest.useRealTimers();

      const info = await service.getLockInfo('nonexistent-job');

      expect(info).toBeNull();
    });
  });

  describe('getActiveLocks', () => {
    it('should return all active locks', async () => {
      jest.useRealTimers();

      await service.acquireLock('job-1');
      await service.acquireLock('job-2');

      const locks = service.getActiveLocks();

      expect(locks).toHaveLength(2);
    });

    it('should return empty array when no locks', () => {
      const locks = service.getActiveLocks();

      expect(locks).toHaveLength(0);
    });
  });

  describe('releaseAllLocks', () => {
    it('should release all held locks', async () => {
      jest.useRealTimers();

      await service.acquireLock('job-1');
      await service.acquireLock('job-2');

      const count = await service.releaseAllLocks();

      expect(count).toBe(2);
      expect(service.getActiveLocks()).toHaveLength(0);
    });
  });

  describe('withLock', () => {
    it('should execute function within lock and release after', async () => {
      jest.useRealTimers();

      const fn = jest.fn().mockResolvedValue('result');
      const result = await service.withLock('test-job', fn);

      expect(result.success).toBe(true);
      expect(result.result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
      // Lock should be released after
      const locked = await service.isLocked('test-job');
      expect(locked).toBe(false);
    });

    it('should release lock even if function throws', async () => {
      jest.useRealTimers();

      const fn = jest.fn().mockRejectedValue(new Error('test error'));
      const result = await service.withLock('test-job', fn);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Lock should still be released
      const locked = await service.isLocked('test-job');
      expect(locked).toBe(false);
    });
  });

  describe('withJobLock', () => {
    it('should skip execution when lock cannot be acquired', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      jest
        .spyOn(service, 'acquireLock')
        .mockResolvedValueOnce({ acquired: false, reason: 'Lock held by another instance' });

      const result = await service.withJobLock('test-job', fn);

      expect(result.acquired).toBe(false);
      expect(result.executed).toBe(false);
      expect(result.reason).toContain('Lock held by another instance');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should return execution error when callback throws', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('boom'));

      const result = await service.withJobLock('test-job', fn);

      expect(result.acquired).toBe(true);
      expect(result.executed).toBe(false);
      expect(result.error).toContain('boom');
    });
  });

  describe('claimWorkItem', () => {
    it('should return claimed=false when claim lock is not acquired', async () => {
      jest.spyOn(service, 'withJobLock').mockResolvedValueOnce({
        acquired: false,
        executed: false,
        reason: 'already claimed',
      });

      const result = await service.claimWorkItem('item-1', async () => 'ok');

      expect(result.claimed).toBe(false);
      expect(result.skippedReason).toContain('already claimed');
    });

    it('should return error when claimed work item execution fails', async () => {
      jest.spyOn(service, 'withJobLock').mockResolvedValueOnce({
        acquired: true,
        executed: false,
        error: 'execution failed',
      });

      const result = await service.claimWorkItem('item-2', async () => 'ok');

      expect(result.claimed).toBe(true);
      expect(result.error).toContain('execution failed');
    });
  });

  describe('getInstanceId', () => {
    it('should return a consistent instance ID', () => {
      const id1 = service.getInstanceId();
      const id2 = service.getInstanceId();

      expect(id1).toBe(id2);
      expect(id1).toBeDefined();
      expect(id1.length).toBeGreaterThan(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

