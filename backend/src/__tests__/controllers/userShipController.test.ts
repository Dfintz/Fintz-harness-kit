/**
 * UserShipController Unit Tests
 *
 * Tests user ship management operations
 * Covers CRUD operations, loan management, and analytics
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { UserShipController } from '../../controllers/userShipController';
import { ShipCondition, ShipOwnershipStatus } from '../../models/UserShip';
import { UserShipService } from '../../services/ship';
import { MockResponse } from '../helpers/testHelpers.helper';

// Mock dependencies
jest.mock('../../services/ship');
describe('UserShipController', () => {
  let controller: UserShipController;
  let mockUserShipService: jest.Mocked<UserShipService>;

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
    mockUserShipService = {
      findUserShips: jest.fn(),
      getUserShipById: jest.fn(),
      createUserShip: jest.fn(),
      updateUserShip: jest.fn(),
      deleteUserShip: jest.fn(),
      loanShip: jest.fn(),
      returnLoanedShip: jest.fn(),
      getOrgAvailableShips: jest.fn(),
      getUserShipSummary: jest.fn(),
    } as any;

    controller = new UserShipController();
    (controller as any).userShipService = mockUserShipService;
  });

  describe('getUserShips', () => {
    it('should retrieve user ships with filters', async () => {
      const req = createRequest({
        params: { userId: 'user-123' },
        query: {
          status: ShipOwnershipStatus.OWNED,
          condition: ShipCondition.EXCELLENT,
          page: '1',
          limit: '20',
        },
      });
      const res = MockResponse.create();
      const mockResult = {
        data: [{ id: 'ship-1', shipId: 'aurora', status: ShipOwnershipStatus.OWNED }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      mockUserShipService.findUserShips.mockResolvedValue(mockResult as any);

      await controller.getUserShips(req as any, res);

      expect(mockUserShipService.findUserShips).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          userId: 'user-123',
          status: ShipOwnershipStatus.OWNED,
        }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should use current user if userId not in params', async () => {
      const req = createRequest({ params: {}, query: {} });
      const res = MockResponse.create();
      mockUserShipService.findUserShips.mockResolvedValue({ data: [], pagination: {} } as any);

      await controller.getUserShips(req as any, res);

      expect(mockUserShipService.findUserShips).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ userId: 'test-user-id' }),
        expect.any(Object)
      );
    });

    it('should throw error without organization context', async () => {
      const req = createRequest({ organizationId: undefined, user: {} });
      const res = MockResponse.create();

      await controller.getUserShips(req as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getUserShipById', () => {
    it('should retrieve ship by ID', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
      });
      const res = MockResponse.create();
      const mockShip = { id: 'ship-123', shipId: 'constellation', userId: 'user-1' };
      mockUserShipService.getUserShipById.mockResolvedValue(mockShip as any);

      await controller.getUserShipById(req as any, res);

      expect(mockUserShipService.getUserShipById).toHaveBeenCalledWith('ship-123');
      expect(res.json).toHaveBeenCalledWith(mockShip);
    });

    it('should return 404 if ship not found', async () => {
      const req = createRequest({
        params: { shipId: 'nonexistent' },
      });
      const res = MockResponse.create();
      mockUserShipService.getUserShipById.mockResolvedValue(null);

      await controller.getUserShipById(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createUserShip', () => {
    it('should create user ship successfully', async () => {
      const req = createRequest({
        params: { userId: 'user-123' },
        body: {
          shipId: 'aurora',
          name: 'My Aurora',
          status: ShipOwnershipStatus.OWNED,
        },
      });
      const res = MockResponse.create();
      const mockShip = { id: 'ship-new', shipId: 'aurora', userId: 'user-123' };
      mockUserShipService.createUserShip.mockResolvedValue(mockShip as any);

      await controller.createUserShip(req as any, res);

      expect(mockUserShipService.createUserShip).toHaveBeenCalledWith(
        expect.objectContaining({
          shipId: 'aurora',
          userId: 'user-123',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockShip);
    });

    it('should use current user if userId not in params', async () => {
      const req = createRequest({
        params: {},
        body: { shipId: 'aurora' },
      });
      const res = MockResponse.create();
      mockUserShipService.createUserShip.mockResolvedValue({} as any);

      await controller.createUserShip(req as any, res);

      expect(mockUserShipService.createUserShip).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'test-user-id' })
      );
    });

    it('should throw error without organization context', async () => {
      const req = createRequest({
        organizationId: undefined,
        user: {},
        body: { shipId: 'aurora' },
      });
      const res = MockResponse.create();

      await controller.createUserShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateUserShip', () => {
    it('should update user ship successfully', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
        body: {
          name: 'Updated Name',
          condition: ShipCondition.GOOD,
        },
      });
      const res = MockResponse.create();
      const mockShip = { id: 'ship-123', name: 'Updated Name' };
      mockUserShipService.updateUserShip.mockResolvedValue(mockShip as any);

      await controller.updateUserShip(req as any, res);

      expect(mockUserShipService.updateUserShip).toHaveBeenCalledWith(
        '',
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
      mockUserShipService.updateUserShip.mockResolvedValue(null);

      await controller.updateUserShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteUserShip', () => {
    it('should delete user ship successfully', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
      });
      const res = MockResponse.create();
      mockUserShipService.deleteUserShip.mockResolvedValue(true);

      await controller.deleteUserShip(req as any, res);

      expect(mockUserShipService.deleteUserShip).toHaveBeenCalledWith('', 'ship-123');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 404 if ship not found', async () => {
      const req = createRequest({
        params: { shipId: 'nonexistent' },
      });
      const res = MockResponse.create();
      mockUserShipService.deleteUserShip.mockResolvedValue(false);

      await controller.deleteUserShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('loanShip', () => {
    it('should loan ship successfully', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
        body: {
          scope: 'organization',
          endDate: '2024-12-31T23:59:59Z',
          purpose: 'Fleet operation',
        },
      });
      const res = MockResponse.create();
      const mockShip = { id: 'ship-123', loanedTo: 'test-org-id', isLoaned: true };
      mockUserShipService.loanShip.mockResolvedValue(mockShip as any);

      await controller.loanShip(req as any, res);

      expect(mockUserShipService.loanShip).toHaveBeenCalledWith(
        'test-org-id',
        'ship-123',
        'test-org-id',
        expect.objectContaining({
          scope: 'organization',
          purpose: 'Fleet operation',
        })
      );
      expect(res.json).toHaveBeenCalledWith(mockShip);
    });

    it('should return 500 if organization context is missing', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
        body: { scope: 'organization' },
      });
      // Remove org context to trigger 'Organization context required'
      (req as any).organizationId = undefined;
      if ((req as any).user) (req as any).user.organizationId = undefined;
      const res = MockResponse.create();

      await controller.loanShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should return 404 if ship not found or cannot be loaned', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
        body: { scope: 'organization' },
      });
      const res = MockResponse.create();
      mockUserShipService.loanShip.mockResolvedValue(null);

      await controller.loanShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('returnLoanedShip', () => {
    it('should return loaned ship successfully', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
      });
      const res = MockResponse.create();
      const mockShip = { id: 'ship-123', loanedTo: null, isLoaned: false };
      mockUserShipService.returnLoanedShip.mockResolvedValue(mockShip as any);

      await controller.returnLoanedShip(req as any, res);

      expect(mockUserShipService.returnLoanedShip).toHaveBeenCalledWith('test-org-id', 'ship-123');
      expect(res.json).toHaveBeenCalledWith(mockShip);
    });

    it('should return 404 if ship not found or not on loan', async () => {
      const req = createRequest({
        params: { shipId: 'ship-123' },
      });
      const res = MockResponse.create();
      mockUserShipService.returnLoanedShip.mockResolvedValue(null);

      await controller.returnLoanedShip(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getOrgAvailableShips', () => {
    it('should retrieve available ships for organization', async () => {
      const req = createRequest();
      const res = MockResponse.create();
      const mockShips = [
        { id: 'ship-1', sharingLevel: 'organization' },
        { id: 'ship-2', sharingLevel: 'alliance' },
      ];
      mockUserShipService.getOrgAvailableShips.mockResolvedValue(mockShips as any);

      await controller.getOrgAvailableShips(req as any, res);

      expect(mockUserShipService.getOrgAvailableShips).toHaveBeenCalledWith('test-org-id');
      expect(res.json).toHaveBeenCalledWith(mockShips);
    });
  });

  describe('getUserShipSummary', () => {
    it('should retrieve user ship summary', async () => {
      const req = createRequest({
        params: { userId: 'user-123' },
      });
      const res = MockResponse.create();
      const mockSummary = {
        totalShips: 10,
        ownedShips: 8,
        loanedShips: 2,
        byCondition: { excellent: 5, good: 3, fair: 2 },
      };
      mockUserShipService.getUserShipSummary.mockResolvedValue(mockSummary);

      await controller.getUserShipSummary(req as any, res);

      expect(mockUserShipService.getUserShipSummary).toHaveBeenCalledWith('', 'user-123');
      expect(res.json).toHaveBeenCalledWith(mockSummary);
    });

    it('should use current user if userId not in params', async () => {
      const req = createRequest({ params: {} });
      const res = MockResponse.create();
      mockUserShipService.getUserShipSummary.mockResolvedValue({});

      await controller.getUserShipSummary(req as any, res);

      expect(mockUserShipService.getUserShipSummary).toHaveBeenCalledWith('', 'test-user-id');
    });
  });

  describe('getShipsNeedingInsurance', () => {
    it('should throw not implemented error', async () => {
      const req = createRequest({
        params: { userId: 'user-123' },
        query: { daysBeforeExpiry: '30' },
      });
      const res = MockResponse.create();

      await controller.getShipsNeedingInsurance(req as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
