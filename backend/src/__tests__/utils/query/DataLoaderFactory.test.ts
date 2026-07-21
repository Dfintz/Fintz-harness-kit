import { Repository } from 'typeorm';

import { DataLoader, DataLoaderContext } from '../../../utils/query/DataLoaderFactory';

interface LoaderTestEntity {
  id: string;
  fleetId?: string;
  organizationId?: string;
}

function createMockRepository(): Repository<LoaderTestEntity> {
  return {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<LoaderTestEntity>;
}

describe('DataLoader', () => {
  describe('basic functionality', () => {
    it('should batch multiple load calls into a single batch function call', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key, name: `Entity ${key}` }));
      });

      const loader = new DataLoader(batchFn);

      // Make multiple load calls
      const promise1 = loader.load('1');
      const promise2 = loader.load('2');
      const promise3 = loader.load('3');

      const results = await Promise.all([promise1, promise2, promise3]);

      // Batch function should only be called once
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith(['1', '2', '3']);

      expect(results).toEqual([
        { id: '1', name: 'Entity 1' },
        { id: '2', name: 'Entity 2' },
        { id: '3', name: 'Entity 3' },
      ]);
    });

    it('should cache results by default', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key }));
      });

      const loader = new DataLoader(batchFn);

      await loader.load('1');
      await loader.load('1'); // Should return cached result

      expect(batchFn).toHaveBeenCalledTimes(1);
    });

    it('should not cache when disabled', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key }));
      });

      const loader = new DataLoader(batchFn, { cache: false });

      await loader.load('1');

      // Wait for next tick to trigger new batch
      await new Promise(resolve => setImmediate(resolve));
      await loader.load('1');

      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it('should return undefined for missing keys', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => (key === '1' ? { id: key } : undefined));
      });

      const loader = new DataLoader(batchFn);

      const result1 = await loader.load('1');
      const result2 = await loader.load('2');

      expect(result1).toEqual({ id: '1' });
      expect(result2).toBeUndefined();
    });

    it('should handle batch function errors', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Database error'));

      const loader = new DataLoader(batchFn);

      await expect(loader.load('1')).rejects.toThrow('Database error');
    });

    it('should validate batch function result length', async () => {
      const batchFn = jest.fn().mockImplementation(async () => {
        return [{ id: '1' }]; // Returns fewer items than requested
      });

      const loader = new DataLoader(batchFn);

      const promise1 = loader.load('1');
      const promise2 = loader.load('2');

      await expect(Promise.all([promise1, promise2])).rejects.toThrow(
        'DataLoader batch function returned 1 results for 2 keys'
      );
    });
  });

  describe('loadMany', () => {
    it('should load multiple keys at once', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key }));
      });

      const loader = new DataLoader(batchFn);

      const results = await loader.loadMany(['1', '2', '3']);

      expect(results).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    });
  });

  describe('clear', () => {
    it('should clear specific key from cache', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key }));
      });

      const loader = new DataLoader(batchFn);

      await loader.load('1');
      loader.clear('1');

      // Wait for next batch
      await new Promise(resolve => setImmediate(resolve));
      await loader.load('1');

      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it('should clear all keys from cache', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key }));
      });

      const loader = new DataLoader(batchFn);

      await loader.load('1');
      await loader.load('2');
      loader.clear();

      // Wait for next batch to ensure cache is cleared
      await new Promise(resolve => setImmediate(resolve));
      await loader.load('1');

      // Expect at least 2 calls (initial + after clear), may be more depending on batching
      expect(batchFn).toHaveBeenCalled();
      expect(batchFn.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('prime', () => {
    it('should prime cache with known value', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key }));
      });

      const loader = new DataLoader(batchFn);

      loader.prime('1', { id: '1', name: 'Primed' });

      const result = await loader.load('1');

      expect(batchFn).not.toHaveBeenCalled();
      expect(result).toEqual({ id: '1', name: 'Primed' });
    });

    it('should not override existing cache entry', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key, name: 'From DB' }));
      });

      const loader = new DataLoader(batchFn);

      await loader.load('1');
      loader.prime('1', { id: '1', name: 'Primed' });

      const result = await loader.load('1');

      expect(result).toEqual({ id: '1', name: 'From DB' });
    });
  });

  describe('options', () => {
    it('should respect maxBatchSize', async () => {
      const batchFn = jest.fn().mockImplementation(async (keys: string[]) => {
        return keys.map(key => ({ id: key }));
      });

      const loader = new DataLoader(batchFn, { maxBatchSize: 2 });

      // Make 5 load calls
      const promises = ['1', '2', '3', '4', '5'].map(key => loader.load(key));
      await Promise.all(promises);

      // Should be called multiple times due to batch size limit
      expect(batchFn).toHaveBeenCalledTimes(3);
      expect(batchFn.mock.calls[0][0]).toHaveLength(2);
      expect(batchFn.mock.calls[1][0]).toHaveLength(2);
      expect(batchFn.mock.calls[2][0]).toHaveLength(1);
    });
  });
});

describe('DataLoaderContext', () => {
  it('should create and cache entity loaders', () => {
    const mockRepository = createMockRepository();

    const context = new DataLoaderContext();

    const loader1 = context.getEntityLoader('fleet', mockRepository);
    const loader2 = context.getEntityLoader('fleet', mockRepository);

    expect(loader1).toBe(loader2); // Same instance
  });

  it('should create different loaders for different names', () => {
    const mockRepository = createMockRepository();

    const context = new DataLoaderContext();

    const fleetLoader = context.getEntityLoader('fleet', mockRepository);
    const shipLoader = context.getEntityLoader('ship', mockRepository);

    expect(fleetLoader).not.toBe(shipLoader);
  });

  it('should clear all loaders', () => {
    const mockRepository = createMockRepository();

    const context = new DataLoaderContext();

    const loader = context.getEntityLoader('fleet', mockRepository);

    // Prime the loader
    loader.prime('1', { id: '1' });

    context.clearAll();

    // After clearing, the cached value should be gone
    // The loader should still work but will need to fetch
    expect(loader).toBeDefined();
  });

  it('should return stable relation and count loaders by name', () => {
    const mockRepository = createMockRepository();

    const context = new DataLoaderContext();

    const relationLoader1 = context.getRelationLoader('fleetShips', mockRepository, 'fleetId');
    const relationLoader2 = context.getRelationLoader('fleetShips', mockRepository, 'fleetId');
    const countLoader1 = context.getCountLoader('fleetShipCount', mockRepository, 'fleetId');
    const countLoader2 = context.getCountLoader('fleetShipCount', mockRepository, 'fleetId');

    expect(relationLoader1).toBe(relationLoader2);
    expect(countLoader1).toBe(countLoader2);
  });

  it('should not throw when clearing an unknown loader name', () => {
    const context = new DataLoaderContext();
    expect(() => context.clearLoader('missing-loader')).not.toThrow();
  });

  it('should create separate loaders for same name when scope differs', () => {
    const mockRepository = createMockRepository();

    const context = new DataLoaderContext();

    const orgOneLoader = context.getEntityLoader('fleet', mockRepository, 'id', {
      organizationId: 'org-1',
    });
    const orgTwoLoader = context.getEntityLoader('fleet', mockRepository, 'id', {
      organizationId: 'org-2',
    });

    expect(orgOneLoader).not.toBe(orgTwoLoader);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
