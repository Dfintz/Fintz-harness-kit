import { Request, Response } from 'express';
import { OrganizationControllerV2 } from '../../../controllers/v2/organizationController';
import { OrganizationTradingService } from '../../../services/organization/OrganizationTradingService';
import {
  createMockOrganizationContext,
  createStandardMockResponse,
  type MockOrgQueryBuilder,
  type MockOrgRepository,
  shutdownEnhancedCacheService,
} from './organizationControllerV2.testUtils';

// Mock the services
jest.mock('../../../services/organization/OrganizationTradingService');
jest.mock('../../../services/organization/MemberActivityService');
jest.mock('../../../services/organization/OnlinePresenceService');
jest.mock('../../../services/organization/AllianceService');
jest.mock('../../../services/organization/OrganizationInventoryService');
jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('OrganizationControllerV2 - Trading Methods', () => {
  let controller: OrganizationControllerV2;
  let mockTradingService: jest.Mocked<OrganizationTradingService>;
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

    mockResponse = createStandardMockResponse();

    // Create controller
    controller = new OrganizationControllerV2();

    // Get mocked trading service
    mockTradingService = (controller as any).tradingService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    shutdownEnhancedCacheService();
  });

  describe('getTradingStats', () => {
    it('should return trading statistics for organization', async () => {
      const orgId = 'org-123';
      const mockStats = {
        activeRoutes: 5,
        totalRoutes: 8,
        totalProfit: 100000,
        avgProfitPerRoute: 12500,
        topRoutes: [
          {
            id: 'route-1',
            name: 'High Profit Route',
            estimatedProfit: 25000,
            status: 'active',
            runCount: 10,
            avgProfit: 24000,
          },
        ],
      };

      mockRequest = {
        params: { orgId },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      mockTradingService.getRouteStats = jest.fn().mockResolvedValue(mockStats);

      await controller.getTradingStats(mockRequest as Request, mockResponse as Response);

      expect(mockTradingService.getRouteStats).toHaveBeenCalledWith(orgId);
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          stats: mockStats,
        })
      );
    });

    it('should handle organization not found', async () => {
      const orgId = 'nonexistent-org';

      mockRequest = {
        params: { orgId },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        controller.getTradingStats(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Organization not found');
    });
  });

  describe('getTradingProfitSummary', () => {
    it('should return profit summary for organization', async () => {
      const orgId = 'org-123';
      const mockSummary = {
        totalEstimatedProfit: 100000,
        totalActualProfit: 95000,
        totalRuns: 50,
        avgProfitPerRun: 1900,
        profitByRoute: [
          {
            routeId: 'route-1',
            routeName: 'Route 1',
            estimatedProfit: 10000,
            actualProfit: 9500,
            runs: 5,
            efficiency: 95,
          },
        ],
      };

      mockRequest = {
        params: { orgId },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      mockTradingService.getProfitSummary = jest.fn().mockResolvedValue(mockSummary);

      await controller.getTradingProfitSummary(mockRequest as Request, mockResponse as Response);

      expect(mockTradingService.getProfitSummary).toHaveBeenCalledWith(orgId);
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          summary: mockSummary,
        })
      );
    });
  });

  describe('getTradingRecommendations', () => {
    it('should return route recommendations', async () => {
      const orgId = 'org-123';
      const mockRecommendations = [
        {
          routeId: 'route-1',
          routeName: 'Profitable Route',
          estimatedProfit: 15000,
          estimatedDuration: 30,
          minCargoCapacity: 50,
          suitableShips: 3,
          profitPerMinute: 500,
          difficulty: 'Medium',
        },
      ];

      mockRequest = {
        params: { orgId },
        query: { limit: '5' },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      mockTradingService.getRouteRecommendations = jest.fn().mockResolvedValue(mockRecommendations);

      await controller.getTradingRecommendations(mockRequest as Request, mockResponse as Response);

      expect(mockTradingService.getRouteRecommendations).toHaveBeenCalledWith(orgId, 5);
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          recommendations: mockRecommendations,
          count: 1,
        })
      );
    });

    it('should use default limit if not provided', async () => {
      const orgId = 'org-123';

      mockRequest = {
        params: { orgId },
        query: {},
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      mockTradingService.getRouteRecommendations = jest.fn().mockResolvedValue([]);

      await controller.getTradingRecommendations(mockRequest as Request, mockResponse as Response);

      expect(mockTradingService.getRouteRecommendations).toHaveBeenCalledWith(orgId, 5);
    });

    it('should reject invalid limit values', async () => {
      const orgId = 'org-123';

      mockRequest = {
        params: { orgId },
        query: { limit: '25' },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      await expect(
        controller.getTradingRecommendations(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Limit must be a valid number between 1 and 20');
    });

    it('should reject non-numeric limit values', async () => {
      const orgId = 'org-123';

      mockRequest = {
        params: { orgId },
        query: { limit: 'invalid' },
      };

      mockOrgQueryBuilder.getOne.mockResolvedValue({ id: orgId, name: 'Test Org' });

      await expect(
        controller.getTradingRecommendations(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Limit must be a valid number between 1 and 20');
    });
  });
});
