/**
 * Trading Controller V2 - Price Alerts Tests
 * Tests the price alert CRUD endpoints
 */

import { Request, Response } from 'express';

import { TradingControllerV2 } from '../../controllers/v2/tradingController';
import { ApiError } from '../../middleware/errorHandlerV2';

// Mock dependencies used by other tradingController methods so the module can load
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    }),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../websocket/controllers/tradingWebSocketController', () => ({
  emitRouteCreated: jest.fn(),
  emitRouteDeleted: jest.fn(),
  emitRouteStatusChanged: jest.fn(),
  emitRouteUpdated: jest.fn(),
}));

// Mock PriceAlertService (used via dynamic import in controller)
const mockGetUserAlerts = jest.fn();
const mockCreateAlert = jest.fn();
const mockGetAlert = jest.fn();
const mockUpdateAlert = jest.fn();
const mockDeleteAlert = jest.fn();
const mockGetFeedStatus = jest.fn();

const mockServiceInstance = {
  getUserAlerts: mockGetUserAlerts,
  createAlert: mockCreateAlert,
  getAlert: mockGetAlert,
  updateAlert: mockUpdateAlert,
  deleteAlert: mockDeleteAlert,
};

jest.mock('../../services/trade/trading/PriceAlertService', () => ({
  PriceAlertService: {
    getInstance: () => mockServiceInstance,
  },
}));

jest.mock('../../services/trade/trading/UEXPriceFeed', () => ({
  UEXPriceFeed: jest.fn().mockImplementation(() => ({
    getStatus: mockGetFeedStatus,
  })),
}));

