/**
 * Fleet Hierarchy Service Tests
 * Wave 2.2 — Visual Fleet Organizer
 */

// Mock TypeORM before imports
import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

// Also mock data-source (some services import from there)
jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

import { FleetService } from '../../services/fleet/FleetService';
import { Fleet, FleetStatus, FleetType } from '../../models/Fleet';

describe('FleetService — Hierarchy Operations (Wave 2.2)', () => {
  let fleetService: FleetService;
  let mockFleets: Partial<Fleet>[];

  const ORG_ID = 'org-1';

  const createHierarchyQueryBuilder = (fleets: Partial<Fleet>[]) => ({
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(fleets),
  });

  const createFleet = (overrides: Partial<Fleet> = {}): Partial<Fleet> => ({
    id: `fleet-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Fleet',
    organizationId: ORG_ID,
    status: FleetStatus.ACTIVE,
    type: FleetType.MIXED,
    members: [],
    shipIds: [],
    maxMembers: 50,
    level: 0,
    sortOrder: 0,
    parentFleetId: undefined,
    hierarchyPath: '',
    color: '#00d9ff',
    tags: [],
    isPublic: false,
    visibility: 'private',
    allowApplications: false,
    allowedOrganizations: [],
    publicViewEnabled: false,
    allowJoinRequests: false,
    ...overrides,
  });

  beforeEach(() => {
    mockFleets = [];
    const mockRepo = createMockRepositoryWithData(mockFleets);

    // Add createQueryBuilder mock for hierarchy operations
    mockRepo.createQueryBuilder = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
      getMany: jest.fn().mockImplementation(() => Promise.resolve(mockFleets)),
    });

    mockDataSource.getRepository.mockReturnValue(mockRepo);

    // Mock createQueryRunner for transaction operations
    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn().mockImplementation((_entity: unknown, options: any) => {
          return Promise.resolve(
            mockFleets.find(
              f => f.id === options.where?.id && f.organizationId === options.where?.organizationId
            ) || null
          );
        }),
        find: jest.fn().mockImplementation((_entity: unknown, options: any) => {
          return Promise.resolve(
            mockFleets.filter(
              f =>
                f.organizationId === options.where?.organizationId &&
                f.parentFleetId === options.where?.parentFleetId
            )
          );
        }),
        save: jest.fn().mockImplementation((entity: any) => {
          const idx = mockFleets.findIndex(f => f.id === entity.id);
          if (idx >= 0) {
            mockFleets[idx] = { ...mockFleets[idx], ...entity };
          }
          return Promise.resolve(entity);
        }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
        }),
      },
    };
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    (mockDataSource as { query?: jest.Mock }).query = jest.fn().mockResolvedValue([]);

    fleetService = new FleetService();
    jest.clearAllMocks();
  });

  // ============================================================================
  // getFleetTree
  // ============================================================================

  describe('getFleetTree', () => {
    it('should return empty array when no fleets exist', async () => {
      const mockRepo = createMockRepositoryWithData([]);
      mockRepo.createQueryBuilder = jest.fn().mockReturnValue(createHierarchyQueryBuilder([]));
      mockDataSource.getRepository.mockReturnValue(mockRepo);
      fleetService = new FleetService();

      const tree = await fleetService.getFleetTree(ORG_ID);
      expect(tree).toEqual([]);
    });

    it('should return flat list as root nodes when no hierarchy', async () => {
      const fleet1 = createFleet({ id: 'f1', name: 'Alpha', level: 0, hierarchyPath: 'f1' });
      const fleet2 = createFleet({ id: 'f2', name: 'Bravo', level: 0, hierarchyPath: 'f2' });

      const mockRepo = createMockRepositoryWithData([fleet1, fleet2]);
      mockRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(createHierarchyQueryBuilder([fleet1, fleet2]));
      mockDataSource.getRepository.mockReturnValue(mockRepo);
      fleetService = new FleetService();

      const tree = await fleetService.getFleetTree(ORG_ID);
      expect(tree).toHaveLength(2);
      expect(tree[0].children).toEqual([]);
      expect(tree[1].children).toEqual([]);
    });

    it('should build correct parent-child hierarchy', async () => {
      const root = createFleet({ id: 'root', name: 'Division', level: 0, hierarchyPath: 'root' });
      const child = createFleet({
        id: 'child',
        name: 'Squadron',
        level: 1,
        parentFleetId: 'root',
        hierarchyPath: 'root.child',
      });
      const grandchild = createFleet({
        id: 'grandchild',
        name: 'Task Force',
        level: 2,
        parentFleetId: 'child',
        hierarchyPath: 'root.child.grandchild',
      });

      const allFleets = [root, child, grandchild];
      const mockRepo = createMockRepositoryWithData(allFleets);
      mockRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(createHierarchyQueryBuilder(allFleets));
      mockDataSource.getRepository.mockReturnValue(mockRepo);
      fleetService = new FleetService();

      const tree = await fleetService.getFleetTree(ORG_ID);
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('root');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe('child');
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].id).toBe('grandchild');
    });

    it('should handle orphan fleets (parent not found) as root nodes', async () => {
      const orphan = createFleet({
        id: 'orphan',
        name: 'Orphan Fleet',
        level: 1,
        parentFleetId: 'deleted-parent',
        hierarchyPath: 'deleted-parent.orphan',
      });

      const mockRepo = createMockRepositoryWithData([orphan]);
      mockRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(createHierarchyQueryBuilder([orphan]));
      mockDataSource.getRepository.mockReturnValue(mockRepo);
      fleetService = new FleetService();

      const tree = await fleetService.getFleetTree(ORG_ID);
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('orphan');
    });
  });

  // ============================================================================
  // isDescendantOf
  // ============================================================================

  describe('isDescendantOf', () => {
    it('should return true when fleet is a descendant', async () => {
      const child = createFleet({
        id: 'child',
        hierarchyPath: 'root.middle.child',
      });
      mockFleets.push(child);

      const result = await fleetService.isDescendantOf(ORG_ID, 'child', 'root');
      expect(result).toBe(true);
    });

    it('should return false when fleet is NOT a descendant', async () => {
      const fleet = createFleet({
        id: 'other',
        hierarchyPath: 'other-root.other',
      });
      mockFleets.push(fleet);

      const result = await fleetService.isDescendantOf(ORG_ID, 'other', 'root');
      expect(result).toBe(false);
    });

    it('should return false when fleet not found', async () => {
      const result = await fleetService.isDescendantOf(ORG_ID, 'nonexistent', 'root');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // moveFleet
  // ============================================================================

  describe('moveFleet', () => {
    it('should throw when fleet not found', async () => {
      await expect(fleetService.moveFleet(ORG_ID, 'nonexistent', null)).rejects.toThrow(
        'Fleet not found'
      );
    });

    it('should no-op when fleet is already at the target parent', async () => {
      const fleet = createFleet({ id: 'f1', parentFleetId: undefined });
      mockFleets.push(fleet);

      // Moving to null when already at root = no-op
      const result = await fleetService.moveFleet(ORG_ID, 'f1', null);
      expect(result.id).toBe('f1');
    });

    it('should throw when moving fleet under itself', async () => {
      const fleet = createFleet({ id: 'f1', parentFleetId: undefined, hierarchyPath: 'f1' });
      mockFleets.push(fleet);

      await expect(fleetService.moveFleet(ORG_ID, 'f1', 'f1')).rejects.toThrow(
        'Cannot move a fleet under itself'
      );
    });

    it('should throw when target parent not found', async () => {
      const fleet = createFleet({ id: 'f1', parentFleetId: undefined, hierarchyPath: 'f1' });
      mockFleets.push(fleet);

      await expect(fleetService.moveFleet(ORG_ID, 'f1', 'nonexistent')).rejects.toThrow(
        'Target parent fleet not found'
      );
    });
  });

  // ============================================================================
  // reorderFleets
  // ============================================================================

  describe('reorderFleets', () => {
    it('should update sortOrder for all provided fleet IDs', async () => {
      const f1 = createFleet({ id: 'f1', sortOrder: 0 });
      const f2 = createFleet({ id: 'f2', sortOrder: 1 });
      const f3 = createFleet({ id: 'f3', sortOrder: 2 });
      mockFleets.push(f1, f2, f3);

      await fleetService.reorderFleets(ORG_ID, ['f3', 'f1', 'f2'], null);

      // Verify commitTransaction was called (transaction completed successfully)
      const qr = mockDataSource.createQueryRunner();
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('should call update for each fleet in the ordered list', async () => {
      const f1 = createFleet({ id: 'f1' });
      const f2 = createFleet({ id: 'f2' });
      mockFleets.push(f1, f2);

      await fleetService.reorderFleets(ORG_ID, ['f2', 'f1'], null);

      const qr = mockDataSource.createQueryRunner();
      // Update called twice (once per fleet)
      expect(qr.manager.update).toHaveBeenCalledTimes(2);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
