import { Fleet } from '../../models/Fleet';
import { FleetNotFoundError } from '../../utils/apiErrors';
import { createMockDataSource, createMockRepository } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
const mockFleetRepository = createMockRepository();

jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../utils/logger', () => ({
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

import { FleetService } from '../../services/fleet';

/**
 * PERF-01: FleetService.addShipIdsToFleet / removeShipIdsFromFleet perform their
 * read-merge-write on the denormalized `Fleet.shipIds` array under a
 * pessimistic_write row lock (withEntityLock), so concurrent assignments cannot
 * lose updates and re-adds dedup to an idempotent no-op. These tests exercise the
 * locked query-runner path the same way the ACT-02 cancellation tests do.
 */
describe('FleetService atomic shipIds mutations (PERF-01)', () => {
  let service: FleetService;

  /** Build a fresh lock query-builder whose getOne resolves to `locked`. */
  const mockLockLoad = (locked: Partial<Fleet> | null): void => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(locked),
    };
    mockFleetRepository.createQueryBuilder.mockReturnValue(queryBuilder);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataSource.getRepository.mockReturnValue(mockFleetRepository);

    // withEntityLock needs the entity primary-key metadata + a query-runner whose
    // manager.getRepository resolves back to the mocked Fleet repository.
    (mockFleetRepository as unknown as { metadata: unknown; target: unknown }).metadata = {
      name: 'Fleet',
      primaryColumns: [{ propertyName: 'id' }],
    };
    (mockFleetRepository as unknown as { target: unknown }).target = Fleet;

    mockDataSource.createQueryRunner.mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn(() => mockFleetRepository),
      },
    });

    service = new FleetService();
  });

  describe('addShipIdsToFleet', () => {
    it('merges new ship IDs into the locked fleet and persists the union', async () => {
      mockLockLoad({
        id: 'fleet-1',
        organizationId: 'org-1',
        shipIds: ['ship-a'],
      });
      mockFleetRepository.save.mockImplementation(async (input: Partial<Fleet>) => input);

      const result = await service.addShipIdsToFleet('org-1', 'fleet-1', ['ship-b', 'ship-c']);

      expect(result.shipIds).toEqual(['ship-a', 'ship-b', 'ship-c']);
      expect(mockFleetRepository.save).toHaveBeenCalledTimes(1);
      expect(mockFleetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'fleet-1', shipIds: ['ship-a', 'ship-b', 'ship-c'] })
      );
    });

    it('does not append a ship already present under the lock (idempotent no-op)', async () => {
      // Simulates a concurrent winner that already added ship-b: by the time we
      // acquire the lock, the row already contains it, so the union is unchanged
      // and no second save happens (no double-count of the denormalized shipIds).
      mockLockLoad({
        id: 'fleet-1',
        organizationId: 'org-1',
        shipIds: ['ship-a', 'ship-b'],
      });

      const result = await service.addShipIdsToFleet('org-1', 'fleet-1', ['ship-b']);

      expect(result.shipIds).toEqual(['ship-a', 'ship-b']);
      expect(mockFleetRepository.save).not.toHaveBeenCalled();
    });

    it('throws FleetNotFoundError when the locked fleet belongs to another organization', async () => {
      mockLockLoad({
        id: 'fleet-1',
        organizationId: 'other-org',
        shipIds: [],
      });

      await expect(
        service.addShipIdsToFleet('org-1', 'fleet-1', ['ship-a'])
      ).rejects.toBeInstanceOf(FleetNotFoundError);
      expect(mockFleetRepository.save).not.toHaveBeenCalled();
    });

    it('throws FleetNotFoundError when no fleet row matches the id', async () => {
      mockLockLoad(null);

      await expect(
        service.addShipIdsToFleet('org-1', 'missing', ['ship-a'])
      ).rejects.toBeInstanceOf(FleetNotFoundError);
      expect(mockFleetRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeShipIdsFromFleet', () => {
    it('removes the requested ship IDs from the locked fleet and persists the result', async () => {
      mockLockLoad({
        id: 'fleet-1',
        organizationId: 'org-1',
        shipIds: ['ship-a', 'ship-b', 'ship-c'],
      });
      mockFleetRepository.save.mockImplementation(async (input: Partial<Fleet>) => input);

      const result = await service.removeShipIdsFromFleet('org-1', 'fleet-1', ['ship-b']);

      expect(result.shipIds).toEqual(['ship-a', 'ship-c']);
      expect(mockFleetRepository.save).toHaveBeenCalledTimes(1);
    });

    it('does not save when none of the requested ships are present (idempotent no-op)', async () => {
      mockLockLoad({
        id: 'fleet-1',
        organizationId: 'org-1',
        shipIds: ['ship-a'],
      });

      const result = await service.removeShipIdsFromFleet('org-1', 'fleet-1', ['ship-z']);

      expect(result.shipIds).toEqual(['ship-a']);
      expect(mockFleetRepository.save).not.toHaveBeenCalled();
    });

    it('throws FleetNotFoundError when the locked fleet belongs to another organization', async () => {
      mockLockLoad({
        id: 'fleet-1',
        organizationId: 'other-org',
        shipIds: ['ship-a'],
      });

      await expect(
        service.removeShipIdsFromFleet('org-1', 'fleet-1', ['ship-a'])
      ).rejects.toBeInstanceOf(FleetNotFoundError);
      expect(mockFleetRepository.save).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