describe('TradingControllerV2 - Price Alerts', () => {
  let controller: TradingControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new TradingControllerV2();

    mockResponse = {
      success: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      user: { id: 'user-123' } as Record<string, unknown>,
      params: {},
      body: {},
      query: {},
    };

    jest.clearAllMocks();
  });

  // ==================== listPriceAlerts ====================

  describe('listPriceAlerts', () => {
    it('should return alerts for the authenticated user', async () => {
      const alerts = [
        {
          id: 'alert_1',
          userId: 'user-123',
          commodity: 'Laranite',
          condition: 'above',
          threshold: 30,
          enabled: true,
        },
        {
          id: 'alert_2',
          userId: 'user-123',
          commodity: 'Agricium',
          condition: 'below',
          threshold: 25,
          enabled: false,
        },
      ];
      mockGetUserAlerts.mockResolvedValue(alerts);

      await controller.listPriceAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockGetUserAlerts).toHaveBeenCalledWith('user-123');
      expect(mockResponse.success).toHaveBeenCalledWith(alerts);
    });

    it('should throw 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await expect(
        controller.listPriceAlerts(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);

      await expect(
        controller.listPriceAlerts(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 500 on service failure', async () => {
      mockGetUserAlerts.mockRejectedValue(new Error('DB connection error'));

      await expect(
        controller.listPriceAlerts(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });
  });

  // ==================== createPriceAlert ====================

  describe('createPriceAlert', () => {
    const validBody = {
      commodity: 'Laranite',
      condition: 'above',
      threshold: 30,
      location: 'Area18',
    };

    it('should create an alert and return 201', async () => {
      mockRequest.body = { ...validBody };
      const createdAlert = { id: 'alert_new', userId: 'user-123', ...validBody, enabled: true };
      mockCreateAlert.mockResolvedValue(createdAlert);

      await controller.createPriceAlert(mockRequest as Request, mockResponse as Response);

      expect(mockCreateAlert).toHaveBeenCalledWith({
        userId: 'user-123',
        commodity: 'Laranite',
        condition: 'above',
        threshold: 30,
        location: 'Area18',
        enabled: true,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdAlert,
      });
    });

    it('should default location to null and enabled to true', async () => {
      mockRequest.body = { commodity: 'Agricium', condition: 'below', threshold: 20 };
      mockCreateAlert.mockResolvedValue({ id: 'alert_x' });

      await controller.createPriceAlert(mockRequest as Request, mockResponse as Response);

      expect(mockCreateAlert).toHaveBeenCalledWith(
        expect.objectContaining({ location: undefined, enabled: true })
      );
    });

    it('should respect explicit enabled=false', async () => {
      mockRequest.body = { ...validBody, enabled: false };
      mockCreateAlert.mockResolvedValue({ id: 'alert_x' });

      await controller.createPriceAlert(mockRequest as Request, mockResponse as Response);

      expect(mockCreateAlert).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    });

    it('should throw 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { ...validBody };

      await expect(
        controller.createPriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });

    it('should throw 500 on service failure', async () => {
      mockRequest.body = { ...validBody };
      mockCreateAlert.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.createPriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });
  });

  // ==================== updatePriceAlert ====================

  describe('updatePriceAlert', () => {
    it('should update an alert owned by the user', async () => {
      mockRequest.params = { id: 'alert_1' };
      mockRequest.body = { enabled: false };
      mockGetAlert.mockResolvedValue({ id: 'alert_1', userId: 'user-123', enabled: true });
      mockUpdateAlert.mockResolvedValue({ id: 'alert_1', userId: 'user-123', enabled: false });

      await controller.updatePriceAlert(mockRequest as Request, mockResponse as Response);

      expect(mockGetAlert).toHaveBeenCalledWith('alert_1');
      expect(mockUpdateAlert).toHaveBeenCalledWith('alert_1', { enabled: false });
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('should throw 404 when alert does not exist', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { enabled: false };
      mockGetAlert.mockResolvedValue(null);

      await expect(
        controller.updatePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);

      await expect(
        controller.updatePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 404 when alert belongs to another user', async () => {
      mockRequest.params = { id: 'alert_1' };
      mockRequest.body = { enabled: false };
      mockGetAlert.mockResolvedValue({ id: 'alert_1', userId: 'other-user' });

      await expect(
        controller.updatePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });

    it('should throw 404 when updateAlert returns null', async () => {
      mockRequest.params = { id: 'alert_1' };
      mockRequest.body = { threshold: 50 };
      mockGetAlert.mockResolvedValue({ id: 'alert_1', userId: 'user-123' });
      mockUpdateAlert.mockResolvedValue(null);

      await expect(
        controller.updatePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });

    it('should throw 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'alert_1' };

      await expect(
        controller.updatePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });
  });

  // ==================== deletePriceAlert ====================

  describe('deletePriceAlert', () => {
    it('should delete an alert owned by the user', async () => {
      mockRequest.params = { id: 'alert_1' };
      mockGetAlert.mockResolvedValue({ id: 'alert_1', userId: 'user-123' });
      mockDeleteAlert.mockResolvedValue(true);

      await controller.deletePriceAlert(mockRequest as Request, mockResponse as Response);

      expect(mockGetAlert).toHaveBeenCalledWith('alert_1');
      expect(mockDeleteAlert).toHaveBeenCalledWith('alert_1');
      expect(mockResponse.success).toHaveBeenCalledWith({
        message: 'Price alert deleted successfully',
      });
    });

    it('should throw 404 when alert does not exist', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockGetAlert.mockResolvedValue(null);

      await expect(
        controller.deletePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });

    it('should throw 404 when alert belongs to another user', async () => {
      mockRequest.params = { id: 'alert_1' };
      mockGetAlert.mockResolvedValue({ id: 'alert_1', userId: 'other-user' });

      await expect(
        controller.deletePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });

    it('should throw 404 when deleteAlert returns false', async () => {
      mockRequest.params = { id: 'alert_1' };
      mockGetAlert.mockResolvedValue({ id: 'alert_1', userId: 'user-123' });
      mockDeleteAlert.mockResolvedValue(false);

      await expect(
        controller.deletePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });

    it('should throw 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'alert_1' };

      await expect(
        controller.deletePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });

    it('should throw 500 on service failure', async () => {
      mockRequest.params = { id: 'alert_1' };
      mockGetAlert.mockResolvedValue({ id: 'alert_1', userId: 'user-123' });
      mockDeleteAlert.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.deletePriceAlert(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });
  });

  // ==================== getPriceFeedStatus ====================

  describe('getPriceFeedStatus', () => {
    const originalApiUrl = process.env.UEX_API_URL;
    const originalApiKey = process.env.UEX_API_KEY;

    afterEach(() => {
      if (originalApiUrl === undefined) {
        delete process.env.UEX_API_URL;
      } else {
        process.env.UEX_API_URL = originalApiUrl;
      }

      if (originalApiKey === undefined) {
        delete process.env.UEX_API_KEY;
      } else {
        process.env.UEX_API_KEY = originalApiKey;
      }
    });

    it('should return provider status payload when UEX is healthy', async () => {
      process.env.UEX_API_URL = 'https://uex.example/api';
      process.env.UEX_API_KEY = 'configured-key';

      mockGetFeedStatus.mockReturnValue({
        name: 'UEX',
        healthy: true,
        details: { status: 'api-key-configured' },
      });

      await controller.getPriceFeedStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.success).toHaveBeenCalledWith({
        provider: 'UEX',
        healthy: true,
        apiUrl: 'https://uex.example/api',
        apiKeyConfigured: true,
        status: 'api-key-configured',
      });
    });

    it('should return unhealthy payload when API key is not configured', async () => {
      process.env.UEX_API_URL = 'https://uex.example/api';
      delete process.env.UEX_API_KEY;

      mockGetFeedStatus.mockReturnValue({
        name: 'UEX',
        healthy: false,
      });

      await controller.getPriceFeedStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.success).toHaveBeenCalledWith({
        provider: 'UEX',
        healthy: false,
        apiUrl: 'https://uex.example/api',
        apiKeyConfigured: false,
      });
    });

    it('should throw ApiError when provider status fails', async () => {
      mockGetFeedStatus.mockImplementation(() => {
        throw new Error('UEX unavailable');
      });

      await expect(
        controller.getPriceFeedStatus(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);
    });
  });
});
