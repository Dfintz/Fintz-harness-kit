import { Request, Response } from 'express';
import { OrganizationControllerV2 } from '../../../controllers/v2/organizationController';
import { AllianceService } from '../../../services/organization/AllianceService';
import {
  createMockOrganizationContext,
  createStandardMockResponse,
  type MockOrgQueryBuilder,
  type MockOrgRepository,
  shutdownEnhancedCacheService,
} from './organizationControllerV2.testUtils';

// Mock the services
jest.mock('../../../services/organization/AllianceService');
jest.mock('../../../services/organization/MemberActivityService');
jest.mock('../../../services/organization/OnlinePresenceService');
jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('OrganizationControllerV2 - Alliance Methods', () => {
  let controller: OrganizationControllerV2;
  let mockAllianceService: jest.Mocked<AllianceService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockOrgQueryBuilder: MockOrgQueryBuilder;
  let mockOrgRepository: MockOrgRepository;

  beforeEach(() => {
    const { AppDataSource } = require('../../../config/database');

    const { mockOrgQueryBuilder: queryBuilder, mockOrgRepository: orgRepository } =
      createMockOrganizationContext();

    mockOrgQueryBuilder = queryBuilder;
    mockOrgRepository = orgRepository;

    AppDataSource.getRepository.mockReturnValue(mockOrgRepository);

    mockResponse = createStandardMockResponse({ includePaginated: true });

    // Create controller
    controller = new OrganizationControllerV2();

    // Get mocked alliance service
    mockAllianceService = (controller as any).allianceService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    shutdownEnhancedCacheService();
  });

  describe('getAlliances', () => {
    it('should return alliance details', async () => {
      const orgId = 'org-123';
      const mockAllianceDetails = [
        {
          relationship: {
            id: 'rel-1',
            targetOrganizationId: 'org-999',
            trustScore: 85,
          },
          healthScore: 85,
          trustLevel: 'High Trust',
        },
      ];

      mockRequest = {
        params: { orgId },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      mockAllianceService.getAllianceDetails = jest.fn().mockResolvedValue(mockAllianceDetails);

      await controller.getAlliances(mockRequest as Request, mockResponse as Response);

      expect(mockAllianceService.getAllianceDetails).toHaveBeenCalledWith(orgId);
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          alliances: mockAllianceDetails,
          count: 1,
        })
      );
    });
  });

  describe('getAllianceStatistics', () => {
    it('should return alliance statistics', async () => {
      const orgId = 'org-123';
      const mockStatistics = {
        total: 5,
        averageHealth: 80,
        strong: 3,
        needingReview: 1,
        mutual: 4,
        mutualPercentage: 80,
      };

      mockRequest = {
        params: { orgId },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      mockAllianceService.getAllianceStatistics = jest.fn().mockResolvedValue(mockStatistics);

      await controller.getAllianceStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockAllianceService.getAllianceStatistics).toHaveBeenCalledWith(orgId);
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          statistics: mockStatistics,
        })
      );
    });
  });

  describe('getSharedActivities', () => {
    it('should return shared activities with pagination', async () => {
      const orgId = 'org-123';
      const mockActivities = [
        { id: 'act-1', title: 'Activity 1', organizationId: orgId },
        { id: 'act-2', title: 'Activity 2', organizationId: 'org-999' },
      ];

      mockRequest = {
        params: { orgId },
        queryParams: { limit: 20, offset: 0 },
        query: { limit: '20', offset: '0' },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      mockAllianceService.getSharedActivities = jest.fn().mockResolvedValue({
        activities: mockActivities,
        total: 2,
      });

      await controller.getSharedActivities(mockRequest as Request, mockResponse as Response);

      expect(mockAllianceService.getSharedActivities).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({ limit: 20, offset: 0 })
      );
      expect(mockResponse.paginated).toHaveBeenCalledWith(
        mockActivities,
        expect.objectContaining({
          total: 2,
          limit: 20,
          offset: 0,
        }),
        expect.any(Object) // HATEOAS links
      );
    });
  });
});
