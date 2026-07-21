import { logger } from '../../../utils/logger';
import { redisClient } from '../../../utils/redis';
import { RedisRateLimiter } from '../RedisRateLimiter';

jest.mock('../../../utils/redis', () => ({
  redisClient: {
    getStatus: jest.fn(),
    getClient: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedRedisClient = redisClient as jest.Mocked<typeof redisClient>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

interface MultiMock {
  incr: jest.Mock;
  expire: jest.Mock;
  pttl: jest.Mock;
  exec: jest.Mock;
}

function makeMulti(execResult: unknown): { multi: jest.Mock; chain: MultiMock } {
  const chain: MultiMock = {
    incr: jest.fn(),
    expire: jest.fn(),
    pttl: jest.fn(),
    exec: jest.fn().mockResolvedValue(execResult),
  };
  chain.incr.mockReturnValue(chain);
  chain.expire.mockReturnValue(chain);
  chain.pttl.mockReturnValue(chain);
  const multi = jest.fn().mockReturnValue(chain);
  return { multi, chain };
}

describe('RedisRateLimiter', () => {
  let limiter: RedisRateLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get a fresh instance state for each test by clearing in-memory store.
    limiter = RedisRateLimiter.getInstance();
    limiter.resetForTests();
  });

  describe('Redis path', () => {
    beforeEach(() => {
      mockedRedisClient.getStatus.mockReturnValue({ connected: true, enabled: true } as any);
    });

    it('allows the first request and reports remaining quota', async () => {
      const { multi } = makeMulti([
        [null, 1],
        [null, 1],
        [null, 60_000],
      ]);
      mockedRedisClient.getClient.mockReturnValue({ multi } as any);

      const result = await limiter.check('lfg:post:g:u', 3, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('denies requests beyond the limit', async () => {
      const { multi } = makeMulti([
        [null, 4],
        [null, 0],
        [null, 30_000],
      ]);
      mockedRedisClient.getClient.mockReturnValue({ multi } as any);

      const result = await limiter.check('lfg:post:g:u', 3, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('issues INCR + EXPIRE NX + PTTL in a single pipeline', async () => {
      const { multi, chain } = makeMulti([
        [null, 1],
        [null, 1],
        [null, 60_000],
      ]);
      mockedRedisClient.getClient.mockReturnValue({ multi } as any);

      await limiter.check('lfg:join:g:u', 15, 60);

      expect(multi).toHaveBeenCalledTimes(1);
      expect(chain.incr).toHaveBeenCalledWith('lfg:join:g:u');
      expect(chain.expire).toHaveBeenCalledWith('lfg:join:g:u', 60, 'NX');
      expect(chain.pttl).toHaveBeenCalledWith('lfg:join:g:u');
    });

    it('falls back to in-memory enforcement when Redis throws', async () => {
      const chain: MultiMock = {
        incr: jest.fn(),
        expire: jest.fn(),
        pttl: jest.fn(),
        exec: jest.fn().mockRejectedValue(new Error('boom')),
      };
      chain.incr.mockReturnValue(chain);
      chain.expire.mockReturnValue(chain);
      chain.pttl.mockReturnValue(chain);
      const multi = jest.fn().mockReturnValue(chain);
      mockedRedisClient.getClient.mockReturnValue({ multi } as any);

      const r1 = await limiter.check('lfg:err:g:u', 2, 60);
      const r2 = await limiter.check('lfg:err:g:u', 2, 60);
      const r3 = await limiter.check('lfg:err:g:u', 2, 60);

      // Pipelines were attempted but failed; in-memory fallback enforced the limit.
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(false);
      expect(mockedLogger.warn).toHaveBeenCalled();
    });

    it('treats null pipeline result as fail-open', async () => {
      const { multi } = makeMulti(null);
      mockedRedisClient.getClient.mockReturnValue({ multi } as any);

      const result = await limiter.check('lfg:nil:g:u', 3, 60);
      expect(result.allowed).toBe(true);
      expect(mockedLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Memory fallback path', () => {
    beforeEach(() => {
      mockedRedisClient.getStatus.mockReturnValue({ connected: false, enabled: false } as any);
      mockedRedisClient.getClient.mockReturnValue(null);
    });

    it('enforces the limit per key when Redis is unavailable', async () => {
      const r1 = await limiter.check('mem:g:u', 2, 60);
      const r2 = await limiter.check('mem:g:u', 2, 60);
      const r3 = await limiter.check('mem:g:u', 2, 60);

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);
    });

    it('isolates counters per key', async () => {
      await limiter.check('mem:g:user-A', 1, 60);
      const otherUser = await limiter.check('mem:g:user-B', 1, 60);
      expect(otherUser.allowed).toBe(true);
    });

    it('returns a resetAt within the configured window', async () => {
      const before = Date.now();
      const result = await limiter.check('mem:resetAt', 5, 60);
      const after = Date.now();
      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before + 60 * 1000);
      expect(result.resetAt.getTime()).toBeLessThanOrEqual(after + 60 * 1000);
    });
  });

  describe('Input validation', () => {
    it('fails open and warns on non-positive limit', async () => {
      const result = await limiter.check('bad:limit', 0, 60);
      expect(result.allowed).toBe(true);
      expect(mockedLogger.warn).toHaveBeenCalled();
    });

    it('fails open and warns on non-positive window', async () => {
      const result = await limiter.check('bad:window', 5, 0);
      expect(result.allowed).toBe(true);
      expect(mockedLogger.warn).toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

