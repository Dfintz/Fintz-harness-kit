import { Repository } from 'typeorm';

import { RsiCitizenOrg } from '../../models/RsiCitizenOrg';
import { RsiIntelAffiliationRefreshService } from '../../services/intel/RsiIntelAffiliationRefreshService';

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/external/RsiCrawlerService', () => ({
  rsiCrawlerService: {
    crawlUserMemberships: jest.fn(),
    getCircuitStatus: jest.fn(() => ({
      state: 'closed',
      failures: 0,
      lastFailure: null,
    })),
  },
}));

import { AppDataSource } from '../../config/database';
import { rsiCrawlerService } from '../../services/external/RsiCrawlerService';
import { logger } from '../../utils/logger';

describe('RsiIntelAffiliationRefreshService', () => {
  let service: RsiIntelAffiliationRefreshService;
  let mockRepo: jest.Mocked<Repository<RsiCitizenOrg>>;
  const mockCrawler = rsiCrawlerService as jest.Mocked<typeof rsiCrawlerService>;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockQueryBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<RsiCitizenOrg>>;

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

    mockCrawler.getCircuitStatus.mockReturnValue({
      state: 'closed',
      failures: 0,
      lastFailure: null,
    });

    service = new RsiIntelAffiliationRefreshService();
    const internalService = service as unknown as {
      computeRateLimitRetryDelayMs: () => number;
      wait: (delayMs: number) => Promise<void>;
    };
    jest.spyOn(internalService, 'computeRateLimitRetryDelayMs').mockReturnValue(0);
    jest.spyOn(internalService, 'wait').mockResolvedValue(undefined);
  });

  it('retries once with jitter when crawl fails with a rate-limit control-path error', async () => {
    mockCrawler.crawlUserMemberships
      .mockRejectedValueOnce(
        new Error('Failed to crawl memberships: RSI Crawler rate limit exceeded')
      )
      .mockResolvedValueOnce([]);

    const result = await service.refreshHandlesBatch(['Fherion'], {
      maxHandles: 1,
      delayMs: 0,
      maxRuntimeMs: 60_000,
    });

    expect(mockCrawler.crawlUserMemberships).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(1);
    expect(result.unavailable).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.banned).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      'RSI affiliation refresh hit rate-limit control path; retrying once with jitter',
      expect.objectContaining({ handle: 'Fherion', delayMs: 0 })
    );
  });

  it('marks handle unavailable when the rate-limit retry also fails', async () => {
    mockCrawler.crawlUserMemberships
      .mockRejectedValueOnce(
        new Error('Failed to crawl memberships: RSI Crawler rate limit exceeded')
      )
      .mockRejectedValueOnce(
        new Error('Failed to crawl memberships: RSI Crawler rate limit exceeded')
      );

    const result = await service.refreshHandlesBatch(['Fherion'], {
      maxHandles: 1,
      delayMs: 0,
      maxRuntimeMs: 60_000,
    });

    expect(mockCrawler.crawlUserMemberships).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(1);
    expect(result.unavailable).toBe(1);
    expect(result.deleted).toBe(0);
    expect(result.banned).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'RSI affiliation background refresh failed',
      expect.objectContaining({
        handle: 'Fherion',
        status: 'unavailable',
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
