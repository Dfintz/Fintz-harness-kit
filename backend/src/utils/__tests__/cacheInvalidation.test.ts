import {
  invalidateActivityCache,
  invalidateDirectoryStatsCache,
  invalidateMemberStatsCache,
  invalidateTradeCache,
} from '../cacheInvalidation';
import { logger } from '../logger';
import { cache } from '../redis';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../redis', () => ({
  cache: {
    del: jest.fn().mockResolvedValue(true),
    delPattern: jest.fn().mockResolvedValue(0),
    delOrgCacheKeys: jest.fn().mockResolvedValue(0),
  },
}));

const mockCache = cache as unknown as {
  del: jest.Mock;
  delPattern: jest.Mock;
  delOrgCacheKeys: jest.Mock;
};

const mockLogger = logger as unknown as {
  warn: jest.Mock;
};

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>(resolve => {
    setImmediate(() => resolve());
  });
}

describe('cacheInvalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.del.mockResolvedValue(true);
    mockCache.delOrgCacheKeys.mockResolvedValue(0);
    mockCache.delPattern.mockResolvedValue(0);
  });

  it('uses org registry prefix deletes for activity wildcard invalidation', async () => {
    invalidateActivityCache('org-123');
    await flushAsyncWork();

    expect(mockCache.del).toHaveBeenCalledWith([
      'org:org-123:activity:metrics',
      'org:org-123:dashboard:summary',
    ]);
    expect(mockCache.delOrgCacheKeys).toHaveBeenCalledWith('org-123', [
      'org:org-123:activity:trends:',
    ]);
    expect(mockCache.delPattern).not.toHaveBeenCalled();
  });

  it('uses org registry prefix deletes for trade wildcard invalidation', async () => {
    invalidateTradeCache('org-321');
    await flushAsyncWork();

    expect(mockCache.del).toHaveBeenCalledWith(['org:org-321:dashboard:summary']);
    expect(mockCache.delOrgCacheKeys).toHaveBeenCalledWith('org-321', [
      'org:org-321:trade:overview:',
    ]);
    expect(mockCache.delPattern).not.toHaveBeenCalled();
  });

  it('keeps direct-key invalidation path for non-wildcard org caches', async () => {
    invalidateMemberStatsCache('org-555');
    await flushAsyncWork();

    expect(mockCache.del).toHaveBeenCalledWith([
      'org:org-555:member:stats',
      'org:org-555:dashboard:summary',
    ]);
    expect(mockCache.delOrgCacheKeys).not.toHaveBeenCalled();
    expect(mockCache.delPattern).not.toHaveBeenCalled();
  });

  it('keeps global invalidation path for public directory stats', async () => {
    invalidateDirectoryStatsCache();
    await flushAsyncWork();

    expect(mockCache.del).toHaveBeenCalledWith(['public:directory:stats', 'public:sitemap:xml']);
    expect(mockCache.delOrgCacheKeys).not.toHaveBeenCalled();
    expect(mockCache.delPattern).not.toHaveBeenCalled();
  });

  it('swallows async invalidation errors and logs warning', async () => {
    mockCache.delOrgCacheKeys.mockRejectedValueOnce(new Error('registry unavailable'));

    invalidateTradeCache('org-777');
    await flushAsyncWork();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Cache invalidation failed: trade:overview for org org-777',
      expect.any(Error)
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
