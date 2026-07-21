/**
 * IntegrationStatusController Unit Tests
 * Tests v2 admin integration health endpoints
 */

import { Response } from 'express';

import { IntegrationStatusController } from '../../../controllers/v2/integrationStatusController';
import { AuthRequest } from '../../../middleware/auth';
import { IntegrationStatus } from '../../../services/monitoring/IntegrationStatusService';

// Mock the service
const mockGetSystemHealth = jest.fn();
const mockGetIntegrationHealth = jest.fn();
const mockRefreshHealth = jest.fn();

jest.mock('../../../services/monitoring/IntegrationStatusService', () => ({
  IntegrationStatus: {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy',
    UNKNOWN: 'unknown',
  },
  IntegrationStatusService: {
    getInstance: () => ({
      getSystemHealth: mockGetSystemHealth,
      getIntegrationHealth: mockGetIntegrationHealth,
      refreshHealth: mockRefreshHealth,
    }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

describe('IntegrationStatusController', () => {
  let controller: IntegrationStatusController;
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;

  const mockHealthSummary = {
    overallStatus: IntegrationStatus.HEALTHY,
    timestamp: new Date(),
    integrations: [
      {
        name: 'PostgreSQL Database',
        description: 'Primary data store',
        status: IntegrationStatus.HEALTHY,
        lastCheck: new Date(),
        responseTime: 5,
      },
      {
        name: 'Redis Cache',
        description: 'Session and cache storage',
        status: IntegrationStatus.HEALTHY,
        lastCheck: new Date(),
      },
    ],
    summary: { total: 2, healthy: 2, degraded: 0, unhealthy: 0, unknown: 0 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IntegrationStatusController();

    mockReq = {
      user: { id: 'admin-1', username: 'admin', role: 'admin' },
      params: {},
      query: {},
      body: {},
    } as unknown as Partial<AuthRequest>;

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('getSystemHealth', () => {
    it('should return system health summary', async () => {
      mockGetSystemHealth.mockResolvedValue(mockHealthSummary);

      await controller.getSystemHealth(mockReq as AuthRequest, mockRes as Response);

      expect(mockGetSystemHealth).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockHealthSummary);
    });

    it('should handle service errors gracefully', async () => {
      mockGetSystemHealth.mockRejectedValue(new Error('Service unavailable'));

      await controller.getSystemHealth(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getIntegrationHealth', () => {
    it('should return specific integration health', async () => {
      const dbHealth = mockHealthSummary.integrations[0];
      mockGetIntegrationHealth.mockResolvedValue(dbHealth);
      mockReq.params = { name: 'PostgreSQL Database' };

      await controller.getIntegrationHealth(mockReq as AuthRequest, mockRes as Response);

      expect(mockGetIntegrationHealth).toHaveBeenCalledWith('PostgreSQL Database');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(dbHealth);
    });

    it('should return 404 for unknown integration', async () => {
      mockGetIntegrationHealth.mockResolvedValue(null);
      mockReq.params = { name: 'NonExistent' };

      await controller.getIntegrationHealth(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Integration with id 'NonExistent' not found",
          error: expect.objectContaining({
            code: 'RESOURCE_NOT_FOUND',
            message: "Integration with id 'NonExistent' not found",
          }),
        })
      );
    });
  });

  describe('refreshHealth', () => {
    it('should force-refresh and return updated health', async () => {
      mockRefreshHealth.mockResolvedValue(mockHealthSummary);

      await controller.refreshHealth(mockReq as AuthRequest, mockRes as Response);

      expect(mockRefreshHealth).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockHealthSummary);
    });
  });
});
