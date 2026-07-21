/**
 * OrganizationControllerV2 - Member Ships Tests
 *
 * Tests for organization member ship viewing and classification features
 */

import { Request, Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { OrganizationControllerV2 } from '../../../controllers/v2/organizationController';
import { Organization, OrganizationStatus, OrganizationType } from '../../../models/Organization';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { ShipOwnershipStatus, UserShip } from '../../../models/UserShip';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../middleware/queryParser');

const mockQueryParser = require('../../../middleware/queryParser');

describe('OrganizationControllerV2 - Member Ships', () => {
  let controller: OrganizationControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockOrgQueryBuilder: any;
  let mockOrgRepository: any;
  let mockMemberRepository: any;
  let mockShipRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'org-123',
        name: 'Test Organization',
        status: OrganizationStatus.ACTIVE,
        type: OrganizationType.ROOT,
      }),
    };

    // Mock organization repository
    mockOrgRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockOrgQueryBuilder),
    };

    // Mock member repository
    mockMemberRepository = {
      find: jest.fn().mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-123', role: 'member' },
        { userId: 'user-2', organizationId: 'org-123', role: 'member' },
        { userId: 'user-3', organizationId: 'org-123', role: 'leader' },
      ]),
      findOne: jest.fn(),
    };

    // Mock ship repository
    mockShipRepository = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'ship-1',
          userId: 'user-1',
          shipName: 'Aurora MR',
          visibleToOrganization: true,
        },
        {
          id: 'ship-2',
          userId: 'user-2',
          shipName: 'Cutlass Black',
          visibleToOrganization: true,
        },
        {
          id: 'ship-3',
          userId: 'user-3',
          shipName: 'Constellation',
          visibleToOrganization: true,
        },
      ]),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === Organization) return mockOrgRepository;
      if (entity === OrganizationMembership) return mockMemberRepository;
      if (entity === UserShip) return mockShipRepository;
      return {};
    });

    controller = new OrganizationControllerV2();

    mockQueryParser.buildHateoasLinks.mockReturnValue({
      self: '/api/v2/organizations/org-123/members/ships?offset=0&limit=20',
      first: '/api/v2/organizations/org-123/members/ships?offset=0&limit=20',
      last: '/api/v2/organizations/org-123/members/ships?offset=0&limit=20',
    });

    mockRequest = {
      params: { orgId: 'org-123' },
      queryParams: {
        limit: 20,
        offset: 0,
        sort: null,
        filters: {},
        fields: null,
        search: null,
      },
    };

    mockResponse = {
      paginated: jest.fn(),
      success: jest.fn(),
    };
  });

  afterAll(() => {
    const { enhancedCacheService } = require('../../../services/caching/EnhancedCacheService');
    enhancedCacheService.shutdown();
  });

  describe('getOrganizationMemberShips', () => {
    it('should get all member ships for organization', async () => {
      await controller.getOrganizationMemberShips(mockRequest as Request, mockResponse as Response);

      expect(mockOrgRepository.createQueryBuilder).toHaveBeenCalledWith('organization');
      expect(mockOrgQueryBuilder.where).toHaveBeenCalledWith('organization.id = :id', {
        id: 'org-123',
      });
      expect(mockMemberRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', isActive: true },
        select: ['userId'],
      });
      expect(mockShipRepository.where).toHaveBeenCalledWith('ship.userId IN (:...userIds)', {
        userIds: ['user-1', 'user-2', 'user-3'],
      });
      expect(mockShipRepository.andWhere).toHaveBeenCalledWith(
        'ship.visibleToOrganization = :visible',
        {
          visible: true,
        }
      );
      expect(mockResponse.paginated).toHaveBeenCalled();
    });

    it('should return 404 if organization not found', async () => {
      mockOrgQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        controller.getOrganizationMemberShips(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Organization not found');
    });

    it('should return empty results when organization has no members', async () => {
      mockMemberRepository.find.mockResolvedValue([]);

      await controller.getOrganizationMemberShips(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.paginated).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ total: 0 }),
        expect.any(Object)
      );
    });

    it('should filter by manufacturer', async () => {
      mockRequest.queryParams.filters = { manufacturer: 'Origin' };

      await controller.getOrganizationMemberShips(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.andWhere).toHaveBeenCalledWith(
        'ship.manufacturer = :manufacturer',
        { manufacturer: 'Origin' }
      );
    });

    it('should filter by status', async () => {
      mockRequest.queryParams.filters = { status: ShipOwnershipStatus.OWNED };

      await controller.getOrganizationMemberShips(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.andWhere).toHaveBeenCalledWith('ship.status = :status', {
        status: ShipOwnershipStatus.OWNED,
      });
    });

    it('should filter by sharing level', async () => {
      mockRequest.queryParams.filters = { sharingLevel: 'organization' };

      await controller.getOrganizationMemberShips(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.andWhere).toHaveBeenCalledWith(
        'ship.sharingLevel = :sharingLevel',
        { sharingLevel: 'organization' }
      );
    });

    it('should apply custom sorting', async () => {
      mockRequest.queryParams.sort = { field: 'shipName', order: 'ASC' };

      await controller.getOrganizationMemberShips(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.orderBy).toHaveBeenCalledWith('ship.shipName', 'ASC');
    });
  });

  describe('classifyMemberShip', () => {
    beforeEach(() => {
      mockRequest = {
        params: { orgId: 'org-123', shipId: 'ship-1' },
        body: { reason: 'Under maintenance' },
        user: { id: 'leader-123' },
      } as any;

      mockMemberRepository.findOne.mockResolvedValue({
        userId: 'leader-123',
        organizationId: 'org-123',
        role: 'leader',
      });

      mockShipRepository.findOne.mockResolvedValue({
        id: 'ship-1',
        userId: 'user-1',
        shipName: 'Aurora MR',
        visibleToOrganization: true,
      });

      mockShipRepository.save.mockImplementation(ship => Promise.resolve(ship));
    });

    it('should classify ship successfully', async () => {
      await controller.classifyMemberShip(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          visibleToOrganization: false,
          classificationChangedBy: 'leader-123',
          classificationReason: 'Under maintenance',
        })
      );
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Ship classified successfully',
        })
      );
    });

    it('should require leader role to classify', async () => {
      mockMemberRepository.findOne.mockResolvedValue({
        userId: 'leader-123',
        organizationId: 'org-123',
        role: 'member',
      });

      await expect(
        controller.classifyMemberShip(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Only organization leaders can classify ships');
    });

    it('should verify user is member of organization', async () => {
      mockMemberRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.classifyMemberShip(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('You are not a member of this organization');
    });

    it('should verify ship exists', async () => {
      mockShipRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.classifyMemberShip(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Ship not found');
    });

    it('should verify ship owner is organization member', async () => {
      // First call for leader verification
      mockMemberRepository.findOne
        .mockResolvedValueOnce({
          userId: 'leader-123',
          organizationId: 'org-123',
          role: 'leader',
        })
        // Second call for ship owner verification
        .mockResolvedValueOnce(null);

      await expect(
        controller.classifyMemberShip(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Ship owner is not a member of this organization');
    });

    it('should use default reason if not provided', async () => {
      mockRequest.body = {};

      await controller.classifyMemberShip(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          classificationReason: 'Classified by organization leader',
        })
      );
    });
  });

  describe('declassifyMemberShip', () => {
    beforeEach(() => {
      mockRequest = {
        params: { orgId: 'org-123', shipId: 'ship-1' },
        body: { reason: 'Maintenance complete' },
        user: { id: 'leader-123' },
      } as any;

      mockMemberRepository.findOne.mockResolvedValue({
        userId: 'leader-123',
        organizationId: 'org-123',
        role: 'admin',
      });

      mockShipRepository.findOne.mockResolvedValue({
        id: 'ship-1',
        userId: 'user-1',
        shipName: 'Aurora MR',
        visibleToOrganization: false,
      });

      mockShipRepository.save.mockImplementation(ship => Promise.resolve(ship));
    });

    it('should declassify ship successfully', async () => {
      await controller.declassifyMemberShip(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          visibleToOrganization: true,
          classificationChangedBy: 'leader-123',
          classificationReason: 'Maintenance complete',
        })
      );
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Ship declassified successfully',
        })
      );
    });

    it('should allow admin role to declassify', async () => {
      mockMemberRepository.findOne.mockResolvedValue({
        userId: 'leader-123',
        organizationId: 'org-123',
        role: 'admin',
      });

      await controller.declassifyMemberShip(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.save).toHaveBeenCalled();
    });

    it('should allow officer role to declassify', async () => {
      mockMemberRepository.findOne.mockResolvedValue({
        userId: 'leader-123',
        organizationId: 'org-123',
        role: 'officer',
      });

      await controller.declassifyMemberShip(mockRequest as Request, mockResponse as Response);

      expect(mockShipRepository.save).toHaveBeenCalled();
    });

    it('should reject non-leader roles', async () => {
      mockMemberRepository.findOne.mockResolvedValue({
        userId: 'leader-123',
        organizationId: 'org-123',
        role: 'recruit',
      });

      await expect(
        controller.declassifyMemberShip(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Only organization leaders can declassify ships');
    });

    it('should set timestamp when declassifying', async () => {
      const beforeTime = new Date();

      await controller.declassifyMemberShip(mockRequest as Request, mockResponse as Response);

      const savedShip = mockShipRepository.save.mock.calls[0][0];
      expect(savedShip.classificationChangedAt).toBeInstanceOf(Date);
      expect(savedShip.classificationChangedAt.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
    });
  });
});
