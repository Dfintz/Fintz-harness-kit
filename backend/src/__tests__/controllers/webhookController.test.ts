/**
 * WebhookController Unit Tests
 *
 * Tests webhook management operations
 * Covers CRUD operations, testing, event triggering, and statistics
 */

import { Request } from 'express';

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { WebhookController } from '../../controllers/webhookController';
import { WebhookEventType } from '../../models/Webhook';
import { WebhookService } from '../../services/communication/webhooks/WebhookService';
import { MockResponse } from '../helpers/testHelpers.helper';

// Mock dependencies
jest.mock('../../services/communication/webhooks/WebhookService');
describe('WebhookController', () => {
  const validWebhookId = '11111111-1111-4111-8111-111111111111';
  const missingWebhookId = '22222222-2222-4222-8222-222222222222';

  let controller: WebhookController;
  let mockWebhookService: jest.Mocked<WebhookService>;

  // Helper to create authenticated request with organization context
  const createAuthRequest = (overrides: any = {}) => ({
    user: {
      id: 'test-user-id',
      username: 'testuser',
      role: 'user',
      currentOrganizationId: 'org-123',
    },
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked service instance
    mockWebhookService = {
      createWebhook: jest.fn(),
      getWebhooksByOrganization: jest.fn(),
      getWebhookById: jest.fn(),
      updateWebhook: jest.fn(),
      deleteWebhook: jest.fn(),
      testWebhook: jest.fn(),
      triggerEvent: jest.fn(),
      getStatistics: jest.fn(),
    } as any;

    controller = new WebhookController();
    (controller as any).webhookService = mockWebhookService;
  });

  describe('createWebhook', () => {
    it('should create webhook successfully', async () => {
      const req = createAuthRequest({
        body: {
          name: 'Test Webhook',
          customConfig: { url: 'https://example.com/webhook', method: 'POST' },
          events: [WebhookEventType.FLEET_CREATED],
          secret: 'secret123',
        },
      });
      const res = MockResponse.create();
      const mockWebhook = {
        id: 'webhook-1',
        name: 'Test Webhook',
        customConfig: { url: 'https://example.com/webhook/', method: 'POST' },
        organizationId: 'org-123',
        createdBy: 'test-user-id',
      };
      mockWebhookService.createWebhook.mockResolvedValue(mockWebhook as any);

      await controller.createWebhook(req as any, res);

      expect(mockWebhookService.createWebhook).toHaveBeenCalledWith(
        'org-123',
        expect.objectContaining({
          name: 'Test Webhook',
          createdBy: 'test-user-id',
          customConfig: expect.objectContaining({
            url: 'https://example.com/webhook',
            method: 'POST',
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockWebhook);
    });

    it('should return 401 if user not authenticated', async () => {
      const req = createAuthRequest({ user: undefined });
      const res = MockResponse.create();

      await controller.createWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if no organization context', async () => {
      const req = createAuthRequest({
        user: { id: 'test-user-id', username: 'testuser', role: 'user' },
      });
      const res = MockResponse.create();

      await controller.createWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle service errors', async () => {
      const req = createAuthRequest({
        body: { name: 'Test', url: 'https://example.com' },
      });
      const res = MockResponse.create();
      mockWebhookService.createWebhook.mockRejectedValue(new Error('Database error'));

      await controller.createWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getWebhooks', () => {
    it('should retrieve all webhooks for organization', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      const mockWebhooks = [
        { id: 'webhook-1', name: 'Webhook 1' },
        { id: 'webhook-2', name: 'Webhook 2' },
      ];
      mockWebhookService.getWebhooksByOrganization.mockResolvedValue(mockWebhooks as any);

      await controller.getWebhooks(req as any, res);

      expect(mockWebhookService.getWebhooksByOrganization).toHaveBeenCalledWith('org-123');
      expect(res.json).toHaveBeenCalledWith(mockWebhooks);
    });

    it('should return empty array if no webhooks', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      mockWebhookService.getWebhooksByOrganization.mockResolvedValue([]);

      await controller.getWebhooks(req as any, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getWebhook', () => {
    it('should retrieve specific webhook by ID', async () => {
      const req = createAuthRequest({
        params: { id: 'webhook-1' },
      });
      const res = MockResponse.create();
      const mockWebhook = { id: 'webhook-1', name: 'Webhook 1', organizationId: 'org-123' };
      mockWebhookService.getWebhookById.mockResolvedValue(mockWebhook as any);

      await controller.getWebhook(req as any, res);

      expect(mockWebhookService.getWebhookById).toHaveBeenCalledWith('webhook-1');
      expect(res.json).toHaveBeenCalledWith(mockWebhook);
    });

    it('should return 404 if webhook not found', async () => {
      const req = createAuthRequest({
        params: { id: 'nonexistent' },
      });
      const res = MockResponse.create();
      mockWebhookService.getWebhookById.mockResolvedValue(null);

      await controller.getWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if webhook belongs to different organization', async () => {
      const req = createAuthRequest({
        params: { id: 'webhook-1' },
      });
      const res = MockResponse.create();
      const mockWebhook = { id: 'webhook-1', name: 'Webhook 1', organizationId: 'other-org' };
      mockWebhookService.getWebhookById.mockResolvedValue(mockWebhook as any);

      await controller.getWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook successfully', async () => {
      const req = createAuthRequest({
        params: { id: 'webhook-1' },
        body: { name: 'Updated Webhook', enabled: false },
      });
      const res = MockResponse.create();
      const existingWebhook = { id: 'webhook-1', organizationId: 'org-123' };
      const updatedWebhook = { id: 'webhook-1', name: 'Updated Webhook', enabled: false };
      mockWebhookService.getWebhookById.mockResolvedValue(existingWebhook as any);
      mockWebhookService.updateWebhook.mockResolvedValue(updatedWebhook as any);

      await controller.updateWebhook(req as any, res);

      expect(mockWebhookService.updateWebhook).toHaveBeenCalledWith('webhook-1', {
        name: 'Updated Webhook',
        enabled: false,
      });
      expect(res.json).toHaveBeenCalledWith(updatedWebhook);
    });

    it('should return 404 if webhook not found', async () => {
      const req = createAuthRequest({
        params: { id: 'nonexistent' },
        body: { name: 'Updated' },
      });
      const res = MockResponse.create();
      mockWebhookService.getWebhookById.mockResolvedValue(null);

      await controller.updateWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if webhook belongs to different organization', async () => {
      const req = createAuthRequest({
        params: { id: 'webhook-1' },
        body: { name: 'Updated' },
      });
      const res = MockResponse.create();
      const existingWebhook = { id: 'webhook-1', organizationId: 'other-org' };
      mockWebhookService.getWebhookById.mockResolvedValue(existingWebhook as any);

      await controller.updateWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook successfully', async () => {
      const req = createAuthRequest({
        params: { id: validWebhookId },
      });
      const res = MockResponse.create();
      const existingWebhook = { id: validWebhookId, organizationId: 'org-123' };
      mockWebhookService.getWebhookById.mockResolvedValue(existingWebhook as any);
      mockWebhookService.deleteWebhook.mockResolvedValue(undefined);

      await controller.deleteWebhook(req as any, res);

      expect(mockWebhookService.deleteWebhook).toHaveBeenCalledWith(validWebhookId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Webhook deleted successfully' });
    });

    it('should return 404 if webhook not found', async () => {
      const req = createAuthRequest({
        params: { id: missingWebhookId },
      });
      const res = MockResponse.create();
      mockWebhookService.getWebhookById.mockResolvedValue(null);

      await controller.deleteWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if webhook belongs to different organization', async () => {
      const req = createAuthRequest({
        params: { id: validWebhookId },
      });
      const res = MockResponse.create();
      const existingWebhook = { id: validWebhookId, organizationId: 'other-org' };
      mockWebhookService.getWebhookById.mockResolvedValue(existingWebhook as any);

      await controller.deleteWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('testWebhook', () => {
    it('should return success when test is successful', async () => {
      const req = createAuthRequest({
        params: { id: validWebhookId },
      });
      const res = MockResponse.create();
      const existingWebhook = { id: validWebhookId, organizationId: 'org-123' };
      mockWebhookService.getWebhookById.mockResolvedValue(existingWebhook as any);
      mockWebhookService.testWebhook.mockResolvedValue({
        success: true,
        responseTime: 150,
        statusCode: 200,
      });

      await controller.testWebhook(req as any, res);

      expect(mockWebhookService.testWebhook).toHaveBeenCalledWith(existingWebhook);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Webhook test successful',
        success: true,
        responseTime: 150,
        statusCode: 200,
      });
    });

    it('should return 400 when test fails', async () => {
      const req = createAuthRequest({
        params: { id: validWebhookId },
      });
      const res = MockResponse.create();
      const existingWebhook = { id: validWebhookId, organizationId: 'org-123' };
      mockWebhookService.getWebhookById.mockResolvedValue(existingWebhook as any);
      mockWebhookService.testWebhook.mockResolvedValue({
        success: false,
        error: 'Connection timeout',
      });

      await controller.testWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Webhook test failed',
        success: false,
        error: 'Connection timeout',
      });
    });

    it('should return 404 if webhook not found', async () => {
      const req = createAuthRequest({
        params: { id: missingWebhookId },
      });
      const res = MockResponse.create();
      mockWebhookService.getWebhookById.mockResolvedValue(null);

      await controller.testWebhook(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('triggerEvent', () => {
    it('should trigger event successfully', async () => {
      const req = createAuthRequest({
        body: {
          event: WebhookEventType.FLEET_CREATED,
          data: { fleetId: 'fleet-123', name: 'New Fleet' },
        },
      });
      const res = MockResponse.create();
      const mockResult = { triggered: 3, failed: 0 };
      mockWebhookService.getWebhooksByOrganization.mockResolvedValue([]);
      mockWebhookService.triggerEvent.mockResolvedValue(mockResult);

      await controller.triggerEvent(req as any, res);

      expect(mockWebhookService.triggerEvent).toHaveBeenCalledWith(
        'org-123',
        WebhookEventType.FLEET_CREATED,
        { fleetId: 'fleet-123', name: 'New Fleet' }
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 for invalid event type', async () => {
      const req = createAuthRequest({
        body: { event: 'invalid.event.type', data: {} },
      });
      const res = MockResponse.create();

      await controller.triggerEvent(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if event is missing', async () => {
      const req = createAuthRequest({
        body: { data: {} },
      });
      const res = MockResponse.create();

      await controller.triggerEvent(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should use empty object if data not provided', async () => {
      const req = createAuthRequest({
        body: { event: WebhookEventType.FLEET_CREATED },
      });
      const res = MockResponse.create();
      mockWebhookService.getWebhooksByOrganization.mockResolvedValue([]);
      mockWebhookService.triggerEvent.mockResolvedValue({ triggered: 1 });

      await controller.triggerEvent(req as any, res);

      expect(mockWebhookService.triggerEvent).toHaveBeenCalledWith(
        'org-123',
        WebhookEventType.FLEET_CREATED,
        {}
      );
    });
  });

  describe('getStatistics', () => {
    it('should retrieve webhook statistics', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      const mockStats = {
        totalWebhooks: 5,
        activeWebhooks: 4,
        totalDeliveries: 1000,
        successRate: 0.98,
        failedDeliveries: 20,
      };
      mockWebhookService.getStatistics.mockResolvedValue(mockStats);

      await controller.getStatistics(req as any, res);

      expect(mockWebhookService.getStatistics).toHaveBeenCalledWith('org-123');
      expect(res.json).toHaveBeenCalledWith(mockStats);
    });

    it('should handle statistics error', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      mockWebhookService.getStatistics.mockRejectedValue(new Error('Stats error'));

      await controller.getStatistics(req as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getDeliveryHistory', () => {
    it('should retrieve delivery history with pagination', async () => {
      const req = createAuthRequest({
        params: { id: 'webhook-1' },
        query: { page: '1', limit: '10' },
      });
      const res = MockResponse.create();
      const mockWebhook = {
        id: 'webhook-1',
        organizationId: 'org-123',
        deliveryHistory: [
          { id: 'd1', timestamp: new Date(), success: true },
          { id: 'd2', timestamp: new Date(), success: false },
        ],
      };
      mockWebhookService.getWebhookById.mockResolvedValue(mockWebhook as any);

      await controller.getDeliveryHistory(req as any, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
          }),
        })
      );
    });

    it('should return 404 if webhook not found', async () => {
      const req = createAuthRequest({
        params: { id: 'nonexistent' },
        query: {},
      });
      const res = MockResponse.create();
      mockWebhookService.getWebhookById.mockResolvedValue(null);

      await controller.getDeliveryHistory(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if webhook belongs to different organization', async () => {
      const req = createAuthRequest({
        params: { id: 'webhook-1' },
        query: {},
      });
      const res = MockResponse.create();
      const mockWebhook = { id: 'webhook-1', organizationId: 'other-org' };
      mockWebhookService.getWebhookById.mockResolvedValue(mockWebhook as any);

      await controller.getDeliveryHistory(req as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getEventTypes', () => {
    it('should return all available event types', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();

      await controller.getEventTypes(req as Request, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            value: expect.any(String),
            label: expect.any(String),
            category: expect.any(String),
          }),
        ])
      );
    });

    it('should format event labels correctly', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();

      await controller.getEventTypes(req as Request, res);

      const result = (res.json as jest.Mock).mock.calls[0][0];
      // Check that at least one event type is properly formatted
      const hasFormattedLabels = result.some(
        (item: any) =>
          item.label.includes(' ') || item.label.charAt(0) === item.label.charAt(0).toUpperCase()
      );
      expect(hasFormattedLabels || result.length === 0).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle service throwing errors gracefully', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      mockWebhookService.getWebhooksByOrganization.mockRejectedValue(
        new Error('Database connection failed')
      );

      await controller.getWebhooks(req as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should handle null organization ID gracefully', async () => {
      const req = createAuthRequest({
        user: {
          id: 'test-user-id',
          username: 'testuser',
          role: 'user',
          currentOrganizationId: null,
        },
      });
      const res = MockResponse.create();

      await controller.getWebhooks(req as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
