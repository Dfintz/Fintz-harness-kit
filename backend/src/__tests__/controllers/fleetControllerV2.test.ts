/**
 * FleetControllerV2 Integration Tests
 *
 * Tests for Fleet-Ship relationship management via FleetShip join table
 * Part of Fleet Management MVP implementation
 */

import { Request } from 'express';
import { Repository } from 'typeorm';

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../websocket/controllers/fleetWebSocketController', () => ({
  emitFleetCreated: jest.fn(),
  emitFleetUpdated: jest.fn(),
  emitFleetDeleted: jest.fn(),
}));

const mockAutoCreateTeamForFleet = jest
  .fn()
  .mockImplementation((_orgId: string, fleet: unknown) => Promise.resolve(fleet));
const mockSyncTeamCapacity = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/fleet/FleetTeamService', () => ({
  FleetTeamService: {
    getInstance: () => ({
      autoCreateTeamForFleet: mockAutoCreateTeamForFleet,
      syncTeamCapacity: mockSyncTeamCapacity,
    }),
  },
}));

const mockAddShipToFleet = jest.fn();
const mockRemoveShipFromFleet = jest.fn();
const mockCreateFleet = jest.fn();
const mockPostCreateFleet = jest.fn();
const mockGetFleetTree = jest.fn();
const mockMoveFleet = jest.fn();
const mockReorderFleets = jest.fn();

jest.mock('../../services/fleet/FleetService', () => ({
  FleetService: jest.fn().mockImplementation(() => ({
    addShipToFleet: mockAddShipToFleet,
    removeShipFromFleet: mockRemoveShipFromFleet,
    createFleet: mockCreateFleet,
    postCreateFleet: mockPostCreateFleet,
    getFleetTree: mockGetFleetTree,
    moveFleet: mockMoveFleet,
    reorderFleets: mockReorderFleets,
  })),
}));

import { FleetControllerV2 } from '../../controllers/v2/fleetController';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Fleet } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { Ship } from '../../models/Ship';
import { PermissionManagerService } from '../../services/security/permissions/PermissionManagerService';
import { ApiErrorCode } from '../../types/api';
import { emitFleetUpdated } from '../../websocket/controllers/fleetWebSocketController';
import { MockRequest, MockResponse } from '../helpers/testHelpers.helper';

