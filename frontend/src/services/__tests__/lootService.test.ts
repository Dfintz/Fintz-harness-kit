/**
 * Loot Service Tests
 *
 * Tests the commissary loot distribution API client.
 */

import { apiClient } from '@/services/apiClient';
import { lootService } from '@/services/lootService';

jest.mock('../apiClient', () => {
  class MockApiClientError extends Error {
    code: string;
    statusCode?: number;
    constructor(errorCode: string, message: string, statusCode?: number) {
      super(message);
      this.name = 'ApiClientError';
      this.code = errorCode;
      this.statusCode = statusCode;
    }
  }

  return {
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
    ApiClientError: MockApiClientError,
    getErrorMessage: jest.fn((err: Error) => err.message),
  };
});

describe('LootService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists loot pools', async () => {
    const pools = [{ id: 'p1', name: 'Pool 1' }];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: pools } });

    const result = await lootService.listPools({ status: 'open' });

    expect(apiClient.get).toHaveBeenCalledWith('/api/v2/loot/pools', {
      params: { status: 'open' },
    });
    expect(result).toEqual(pools);
  });

  it('creates a loot pool', async () => {
    const pool = { id: 'p1', name: 'Loot' };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: pool });

    const result = await lootService.createPool({ name: 'Loot', activityId: 'a1' });

    expect(apiClient.post).toHaveBeenCalledWith('/api/v2/loot/pools', {
      name: 'Loot',
      activityId: 'a1',
    });
    expect(result).toEqual(pool);
  });

  it('creates a loot pool with assistant manager IDs', async () => {
    const pool = { id: 'p1', name: 'Loot Team' };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: pool });

    const result = await lootService.createPool({
      name: 'Loot Team',
      activityId: 'a1',
      assistantUserIds: ['u-1', 'u-2'],
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/v2/loot/pools', {
      name: 'Loot Team',
      activityId: 'a1',
      assistantUserIds: ['u-1', 'u-2'],
    });
    expect(result).toEqual(pool);
  });

  it('places a bid claim on an item', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

    await lootService.claimItem('p1', 'i1', { claimType: 'bid', bidAmount: 500 });

    expect(apiClient.post).toHaveBeenCalledWith('/api/v2/loot/pools/p1/items/i1/claim', {
      claimType: 'bid',
      bidAmount: 500,
    });
  });

  it('distributes a pool', async () => {
    const distribution = { poolId: 'p1', awards: [] };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: distribution });

    const result = await lootService.distributePool('p1');

    expect(apiClient.post).toHaveBeenCalledWith('/api/v2/loot/pools/p1/distribute', {});
    expect(result).toEqual(distribution);
  });

  it('retries distribution for a partially distributed pool', async () => {
    const distribution = { poolId: 'p1', awards: [], failures: [] };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: distribution });

    const result = await lootService.retryDistribution('p1');

    expect(apiClient.post).toHaveBeenCalledWith('/api/v2/loot/pools/p1/retry-distribution', {});
    expect(result).toEqual(distribution);
  });

  it('uploads an image for OCR as multipart form data', async () => {
    const ocr = { suggestions: [], rawLines: [], provider: 'azure-vision', enabled: false };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: ocr });
    const file = new File(['bytes'], 'inventory.png', { type: 'image/png' });

    const result = await lootService.scanImage(file);

    const [url, body] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v2/loot/ocr/scan');
    expect(body).toBeInstanceOf(FormData);
    expect(result).toEqual(ocr);
  });

  it('uploads an image for pool-scoped OCR scan', async () => {
    const ocr = { suggestions: [], rawLines: [], provider: 'azure-vision', enabled: false };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: ocr });
    const file = new File(['bytes'], 'inventory.png', { type: 'image/png' });

    const result = await lootService.scanPoolImage('pool-42', file);

    const [url, body] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v2/loot/pools/pool-42/ocr/scan');
    expect(body).toBeInstanceOf(FormData);
    expect(result).toEqual(ocr);
  });
});
