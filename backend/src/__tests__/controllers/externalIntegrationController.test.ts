import { Request, Response } from 'express';

import { ExternalIntegrationController } from '../../controllers/externalIntegrationController';
import { ExternalIntegrationService } from '../../services/external/ExternalIntegrationService';
import { FleetService } from '../../services/fleet/FleetService';

jest.mock('../../services/external/ExternalIntegrationService');
jest.mock('../../services/external', () => ({
  ExternalIntegrationService: jest.requireMock('../../services/external/ExternalIntegrationService')
    .ExternalIntegrationService,
}));
jest.mock('../../services/fleet/FleetService');

describe('ExternalIntegrationController', () => {
  const validIntegrationId = '11111111-1111-4111-8111-111111111111';

  let controller: ExternalIntegrationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockService: jest.Mocked<ExternalIntegrationService>;
  let mockFleetService: jest.Mocked<FleetService>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      params: {},
      body: {},
      query: {},
      user: { id: 'user-123', currentOrganizationId: 'org-123' },
    };

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    controller = new ExternalIntegrationController();
    mockService = (controller as any).integrationService;
    mockFleetService = (controller as any).fleetService;

    jest.clearAllMocks();

    // Default mock for verifyIntegrationOwnership - returns integration
    mockService.getIntegrationById.mockResolvedValue({
      id: 'default-integration',
      fleetId: 'fleet-123',
    } as any);

    // Default mock for FleetService - returns fleet for happy path
    mockFleetService.getFleetById.mockResolvedValue({
      id: 'fleet-123',
      organizationId: 'org-123',
      name: 'Test Fleet',
    } as any);
  });

  describe('createIntegration', () => {
    it('should create integration successfully', async () => {
      const mockDto = {
        fleetId: 'fleet-123',
        name: 'Test Integration',
        type: 'webhook',
        config: { url: 'https://example.com/webhook' },
      };

      const mockIntegration = {
        id: 'integration-123',
        ...mockDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.body = mockDto;
      mockService.createIntegration.mockResolvedValue(mockIntegration as any);

      await controller.createIntegration(mockRequest as Request, mockResponse as Response);

      expect(mockService.createIntegration).toHaveBeenCalledWith(mockDto);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockIntegration);
    });

    it('should handle errors gracefully', async () => {
      mockRequest.body = { name: 'Test' };
      mockService.createIntegration.mockRejectedValue(new Error('Database error'));

      await controller.createIntegration(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Database error' }),
        })
      );
    });
  });

  describe('getIntegrations', () => {
    it('should get integrations for fleet successfully', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };

      const mockIntegrations = [
        { id: 'integration-1', name: 'Integration 1', fleetId: 'fleet-123' },
        { id: 'integration-2', name: 'Integration 2', fleetId: 'fleet-123' },
      ];

      mockService.getIntegrations.mockResolvedValue(mockIntegrations as any);

      await controller.getIntegrations(mockRequest as Request, mockResponse as Response);

      expect(mockService.getIntegrations).toHaveBeenCalledWith('fleet-123');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(mockIntegrations);
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockService.getIntegrations.mockRejectedValue(new Error('Database error'));

      await controller.getIntegrations(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Database error' }),
        })
      );
    });
  });

  describe('getIntegration', () => {
    it('should get integration by ID successfully', async () => {
      mockRequest.params = { id: 'integration-123' };

      const mockIntegration = {
        id: 'integration-123',
        name: 'Test Integration',
        fleetId: 'fleet-123',
      };

      mockService.getIntegrationById.mockResolvedValue(mockIntegration as any);

      await controller.getIntegration(mockRequest as Request, mockResponse as Response);

      expect(mockService.getIntegrationById).toHaveBeenCalledWith('integration-123');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(mockIntegration);
    });

    it('should return 404 if integration not found', async () => {
      mockRequest.params = { id: 'integration-123' };
      mockService.getIntegrationById.mockResolvedValue(null);

      await controller.getIntegration(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Integration not found' }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: 'integration-123' };
      mockService.getIntegrationById.mockRejectedValue(new Error('Database error'));

      await controller.getIntegration(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Database error' }),
        })
      );
    });
  });

  describe('updateIntegration', () => {
    it('should update integration successfully', async () => {
      mockRequest.params = { id: 'integration-123' };
      mockRequest.body = { name: 'Updated Integration' };

      const mockIntegration = {
        id: 'integration-123',
        name: 'Updated Integration',
        fleetId: 'fleet-123',
      };

      mockService.updateIntegration.mockResolvedValue(mockIntegration as any);

      await controller.updateIntegration(mockRequest as Request, mockResponse as Response);

      expect(mockService.updateIntegration).toHaveBeenCalledWith('integration-123', {
        name: 'Updated Integration',
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(mockIntegration);
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: 'integration-123' };
      mockRequest.body = { name: 'Updated Integration' };
      mockService.updateIntegration.mockRejectedValue(new Error('Update failed'));

      await controller.updateIntegration(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Update failed' }),
        })
      );
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration successfully', async () => {
      mockRequest.params = { id: 'integration-123' };
      mockService.deleteIntegration.mockResolvedValue(undefined);

      await controller.deleteIntegration(mockRequest as Request, mockResponse as Response);

      expect(mockService.deleteIntegration).toHaveBeenCalledWith('integration-123');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Integration deleted successfully' });
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: 'integration-123' };
      mockService.deleteIntegration.mockRejectedValue(new Error('Delete failed'));

      await controller.deleteIntegration(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Delete failed' }),
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return success when connection test succeeds', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockService.testConnection.mockResolvedValue({ success: true, responseTime: 120 });

      await controller.testConnection(mockRequest as Request, mockResponse as Response);

      expect(mockService.testConnection).toHaveBeenCalledWith(validIntegrationId);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Connection successful',
        success: true,
        responseTime: 120,
      });
    });

    it('should return failure when connection test fails', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockService.testConnection.mockResolvedValue({ success: false, error: 'Test error' });

      await controller.testConnection(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Connection failed',
        success: false,
        error: 'Test error',
      });
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockService.testConnection.mockRejectedValue(new Error('Test failed'));

      await controller.testConnection(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Test failed' }),
        })
      );
    });
  });

  describe('syncInventory', () => {
    it('should sync inventory successfully', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockRequest.body = {
        categories: ['weapons', 'shields'],
        fullSync: true,
        dryRun: false,
      };

      const mockResult = {
        success: true,
        itemsSynced: 52,
        duration: 1500,
        errors: [],
        changes: {
          created: 10,
          updated: 42,
          deleted: 0,
        },
      };

      mockService.syncInventory.mockResolvedValue(mockResult);

      await controller.syncInventory(mockRequest as Request, mockResponse as Response);

      expect(mockService.syncInventory).toHaveBeenCalledWith({
        integrationId: validIntegrationId,
        categories: ['weapons', 'shields'],
        fullSync: true,
        dryRun: false,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(mockResult);
    });

    it('should use default values if not provided', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockRequest.body = {};

      mockService.syncInventory.mockResolvedValue({ success: true } as any);

      await controller.syncInventory(mockRequest as Request, mockResponse as Response);

      expect(mockService.syncInventory).toHaveBeenCalledWith({
        integrationId: validIntegrationId,
        categories: undefined,
        fullSync: false,
        dryRun: false,
      });
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockRequest.body = {};
      mockService.syncInventory.mockRejectedValue(new Error('Sync failed'));

      await controller.syncInventory(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Sync failed' }),
        })
      );
    });
  });

  describe('sendWebhook', () => {
    it('should send webhook successfully', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockRequest.body = {
        event: 'inventory.updated',
        data: { itemId: 'item-123', quantity: 50 },
      };

      mockService.sendWebhook.mockResolvedValue({ success: true, statusCode: 200 });

      await controller.sendWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockService.sendWebhook).toHaveBeenCalledWith(validIntegrationId, {
        event: 'inventory.updated',
        data: { itemId: 'item-123', quantity: 50 },
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Webhook sent successfully',
        success: true,
        statusCode: 200,
      });
    });

    it('should return failure when webhook not sent', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockRequest.body = { event: 'test.event', data: {} };
      mockService.sendWebhook.mockResolvedValue({ success: false, error: 'Test error' });

      await controller.sendWebhook(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Webhook not sent',
        success: false,
        error: 'Test error',
      });
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: validIntegrationId };
      mockRequest.body = { event: 'test.event', data: {} };
      mockService.sendWebhook.mockRejectedValue(new Error('Webhook failed'));

      await controller.sendWebhook(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Webhook failed' }),
        })
      );
    });
  });
});
