/**
 * OrganizationShipController Unit Tests
 *
 * Tests organization ship fleet management operations
 * Covers CRUD, crew management, and analytics
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { OrganizationShipController } from '../../controllers/organizationShipController';
import { OrgShipRole } from '../../models/OrganizationShip';
import { ShipOwnershipStatus } from '../../models/UserShip';
import { OrganizationShipService } from '../../services/ship';
import { MockResponse } from '../helpers/testHelpers.helper';

// Mock dependencies
jest.mock('../../services/ship');
describe('OrganizationShipController', () => {
  let controller: OrganizationShipController;
  let mockOrgShipService: jest.Mocked<OrganizationShipService>;

  // Helper to create request with organization context
  const createRequest = (overrides: any = {}) => ({
    organizationId: 'test-org-id',
    user: { id: 'test-user-id', username: 'testuser', role: 'user', organizationId: 'test-org-id' },
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked service instance
    mockOrgShipService = {
      findOrgShips: jest.fn(),
      getOrgShipById: jest.fn(),
      createOrgShip: jest.fn(),
      updateOrgShip: jest.fn(),
      deleteOrgShip: jest.fn(),
      assignCaptain: jest.fn(),
      assignCrew: jest.fn(),
      addCrewMember: jest.fn(),
      removeCrewMember: jest.fn(),
      getShipsNeedingMaintenance: jest.fn(),
      getCapitalShips: jest.fn(),
      getShipsByRole: jest.fn(),
      getAvailableShips: jest.fn(),
      getFleetSummary: jest.fn(),
    } as any;

    controller = new OrganizationShipController();
    (controller as any).orgShipService = mockOrgShipService;
  });

  describe('getOrgShips', () => {
    it('should retrieve org ships with filters', async () => {
      const req = createRequest({
        query: {
          role: OrgShipRole.COMBAT,
          status: ShipOwnershipStatus.OWNED,
          isCapital: 'true',
          page: '1',
          limit: '20',
        },
      });
      const res = MockResponse.create();
      const mockResult = {
        data: [{ id: 'ship-1', role: OrgShipRole.COMBAT, isCapital: true }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      mockOrgShipService.findOrgShips.mockResolvedValue(mockResult as any);

      await controller.getOrgShips(req as any, res);

      expect(mockOrgShipService.findOrgShips).toHaveBeenCalledWith(
        'test-org-id',
        expect.objectContaining({
          role: OrgShipRole.COMBAT,
          isCapital: true,
        }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should throw error without organization context', async () => {
      const req = createRequest({ organizationId: undefined, user: {} });
      const res = MockResponse.create();

      await controller.getOrgShips(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getOrgShipById', () => {
    it('should retrieve org ship by ID', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
      });
      const res = MockResponse.create();
      const mockShip = { id: 'ship-123', role: OrgShipRole.COMBAT };
      mockOrgShipService.getOrgShipById.mockResolvedValue(mockShip as any);

      await controller.getOrgShipById(req as any, res);

      expect(mockOrgShipService.getOrgShipById).toHaveBeenCalledWith('test-org-id', 'ship-123');
      expect(res.json).toHaveBeenCalledWith(mockShip);
    });

    it('should return 404 if ship not found', async () => {
      const req = createRequest({
        params: { shipId: 'nonexistent' },
      });
      const res = MockResponse.create();
      mockOrgShipService.getOrgShipById.mockResolvedValue(null);

      await controller.getOrgShipById(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createOrgShip', () => {
    it('should create org ship successfully', async () => {
      const req = createRequest({
        body: {
          shipId: 'carrack',
          name: 'Org Carrack',
          role: OrgShipRole.EXPLORATION,
        },
      });
      const res = MockResponse.create();
      const mockShip = { id: 'ship-new', shipId: 'carrack', role: OrgShipRole.EXPLORATION };
      mockOrgShipService.createOrgShip.mockResolvedValue(mockShip as any);

      await controller.createOrgShip(req as any, res);

      expect(mockOrgShipService.createOrgShip).toHaveBeenCalledWith(
        'test-org-id',
        expect.objectContaining({ shipId: 'carrack' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockShip);
    });

    it('should throw error without organization context', async () => {
      const req = createRequest({
        organizationId: undefined,
        user: {},
        body: { shipId: 'carrack' },
      });
      const res = MockResponse.create();

      await controller.createOrgShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateOrgShip', () => {
    it('should update org ship successfully', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
        body: { name: 'Updated Name', role: OrgShipRole.LOGISTICS },
      });
      const res = MockResponse.create();
      const mockShip = { id: 'ship-123', name: 'Updated Name', role: OrgShipRole.LOGISTICS };
      mockOrgShipService.updateOrgShip.mockResolvedValue(mockShip as any);

      await controller.updateOrgShip(req as any, res);

      expect(mockOrgShipService.updateOrgShip).toHaveBeenCalledWith(
        'test-org-id',
        'ship-123',
        expect.objectContaining({ name: 'Updated Name' })
      );
      expect(res.json).toHaveBeenCalledWith(mockShip);
    });

    it('should return 404 if ship not found', async () => {
      const req = createRequest({
        params: { shipId: 'nonexistent' },
        body: { name: 'Updated' },
      });
      const res = MockResponse.create();
      mockOrgShipService.updateOrgShip.mockResolvedValue(null);

      await controller.updateOrgShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteOrgShip', () => {
    it('should delete org ship successfully', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
      });
      const res = MockResponse.create();
      mockOrgShipService.deleteOrgShip.mockResolvedValue(true);

      await controller.deleteOrgShip(req as any, res);

      expect(mockOrgShipService.deleteOrgShip).toHaveBeenCalledWith('test-org-id', 'ship-123');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 404 if ship not found', async () => {
      const req = createRequest({
        params: { shipId: 'nonexistent' },
      });
      const res = MockResponse.create();
      mockOrgShipService.deleteOrgShip.mockResolvedValue(false);

      await controller.deleteOrgShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Crew Management', () => {
    describe('assignCaptain', () => {
      it('should assign captain successfully', async () => {
        const req = createRequest({
          params: { shipId: 'ship-123' },
          body: { captainId: 'user-456' },
        });
        const res = MockResponse.create();
        const mockShip = { id: 'ship-123', assignedCaptain: 'user-456' };
        mockOrgShipService.assignCaptain.mockResolvedValue(mockShip as any);

        await controller.assignCaptain(req as any, res);

        expect(mockOrgShipService.assignCaptain).toHaveBeenCalledWith(
          'test-org-id',
          'ship-123',
          'user-456'
        );
        expect(res.json).toHaveBeenCalledWith(mockShip);
      });

      it('should throw error if captainId not provided', async () => {
        const req = createRequest({
          params: { shipId: 'ship-123' },
          body: {},
        });
        const res = MockResponse.create();

        await controller.assignCaptain(req as any, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });

      it('should return 404 if ship not found', async () => {
        const req = createRequest({
          params: { shipId: 'nonexistent' },
          body: { captainId: 'user-456' },
        });
        const res = MockResponse.create();
        mockOrgShipService.assignCaptain.mockResolvedValue(null);

        await controller.assignCaptain(req as any, res);

        expect(res.status).toHaveBeenCalledWith(404);
      });
    });

    describe('assignCrew', () => {
      it('should assign entire crew successfully', async () => {
        const req = createRequest({
          params: { shipId: 'ship-123' },
          body: { crewIds: ['user-1', 'user-2', 'user-3'] },
        });
        const res = MockResponse.create();
        const mockShip = { id: 'ship-123', assignedCrew: ['user-1', 'user-2', 'user-3'] };
        mockOrgShipService.assignCrew.mockResolvedValue(mockShip as any);

        await controller.assignCrew(req as any, res);

        expect(mockOrgShipService.assignCrew).toHaveBeenCalledWith('test-org-id', 'ship-123', [
          'user-1',
          'user-2',
          'user-3',
        ]);
        expect(res.json).toHaveBeenCalledWith(mockShip);
      });

      it('should throw error if crewIds not an array', async () => {
        const req = createRequest({
          params: { shipId: 'ship-123' },
          body: { crewIds: 'not-array' },
        });
        const res = MockResponse.create();

        await controller.assignCrew(req as any, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('addCrewMember', () => {
      it('should add crew member successfully', async () => {
        const req = createRequest({
          params: { shipId: 'ship-123', userId: 'user-456' },
        });
        const res = MockResponse.create();
        const mockShip = { id: 'ship-123', assignedCrew: ['user-456'] };
        mockOrgShipService.addCrewMember.mockResolvedValue(mockShip as any);

        await controller.addCrewMember(req as any, res);

        expect(mockOrgShipService.addCrewMember).toHaveBeenCalledWith(
          'test-org-id',
          'ship-123',
          'user-456',
          undefined
        );
        expect(res.json).toHaveBeenCalledWith(mockShip);
      });

      it('should return 404 if ship not found', async () => {
        const req = createRequest({
          params: { shipId: 'nonexistent', userId: 'user-456' },
        });
        const res = MockResponse.create();
        mockOrgShipService.addCrewMember.mockResolvedValue(null);

        await controller.addCrewMember(req as any, res);

        expect(res.status).toHaveBeenCalledWith(404);
      });
    });

    describe('removeCrewMember', () => {
      it('should remove crew member successfully', async () => {
        const req = createRequest({
          params: { shipId: 'ship-123', userId: 'user-456' },
        });
        const res = MockResponse.create();
        const mockShip = { id: 'ship-123', assignedCrew: [] };
        mockOrgShipService.removeCrewMember.mockResolvedValue(mockShip as any);

        await controller.removeCrewMember(req as any, res);

        expect(mockOrgShipService.removeCrewMember).toHaveBeenCalledWith(
          'test-org-id',
          'ship-123',
          'user-456'
        );
        expect(res.json).toHaveBeenCalledWith(mockShip);
      });

      it('should return 404 if ship not found', async () => {
        const req = createRequest({
          params: { shipId: 'nonexistent', userId: 'user-456' },
        });
        const res = MockResponse.create();
        mockOrgShipService.removeCrewMember.mockResolvedValue(null);

        await controller.removeCrewMember(req as any, res);

        expect(res.status).toHaveBeenCalledWith(404);
      });
    });
  });

  describe('Specialized Queries', () => {
    describe('getShipsNeedingMaintenance', () => {
      it('should retrieve ships needing maintenance', async () => {
        const req = createRequest();
        const res = MockResponse.create();
        const mockShips = [
          { id: 'ship-1', needsMaintenance: true },
          { id: 'ship-2', needsMaintenance: true },
        ];
        mockOrgShipService.getShipsNeedingMaintenance.mockResolvedValue(mockShips as any);

        await controller.getShipsNeedingMaintenance(req as any, res);

        expect(mockOrgShipService.getShipsNeedingMaintenance).toHaveBeenCalledWith('test-org-id');
        expect(res.json).toHaveBeenCalledWith(mockShips);
      });
    });

    describe('getCapitalShips', () => {
      it('should retrieve capital ships', async () => {
        const req = createRequest({ query: { page: '1', limit: '10' } });
        const res = MockResponse.create();
        const mockResult = {
          data: [{ id: 'ship-1', isCapital: true }],
          pagination: { page: 1, limit: 10, total: 1 },
        };
        mockOrgShipService.getCapitalShips.mockResolvedValue(mockResult as any);

        await controller.getCapitalShips(req as any, res);

        expect(mockOrgShipService.getCapitalShips).toHaveBeenCalledWith(
          'test-org-id',
          expect.any(Object)
        );
        expect(res.json).toHaveBeenCalledWith(mockResult);
      });
    });

    describe('getShipsByRole', () => {
      it('should retrieve ships by role', async () => {
        const req = createRequest({
          params: { role: OrgShipRole.COMBAT },
          query: { page: '1', limit: '10' },
        });
        const res = MockResponse.create();
        const mockResult = {
          data: [{ id: 'ship-1', role: OrgShipRole.COMBAT }],
          pagination: { page: 1, limit: 10, total: 1 },
        };
        mockOrgShipService.getShipsByRole.mockResolvedValue(mockResult as any);

        await controller.getShipsByRole(req as any, res);

        expect(mockOrgShipService.getShipsByRole).toHaveBeenCalledWith(
          'test-org-id',
          OrgShipRole.COMBAT,
          expect.any(Object)
        );
        expect(res.json).toHaveBeenCalledWith(mockResult);
      });

      it('should throw error if role not provided', async () => {
        const req = createRequest({
          params: {},
        });
        const res = MockResponse.create();

        await controller.getShipsByRole(req as any, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('getAvailableShips', () => {
      it('should retrieve available ships', async () => {
        const req = createRequest({ query: { page: '1', limit: '10' } });
        const res = MockResponse.create();
        const mockResult = {
          data: [{ id: 'ship-1', isAvailable: true }],
          pagination: { page: 1, limit: 10, total: 1 },
        };
        mockOrgShipService.getAvailableShips.mockResolvedValue(mockResult as any);

        await controller.getAvailableShips(req as any, res);

        expect(mockOrgShipService.getAvailableShips).toHaveBeenCalledWith(
          'test-org-id',
          expect.any(Object)
        );
        expect(res.json).toHaveBeenCalledWith(mockResult);
      });
    });
  });

  describe('Analytics', () => {
    describe('getFleetSummary', () => {
      it('should retrieve fleet summary', async () => {
        const req = createRequest();
        const res = MockResponse.create();
        const mockSummary = {
          totalShips: 50,
          capitalShips: 5,
          availableShips: 40,
          byRole: {
            [OrgShipRole.COMBAT]: 15,
            [OrgShipRole.EXPLORATION]: 10,
            [OrgShipRole.MINING]: 8,
            [OrgShipRole.LOGISTICS]: 17,
          },
        };
        mockOrgShipService.getFleetSummary.mockResolvedValue(mockSummary);

        await controller.getFleetSummary(req as any, res);

        expect(mockOrgShipService.getFleetSummary).toHaveBeenCalledWith('test-org-id');
        expect(res.json).toHaveBeenCalledWith(mockSummary);
      });
    });
  });
});