describe('FleetControllerV2 - FleetShip Relationship', () => {
  let controller: FleetControllerV2;
  let mockFleetRepo: jest.Mocked<Repository<Fleet>>;
  let mockShipRepo: jest.Mocked<Repository<Ship>>;
  let mockFleetShipRepo: jest.Mocked<Repository<FleetShip>>;

  const TEST_ORG_ID = 'org-123';
  const TEST_FLEET_ID = 'fleet-456';
  const TEST_SHIP_ID = 'ship-789';
  const TEST_USER_ID = 'user-101';

  const mockFleet: Fleet = {
    id: TEST_FLEET_ID,
    name: 'Test Fleet',
    organizationId: TEST_ORG_ID,
    members: [],
    shipIds: [],
    status: 'active' as any,
    type: 'combat' as any,
    maxMembers: 50,
    isPublic: false,
    allowApplications: false,
    color: '#00d9ff',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Fleet;

  const mockShip: Ship = {
    id: TEST_SHIP_ID,
    name: 'Test Ship',
    manufacturer: 'Anvil',
    organizationId: TEST_ORG_ID,
    role: 'fighter',
    size: 'medium' as any,
    status: 'flight_ready' as any,
    isActive: true,
    isVehicle: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Ship;

  // Helper to create request with user context (includes org for tenant scoping)
  const createRequest = (overrides: any = {}): Request => {
    return MockRequest.create({
      user: {
        id: TEST_USER_ID,
        username: 'testuser',
        role: 'admin',
        currentOrganizationId: TEST_ORG_ID,
      },
      params: {},
      body: {},
      ...overrides,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest
      .spyOn(PermissionManagerService.prototype, 'checkPermission')
      .mockResolvedValue({ allowed: true } as any);

    mockAutoCreateTeamForFleet.mockImplementation((_orgId: string, fleet: unknown) =>
      Promise.resolve(fleet)
    );
    mockSyncTeamCapacity.mockResolvedValue(undefined);
    mockAddShipToFleet.mockReset();
    mockRemoveShipFromFleet.mockReset();
    mockCreateFleet.mockReset();
    mockPostCreateFleet.mockReset();
    mockGetFleetTree.mockReset();
    mockMoveFleet.mockReset();
    mockReorderFleets.mockReset();

    // Mock repositories
    mockFleetRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    } as any;

    mockShipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    mockFleetShipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    // Mock AppDataSource.getRepository
    (mockAppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (!entity || entity === Fleet || entity?.name === 'Fleet') return mockFleetRepo;
      if (entity === Ship || entity?.name === 'Ship') return mockShipRepo;
      if (entity === FleetShip || entity?.name === 'FleetShip') return mockFleetShipRepo;
      throw new Error(`Unexpected entity: ${entity}`);
    });

    mockAddShipToFleet.mockResolvedValue({
      fleet: mockFleet,
      fleetShip: {
        id: 'fs-default',
        fleetId: TEST_FLEET_ID,
        shipId: TEST_SHIP_ID,
        organizationId: TEST_ORG_ID,
        assignedBy: TEST_USER_ID,
        assignedAt: new Date(),
        updatedAt: new Date(),
      } as FleetShip,
      ship: mockShip,
    });
    mockRemoveShipFromFleet.mockResolvedValue({ fleet: mockFleet });

    controller = new FleetControllerV2();
  });

  describe('addFleetMember', () => {
    it('should successfully add a ship to a fleet', async () => {
      // Arrange
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: { shipId: TEST_SHIP_ID, role: 'scout', notes: 'Primary scout' },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);

      const mockFleetShip: FleetShip = {
        id: 'fs-123',
        fleetId: TEST_FLEET_ID,
        shipId: TEST_SHIP_ID,
        organizationId: TEST_ORG_ID,
        role: 'scout',
        notes: 'Primary scout',
        assignedBy: TEST_USER_ID,
        assignedAt: new Date(),
        updatedAt: new Date(),
      } as FleetShip;

      mockAddShipToFleet.mockResolvedValue({
        fleet: mockFleet,
        fleetShip: mockFleetShip,
        ship: mockShip,
      });

      // Act
      await controller.addFleetMember(req, res);

      // Assert
      expect(mockFleetRepo.findOne).toHaveBeenCalledWith({
        where: { id: TEST_FLEET_ID },
      });
      expect(mockAddShipToFleet).toHaveBeenCalledWith(TEST_ORG_ID, TEST_FLEET_ID, TEST_SHIP_ID, {
        performedById: TEST_USER_ID,
        role: 'scout',
        notes: 'Primary scout',
      });
      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Ship added to fleet successfully',
          assignment: expect.objectContaining({
            fleetId: TEST_FLEET_ID,
            shipId: TEST_SHIP_ID,
            role: 'scout',
          }),
        })
      );
      expect(emitFleetUpdated).toHaveBeenCalledWith(TEST_ORG_ID, mockFleet, TEST_USER_ID);
    });

    it('should reject adding ship without shipId', async () => {
      // Arrange
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: {}, // Missing shipId
      });
      const res = MockResponse.create();

      // Act & Assert
      await expect(controller.addFleetMember(req, res)).rejects.toThrow(
        ApiError
      );
    });

    it('should reject adding ship to non-existent fleet', async () => {
      // Arrange
      const req = createRequest({
        params: { id: 'non-existent-fleet' },
        body: { shipId: TEST_SHIP_ID },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.addFleetMember(req, res)).rejects.toThrow(
        expect.objectContaining({
          code: ApiErrorCode.FLEET_NOT_FOUND,
          statusCode: 404,
        })
      );
    });

    it('should reject adding non-existent ship', async () => {
      // Arrange
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: { shipId: 'non-existent-ship' },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);
      mockAddShipToFleet.mockRejectedValue(
        new ApiError(ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404)
      );

      // Act & Assert
      await expect(controller.addFleetMember(req, res)).rejects.toThrow(
        expect.objectContaining({
          code: ApiErrorCode.SHIP_NOT_FOUND,
          statusCode: 404,
        })
      );
    });

    it('should reject adding ship from different organization', async () => {
      // Arrange
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: { shipId: TEST_SHIP_ID },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);
      mockAddShipToFleet.mockRejectedValue(
        new ApiError(
          ApiErrorCode.INVALID_INPUT,
          'Ship does not belong to the same organization as the fleet',
          400
        )
      );

      // Act & Assert
      await expect(controller.addFleetMember(req, res)).rejects.toThrow(
        expect.objectContaining({
          code: ApiErrorCode.INVALID_INPUT,
          message: expect.stringContaining('does not belong to the same organization'),
          statusCode: 400,
        })
      );
    });

    it('should reject adding duplicate ship assignment', async () => {
      // Arrange
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: { shipId: TEST_SHIP_ID },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);
      mockAddShipToFleet.mockRejectedValue(
        new ApiError(ApiErrorCode.RESOURCE_CONFLICT, 'Ship is already assigned to this fleet', 409)
      );

      // Act & Assert
      await expect(controller.addFleetMember(req, res)).rejects.toThrow(
        expect.objectContaining({
          code: ApiErrorCode.RESOURCE_CONFLICT,
          message: 'Ship is already assigned to this fleet',
          statusCode: 409,
        })
      );
    });

    it('should add ship without optional role and notes', async () => {
      // Arrange
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: { shipId: TEST_SHIP_ID }, // No role or notes
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);

      const mockFleetShip: FleetShip = {
        id: 'fs-123',
        fleetId: TEST_FLEET_ID,
        shipId: TEST_SHIP_ID,
        organizationId: TEST_ORG_ID,
        assignedBy: TEST_USER_ID,
        assignedAt: new Date(),
        updatedAt: new Date(),
      } as FleetShip;

      mockAddShipToFleet.mockResolvedValue({
        fleet: mockFleet,
        fleetShip: mockFleetShip,
        ship: mockShip,
      });

      // Act
      await controller.addFleetMember(req, res);

      // Assert
      expect(mockAddShipToFleet).toHaveBeenCalledWith(TEST_ORG_ID, TEST_FLEET_ID, TEST_SHIP_ID, {
        performedById: TEST_USER_ID,
        role: undefined,
        notes: undefined,
      });
      expect(res.success).toHaveBeenCalled();
    });
  });

  describe('removeFleetMember', () => {
    it('should successfully remove a ship from a fleet', async () => {
      // Arrange
      const req = createRequest({
        params: { id: TEST_FLEET_ID, shipId: TEST_SHIP_ID },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);
      mockRemoveShipFromFleet.mockResolvedValue({ fleet: mockFleet });

      // Act
      await controller.removeFleetMember(req, res);

      // Assert
      expect(mockFleetRepo.findOne).toHaveBeenCalledWith({
        where: { id: TEST_FLEET_ID },
      });
      expect(mockRemoveShipFromFleet).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_FLEET_ID,
        TEST_SHIP_ID,
        {
          performedById: TEST_USER_ID,
        }
      );
      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Ship removed from fleet successfully',
          fleetId: TEST_FLEET_ID,
          shipId: TEST_SHIP_ID,
        })
      );
      expect(emitFleetUpdated).toHaveBeenCalledWith(TEST_ORG_ID, mockFleet, TEST_USER_ID);
    });

    it('should reject removing from non-existent fleet', async () => {
      // Arrange
      const req = createRequest({
        params: { id: 'non-existent-fleet', shipId: TEST_SHIP_ID },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.removeFleetMember(req, res)).rejects.toThrow(
        expect.objectContaining({
          code: ApiErrorCode.FLEET_NOT_FOUND,
          statusCode: 404,
        })
      );
    });

    it('should reject removing ship not assigned to fleet', async () => {
      // Arrange
      const req = createRequest({
        params: { id: TEST_FLEET_ID, shipId: TEST_SHIP_ID },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);
      mockRemoveShipFromFleet.mockRejectedValue(
        new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship is not assigned to this fleet', 404)
      );

      // Act & Assert
      await expect(controller.removeFleetMember(req, res)).rejects.toThrow(
        expect.objectContaining({
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          message: 'Ship is not assigned to this fleet',
          statusCode: 404,
        })
      );
    });
  });

  describe('getFleetShips', () => {
    it('should retrieve ships assigned to a fleet', async () => {
      // Arrange
      const mockFleetShips: FleetShip[] = [
        {
          id: 'fs-1',
          fleetId: TEST_FLEET_ID,
          shipId: 'ship-1',
          organizationId: TEST_ORG_ID,
          role: 'scout',
          notes: 'Primary scout',
          assignedAt: new Date(),
          updatedAt: new Date(),
          ship: {
            ...mockShip,
            id: 'ship-1',
            name: 'Scout Ship',
          } as Ship,
        } as FleetShip,
        {
          id: 'fs-2',
          fleetId: TEST_FLEET_ID,
          shipId: 'ship-2',
          organizationId: TEST_ORG_ID,
          role: 'fighter',
          assignedAt: new Date(),
          updatedAt: new Date(),
          ship: {
            ...mockShip,
            id: 'ship-2',
            name: 'Fighter Ship',
          } as Ship,
        } as FleetShip,
      ];

      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        queryParams: {
          limit: 50,
          offset: 0,
          sort: null,
          filters: {},
          search: null,
          fields: null,
        },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);

      // Mock query builder
      const mockQueryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockFleetShips),
      };

      mockFleetShipRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await controller.getFleetShips(req, res);

      // Assert
      expect(mockFleetRepo.findOne).toHaveBeenCalledWith({
        where: { id: TEST_FLEET_ID, organizationId: TEST_ORG_ID },
      });
      expect(mockFleetShipRepo.createQueryBuilder).toHaveBeenCalledWith('fleetShip');
      expect(mockQueryBuilder.innerJoinAndSelect).toHaveBeenCalledWith('fleetShip.ship', 'ship');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('fleetShip.fleetId = :fleetId', {
        fleetId: TEST_FLEET_ID,
      });
      expect(res.paginated).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Scout Ship',
            fleetAssignment: expect.objectContaining({
              role: 'scout',
              notes: 'Primary scout',
            }),
          }),
          expect.objectContaining({
            name: 'Fighter Ship',
            fleetAssignment: expect.objectContaining({
              role: 'fighter',
            }),
          }),
        ]),
        expect.objectContaining({
          total: 2,
          limit: 50,
          offset: 0,
        }),
        expect.any(Object)
      );
    });

    it('should return 404 for non-existent fleet', async () => {
      // Arrange
      const req = createRequest({
        params: { id: 'non-existent-fleet' },
        queryParams: { limit: 50, offset: 0 },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(null);

      // Act
      await controller.getFleetShips(req, res);

      // Assert — controller now catches errors and returns JSON instead of throwing
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Fleet not found'),
          }),
        })
      );
    });
  });

  describe('getFleetMembers', () => {
    it('should retrieve fleet members via FleetShip join table', async () => {
      // Arrange
      const mockFleetShips: FleetShip[] = [
        {
          id: 'fs-1',
          fleetId: TEST_FLEET_ID,
          shipId: 'ship-1',
          organizationId: TEST_ORG_ID,
          role: 'commander',
          assignedAt: new Date('2024-01-01'),
          updatedAt: new Date(),
          ship: { ...mockShip, id: 'ship-1', name: 'Command Ship' } as Ship,
        } as FleetShip,
      ];

      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        queryParams: { limit: 20, offset: 0 },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);

      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockFleetShips),
      };

      mockFleetShipRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await controller.getFleetMembers(req, res);

      // Assert
      expect(res.paginated).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Command Ship',
            fleetAssignment: expect.objectContaining({
              role: 'commander',
            }),
          }),
        ]),
        expect.objectContaining({
          total: 1,
          limit: 20,
          offset: 0,
        }),
        expect.any(Object)
      );
    });
  });

  describe('getFleetAssignments', () => {
    it('should paginate fleet assignments with ship data', async () => {
      const mockAssignments: FleetShip[] = [
        {
          id: 'assign-1',
          fleetId: TEST_FLEET_ID,
          shipId: TEST_SHIP_ID,
          organizationId: TEST_ORG_ID,
          role: 'pilot',
          notes: 'Lead pilot',
          assignedAt: new Date('2024-01-01'),
          assignedBy: TEST_USER_ID,
          updatedAt: new Date(),
          ship: { ...mockShip },
        } as FleetShip,
      ];

      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        queryParams: { limit: 20, offset: 0 },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);

      const mockQueryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAssignments),
      };

      mockFleetShipRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await controller.getFleetAssignments(req, res);

      expect(mockFleetRepo.findOne).toHaveBeenCalledWith({
        where: { id: TEST_FLEET_ID },
      });
      expect(mockFleetShipRepo.createQueryBuilder).toHaveBeenCalledWith('fleetShip');
      expect(res.paginated).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'assign-1',
            shipId: TEST_SHIP_ID,
            role: 'pilot',
            ship: expect.objectContaining({ id: TEST_SHIP_ID }),
          }),
        ]),
        expect.objectContaining({ total: 1, limit: 20, offset: 0 }),
        expect.any(Object)
      );
    });

    it('should 404 when fleet is missing', async () => {
      const req = createRequest({ params: { id: 'missing-fleet' } });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(null);

      await expect(controller.getFleetAssignments(req, res)).rejects.toThrow(
        expect.objectContaining({ code: ApiErrorCode.FLEET_NOT_FOUND, statusCode: 404 })
      );
    });
  });

  describe('createFleetAssignment', () => {
    it('should create an assignment when data is valid', async () => {
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: { shipId: TEST_SHIP_ID, role: 'pilot', notes: 'Lead pilot' },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);

      const mockAssignment: FleetShip = {
        id: 'assign-1',
        fleetId: TEST_FLEET_ID,
        shipId: TEST_SHIP_ID,
        organizationId: TEST_ORG_ID,
        role: 'pilot',
        notes: 'Lead pilot',
        assignedBy: TEST_USER_ID,
        assignedAt: new Date(),
        updatedAt: new Date(),
      } as FleetShip;

      mockAddShipToFleet.mockResolvedValue({
        fleet: mockFleet,
        fleetShip: mockAssignment,
        ship: mockShip,
      });

      await controller.createFleetAssignment(req, res);

      expect(mockAddShipToFleet).toHaveBeenCalledWith(TEST_ORG_ID, TEST_FLEET_ID, TEST_SHIP_ID, {
        performedById: TEST_USER_ID,
        role: 'pilot',
        notes: 'Lead pilot',
      });
      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'assign-1', shipId: TEST_SHIP_ID, role: 'pilot' })
      );
    });

    it('should block duplicate assignment', async () => {
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: { shipId: TEST_SHIP_ID, role: 'pilot' },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);
      mockAddShipToFleet.mockRejectedValue(
        new ApiError(ApiErrorCode.RESOURCE_CONFLICT, 'Ship is already assigned to this fleet', 409)
      );

      await expect(
        controller.createFleetAssignment(req, res)
      ).rejects.toThrow(
        expect.objectContaining({ code: ApiErrorCode.RESOURCE_CONFLICT, statusCode: 409 })
      );
    });
  });

  describe('deleteFleetAssignment', () => {
    it('should delete an assignment', async () => {
      const req = createRequest({ params: { id: TEST_FLEET_ID, assignmentId: 'assign-1' } });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);
      mockFleetShipRepo.findOne.mockResolvedValue({
        id: 'assign-1',
        fleetId: TEST_FLEET_ID,
        shipId: TEST_SHIP_ID,
      });

      await controller.deleteFleetAssignment(req, res);

      expect(mockRemoveShipFromFleet).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_FLEET_ID,
        TEST_SHIP_ID,
        {
          performedById: TEST_USER_ID,
        }
      );
      expect(res.success).toHaveBeenCalledWith({ message: 'Assignment removed successfully' });
    });

    it('should 404 when assignment missing', async () => {
      const req = createRequest({ params: { id: TEST_FLEET_ID, assignmentId: 'missing' } });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);
      mockFleetShipRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.deleteFleetAssignment(req, res)
      ).rejects.toThrow(
        expect.objectContaining({ code: ApiErrorCode.RESOURCE_NOT_FOUND, statusCode: 404 })
      );
    });
  });

  describe('fleet sharing', () => {
    it('should return sharing defaults when present on fleet', async () => {
      const fleetWithSharing = {
        ...mockFleet,
        visibility: 'org-only',
        allowedOrganizations: ['ally-1'],
        publicViewEnabled: true,
        allowJoinRequests: true,
      } as any;

      const req = createRequest({ params: { id: TEST_FLEET_ID } });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(fleetWithSharing as Fleet);

      await controller.getFleetSharing(req, res);

      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'org-only',
          allowedOrganizations: ['ally-1'],
          publicViewEnabled: true,
          allowJoinRequests: true,
        })
      );
    });

    it('should update sharing settings and return response', async () => {
      const req = createRequest({
        params: { id: TEST_FLEET_ID },
        body: { visibility: 'public', publicViewEnabled: true },
      });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(mockFleet);

      await controller.updateFleetSharing(req, res);

      expect(mockFleetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'public', publicViewEnabled: true })
      );
      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'public', publicViewEnabled: true })
      );
    });

    it('should 404 when updating sharing for missing fleet', async () => {
      const req = createRequest({ params: { id: 'missing-fleet' }, body: {} });
      const res = MockResponse.create();

      mockFleetRepo.findOne.mockResolvedValue(null);

      await expect(controller.updateFleetSharing(req, res)).rejects.toThrow(
        expect.objectContaining({ code: ApiErrorCode.RESOURCE_NOT_FOUND, statusCode: 404 })
      );
    });
  });
});
