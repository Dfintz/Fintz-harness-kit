import { Request, Response } from 'express';

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { AppDataSource } from '../../config/database';
import { HealthController } from '../../controllers/healthController';
import { realtimeResilienceDiagnosticsService } from '../../services/monitoring/RealtimeResilienceDiagnosticsService';

describe('HealthController', () => {
  let healthController: HealthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    healthController = new HealthController();
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Reset mocks
    (AppDataSource.query as jest.Mock).mockClear();
  });

  describe('getHealth', () => {
    it('should return healthy status when database is connected', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ result: 1 }]);
      process.env.DISCORD_BOT_TOKEN = 'test-token';

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'OK',
          database: 'connected',
          discordBot: 'configured',
        })
      );
    });

    it('should return degraded status when database is not initialized', async () => {
      (AppDataSource as any).isInitialized = false;

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DEGRADED',
          database: 'not initialized',
        })
      );
    });

    it('should return degraded status when database query fails', async () => {
      (AppDataSource as any).isInitialized = true;
      (AppDataSource.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DEGRADED',
          database: 'error',
        })
      );
    });

    it('should include timestamp and uptime in response', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ result: 1 }]);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs).toHaveProperty('timestamp');
      expect(callArgs).toHaveProperty('uptime');
      expect(typeof callArgs.uptime).toBe('number');
    });

    it('should indicate when Discord bot is not configured', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ result: 1 }]);
      delete process.env.DISCORD_BOT_TOKEN;

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          discordBot: 'not configured',
        })
      );
    });
  });

  describe('getRealtimeDiagnostics', () => {
    it('should return realtime diagnostics snapshot', async () => {
      realtimeResilienceDiagnosticsService.resetForTests();
      realtimeResilienceDiagnosticsService.recordIpcRequest('test:action', 0);

      await healthController.getRealtimeDiagnostics(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          ipc: expect.objectContaining({
            requestsTotal: 1,
          }),
          websocket: expect.any(Object),
        })
      );
    });
  });

  describe('getIpcHealth', () => {
    beforeEach(() => {
      realtimeResilienceDiagnosticsService.resetForTests();
    });

    it('returns 200 with a healthy verdict when IPC is idle', async () => {
      await healthController.getIpcHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          reasons: [],
          timestamp: expect.any(String),
          signals: expect.objectContaining({ requestsTotal: 0 }),
        })
      );
    });

    it('returns 503 with an unhealthy verdict when the success rate collapses', async () => {
      for (let i = 0; i < 8; i++) {
        realtimeResilienceDiagnosticsService.recordIpcRequest('test:action', 0);
        realtimeResilienceDiagnosticsService.recordIpcResponse('test:action', true, 10);
      }
      for (let i = 0; i < 12; i++) {
        realtimeResilienceDiagnosticsService.recordIpcRequest('test:action', 0);
        realtimeResilienceDiagnosticsService.recordIpcResponse('test:action', false, 10, 'failed');
      }

      await healthController.getIpcHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          reasons: expect.arrayContaining(['low_success_rate']),
        })
      );
    });
  });
});
