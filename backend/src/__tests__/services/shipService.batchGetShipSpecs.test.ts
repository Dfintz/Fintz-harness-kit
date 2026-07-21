/**
 * Tests for ShipService.batchGetShipSpecsByNames
 * Covers: batch ship spec lookup for fleet enrichment
 */

import { Repository, SelectQueryBuilder } from 'typeorm';

import { Ship } from '../../models/Ship';

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AppDataSource } from '../../data-source';
import { ShipService } from '../../services/ship/ShipService';

describe('ShipService - batchGetShipSpecsByNames', () => {
  let service: ShipService;
  let mockGetMany: jest.Mock;

  beforeAll(() => {
    mockGetMany = jest.fn().mockResolvedValue([]);

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: mockGetMany,
    } as unknown as SelectQueryBuilder<Ship>;

    const mockRepo = {
      metadata: { name: 'Ship' },
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Ship>>;

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

    service = new ShipService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup the mock chain after clearAllMocks
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: mockGetMany,
    };
    const repo = (AppDataSource.getRepository as jest.Mock).mock.results[0]?.value;
    if (repo?.createQueryBuilder) {
      repo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    }
  });

  it('should return empty map for empty input', async () => {
    const result = await service.batchGetShipSpecsByNames([]);
    expect(result.size).toBe(0);
  });

  it('should return specs keyed by lowercased ship name', async () => {
    mockGetMany.mockResolvedValueOnce([
      { name: 'Carrack', cargo: 456, quantumFuelCapacity: 1000 },
      { name: 'Caterpillar', cargo: 576, quantumFuelCapacity: 800 },
    ]);

    const result = await service.batchGetShipSpecsByNames(['Carrack', 'Caterpillar']);

    expect(result.size).toBe(2);
    expect(result.get('carrack')).toEqual({ cargo: 456, quantumFuelCapacity: 1000 });
    expect(result.get('caterpillar')).toEqual({ cargo: 576, quantumFuelCapacity: 800 });
  });

  it('should deduplicate input names (case-insensitive)', async () => {
    mockGetMany.mockResolvedValueOnce([{ name: 'Aurora MR', cargo: 0, quantumFuelCapacity: 50 }]);

    const result = await service.batchGetShipSpecsByNames(['Aurora MR', 'aurora mr', 'AURORA MR']);

    expect(result.size).toBe(1);
    expect(result.get('aurora mr')).toEqual({ cargo: 0, quantumFuelCapacity: 50 });
  });

  it('should default cargo and quantumFuelCapacity to 0 when null', async () => {
    mockGetMany.mockResolvedValueOnce([
      { name: 'Mustang Alpha', cargo: null, quantumFuelCapacity: null },
    ]);

    const result = await service.batchGetShipSpecsByNames(['Mustang Alpha']);

    expect(result.get('mustang alpha')).toEqual({ cargo: 0, quantumFuelCapacity: 0 });
  });

  it('should omit ships not found in the catalog', async () => {
    mockGetMany.mockResolvedValueOnce([{ name: 'Carrack', cargo: 456, quantumFuelCapacity: 1000 }]);

    const result = await service.batchGetShipSpecsByNames(['Carrack', 'NonexistentShip']);

    expect(result.size).toBe(1);
    expect(result.has('nonexistentship')).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
