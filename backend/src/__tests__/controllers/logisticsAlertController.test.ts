import { Request, Response } from 'express';

import { LogisticsAlertController } from '../../controllers/logisticsAlertController';
import {
  LogisticsAlert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  CreateAlertDto,
  UpdateAlertDto,
  AlertFilterOptions,
} from '../../models/LogisticsAlert';
import { LogisticsAlertService } from '../../services/trade/logistics/LogisticsAlertService';

// Mock dependencies
jest.mock('../../services/trade/logistics/LogisticsAlertService');
describe('LogisticsAlertController', () => {
  let controller: LogisticsAlertController;
  let mockAlertService: jest.Mocked<LogisticsAlertService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  afterAll(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock alert service
    mockAlertService = {
      createAlert: jest.fn(),
      getAlerts: jest.fn(),
      getAlertById: jest.fn(),
      updateAlert: jest.fn(),
      acknowledgeAlert: jest.fn(),
      resolveAlert: jest.fn(),
      dismissAlert: jest.fn(),
      deleteAlert: jest.fn(),
      getAlertStatistics: jest.fn(),
      checkInventoryAndGenerateAlerts: jest.fn(),
      autoResolveAlerts: jest.fn(),
    } as any;

    (LogisticsAlertService as jest.Mock).mockImplementation(() => mockAlertService);

    // Mock response
    mockJson = jest.fn();
    mockStatus = jest.fn(() => ({ json: mockJson }));
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };

    // Mock request
    mockRequest = {
      params: {},
      query: {},
      body: {},
    };

    controller = new LogisticsAlertController();
  });

  describe('createAlert', () => {
    it('should create a custom alert successfully', async () => {
      const alertDto: CreateAlertDto = {
        fleetId: 'fleet-123',
        inventoryItemId: 'item-456',
        itemName: 'Quantum Fuel',
        type: AlertType.CUSTOM,
        severity: AlertSeverity.WARNING,
        title: 'Custom Alert',
        message: 'Test message',
        recipients: [],
        notificationChannels: [],
      };

      const mockAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        ...alertDto,
        status: AlertStatus.ACTIVE,
        createdAt: new Date(),
      };

      mockRequest.body = alertDto;
      mockAlertService.createAlert.mockResolvedValue(mockAlert as LogisticsAlert);

      await controller.createAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.createAlert).toHaveBeenCalledWith(alertDto);
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(mockAlert);
    });

    it('should handle creation error', async () => {
      const alertDto: CreateAlertDto = {
        fleetId: 'fleet-123',
        inventoryItemId: 'item-789',
        itemName: 'Medical Supplies',
        type: AlertType.LOW_STOCK,
        severity: AlertSeverity.CRITICAL,
        title: 'Low Stock',
        message: 'Stock is low',
        recipients: [],
        notificationChannels: [],
      };

      mockRequest.body = alertDto;
      mockAlertService.createAlert.mockRejectedValue(new Error('Database error'));

      await controller.createAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Database error' }));
    });

    it('should handle creation error without message', async () => {
      mockRequest.body = { fleetId: 'fleet-123' };
      mockAlertService.createAlert.mockRejectedValue(new Error());

      await controller.createAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'An unexpected error occurred' })
      );
    });
  });

  describe('getAlerts', () => {
    it('should get alerts with all filters', async () => {
      const mockAlerts: Partial<LogisticsAlert>[] = [
        {
          id: 'alert-1',
          fleetId: 'fleet-123',
          type: AlertType.LOW_STOCK,
          severity: AlertSeverity.WARNING,
          status: AlertStatus.ACTIVE,
        },
        {
          id: 'alert-2',
          fleetId: 'fleet-123',
          type: AlertType.CRITICAL_STOCK,
          severity: AlertSeverity.CRITICAL,
          status: AlertStatus.ACKNOWLEDGED,
        },
      ];

      mockRequest.query = {
        fleetId: 'fleet-123',
        inventoryItemId: 'item-456',
        type: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        unacknowledgedOnly: 'true',
        activeOnly: 'true',
      };

      mockAlertService.getAlerts.mockResolvedValue(mockAlerts as LogisticsAlert[]);

      await controller.getAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.getAlerts).toHaveBeenCalledWith({
        fleetId: 'fleet-123',
        inventoryItemId: 'item-456',
        type: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        unacknowledgedOnly: true,
        activeOnly: true,
      });
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockAlerts);
    });

    it('should get alerts without filters', async () => {
      const mockAlerts: Partial<LogisticsAlert>[] = [];
      mockRequest.query = {};

      mockAlertService.getAlerts.mockResolvedValue(mockAlerts as LogisticsAlert[]);

      await controller.getAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.getAlerts).toHaveBeenCalledWith({
        fleetId: undefined,
        inventoryItemId: undefined,
        type: undefined,
        severity: undefined,
        status: undefined,
        unacknowledgedOnly: false,
        activeOnly: false,
      });
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockAlerts);
    });

    it('should handle boolean filter parsing', async () => {
      mockRequest.query = {
        unacknowledgedOnly: 'false',
        activeOnly: 'false',
      };

      mockAlertService.getAlerts.mockResolvedValue([]);

      await controller.getAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          unacknowledgedOnly: false,
          activeOnly: false,
        })
      );
    });

    it('should handle get alerts error', async () => {
      mockRequest.query = { fleetId: 'fleet-123' };
      mockAlertService.getAlerts.mockRejectedValue(new Error('Query failed'));

      await controller.getAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Query failed' }));
    });
  });

  describe('getAlert', () => {
    it('should get alert by ID successfully', async () => {
      const mockAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        fleetId: 'fleet-456',
        type: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
      };

      mockRequest.params = { id: 'alert-123' };
      mockAlertService.getAlertById.mockResolvedValue(mockAlert as LogisticsAlert);

      await controller.getAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.getAlertById).toHaveBeenCalledWith('alert-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockAlert);
    });

    it('should return 404 if alert not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockAlertService.getAlertById.mockResolvedValue(null);

      await controller.getAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Alert not found' })
      );
    });

    it('should handle get alert error', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockAlertService.getAlertById.mockRejectedValue(new Error('Database error'));

      await controller.getAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Database error' }));
    });
  });

  describe('updateAlert', () => {
    it('should update alert successfully', async () => {
      const updateDto: UpdateAlertDto = {
        status: AlertStatus.ACKNOWLEDGED,
        resolutionNotes: 'Updated notes',
      };

      const mockUpdatedAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        ...updateDto,
        status: AlertStatus.ACTIVE,
      };

      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = updateDto;
      mockAlertService.updateAlert.mockResolvedValue(mockUpdatedAlert as LogisticsAlert);

      await controller.updateAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.updateAlert).toHaveBeenCalledWith('alert-123', updateDto);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockUpdatedAlert);
    });

    it('should handle partial update', async () => {
      const updateDto: UpdateAlertDto = {
        status: AlertStatus.RESOLVED,
      };

      const mockUpdatedAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        severity: AlertSeverity.URGENT,
      };

      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = updateDto;
      mockAlertService.updateAlert.mockResolvedValue(mockUpdatedAlert as LogisticsAlert);

      await controller.updateAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.updateAlert).toHaveBeenCalledWith('alert-123', updateDto);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should handle update error', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = { status: AlertStatus.RESOLVED };
      mockAlertService.updateAlert.mockRejectedValue(new Error('Update failed'));

      await controller.updateAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Update failed' }));
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert successfully', async () => {
      const mockAcknowledgedAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: 'user-456',
        acknowledgedAt: new Date(),
      };

      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = { userId: 'user-456' };
      mockAlertService.acknowledgeAlert.mockResolvedValue(mockAcknowledgedAlert as LogisticsAlert);

      await controller.acknowledgeAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.acknowledgeAlert).toHaveBeenCalledWith('alert-123', 'user-456');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockAcknowledgedAlert);
    });

    it('should handle acknowledge error', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = { userId: 'user-456' };
      mockAlertService.acknowledgeAlert.mockRejectedValue(new Error('Acknowledge failed'));

      await controller.acknowledgeAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Acknowledge failed' })
      );
    });

    it('should handle missing userId', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = {};
      mockAlertService.acknowledgeAlert.mockResolvedValue({} as LogisticsAlert);

      await controller.acknowledgeAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.acknowledgeAlert).toHaveBeenCalledWith('alert-123', undefined);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert with notes successfully', async () => {
      const mockResolvedAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        status: AlertStatus.RESOLVED,
        resolvedBy: 'user-789',
        resolvedAt: new Date(),
      };

      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = { userId: 'user-789', notes: 'Issue fixed' };
      mockAlertService.resolveAlert.mockResolvedValue(mockResolvedAlert as LogisticsAlert);

      await controller.resolveAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.resolveAlert).toHaveBeenCalledWith(
        'alert-123',
        'user-789',
        'Issue fixed'
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockResolvedAlert);
    });

    it('should resolve alert without notes', async () => {
      const mockResolvedAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        status: AlertStatus.RESOLVED,
      };

      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = { userId: 'user-789' };
      mockAlertService.resolveAlert.mockResolvedValue(mockResolvedAlert as LogisticsAlert);

      await controller.resolveAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.resolveAlert).toHaveBeenCalledWith(
        'alert-123',
        'user-789',
        undefined
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should handle resolve error', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = { userId: 'user-789' };
      mockAlertService.resolveAlert.mockRejectedValue(new Error('Resolve failed'));

      await controller.resolveAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Resolve failed' }));
    });
  });

  describe('dismissAlert', () => {
    it('should dismiss alert successfully', async () => {
      const mockDismissedAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        status: AlertStatus.DISMISSED,
      };

      mockRequest.params = { id: 'alert-123' };
      mockAlertService.dismissAlert.mockResolvedValue(mockDismissedAlert as LogisticsAlert);

      await controller.dismissAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.dismissAlert).toHaveBeenCalledWith('alert-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockDismissedAlert);
    });

    it('should handle dismiss error', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockAlertService.dismissAlert.mockRejectedValue(new Error('Dismiss failed'));

      await controller.dismissAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Dismiss failed' }));
    });
  });

  describe('deleteAlert', () => {
    it('should delete alert successfully', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockAlertService.deleteAlert.mockResolvedValue(undefined);

      await controller.deleteAlert(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.deleteAlert).toHaveBeenCalledWith('alert-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Alert deleted successfully' });
    });

    it('should handle delete error', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockAlertService.deleteAlert.mockRejectedValue(new Error('Delete failed'));

      await controller.deleteAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Delete failed' }));
    });

    it('should handle delete error without message', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockAlertService.deleteAlert.mockRejectedValue(new Error());

      await controller.deleteAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'An unexpected error occurred' })
      );
    });
  });

  describe('getAlertStatistics', () => {
    it('should get alert statistics successfully', async () => {
      const mockStats = {
        total: 50,
        active: 20,
        acknowledged: 15,
        resolved: 10,
        dismissed: 5,
        bySeverity: {
          critical: 10,
          urgent: 15,
          warning: 20,
          info: 5,
        },
        byType: {
          low_stock: 15,
          critical_stock: 10,
          out_of_stock: 5,
          expiring_soon: 8,
          restock_due: 7,
          consumption_spike: 3,
          supplier_issue: 2,
        },
      };

      mockRequest.params = { fleetId: 'fleet-123' };
      mockAlertService.getAlertStatistics.mockResolvedValue(mockStats);

      await controller.getAlertStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.getAlertStatistics).toHaveBeenCalledWith('fleet-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockStats);
    });

    it('should handle empty statistics', async () => {
      const mockStats = {
        total: 0,
        active: 0,
        acknowledged: 0,
        resolved: 0,
        dismissed: 0,
        bySeverity: {
          critical: 0,
          urgent: 0,
          warning: 0,
          info: 0,
        },
        byType: {},
      };

      mockRequest.params = { fleetId: 'fleet-empty' };
      mockAlertService.getAlertStatistics.mockResolvedValue(mockStats);

      await controller.getAlertStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockStats);
    });

    it('should handle statistics error', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockAlertService.getAlertStatistics.mockRejectedValue(new Error('Stats failed'));

      await controller.getAlertStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Stats failed' }));
    });
  });

  describe('checkInventoryAndGenerateAlerts', () => {
    it('should check inventory and generate alerts successfully', async () => {
      const mockGeneratedAlerts: Partial<LogisticsAlert>[] = [
        {
          id: 'alert-1',
          type: AlertType.LOW_STOCK,
          severity: AlertSeverity.WARNING,
        },
        {
          id: 'alert-2',
          type: AlertType.CRITICAL_STOCK,
          severity: AlertSeverity.CRITICAL,
        },
      ];

      mockRequest.body = { fleetId: 'fleet-123' };
      mockAlertService.checkInventoryAndGenerateAlerts.mockResolvedValue(
        mockGeneratedAlerts as LogisticsAlert[]
      );

      await controller.checkInventoryAndGenerateAlerts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAlertService.checkInventoryAndGenerateAlerts).toHaveBeenCalledWith('fleet-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Inventory check completed',
        alertsGenerated: 2,
        alerts: mockGeneratedAlerts,
      });
    });

    it('should handle no alerts generated', async () => {
      mockRequest.body = { fleetId: 'fleet-123' };
      mockAlertService.checkInventoryAndGenerateAlerts.mockResolvedValue([]);

      await controller.checkInventoryAndGenerateAlerts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Inventory check completed',
        alertsGenerated: 0,
        alerts: [],
      });
    });

    it('should handle inventory check error', async () => {
      mockRequest.body = { fleetId: 'fleet-123' };
      mockAlertService.checkInventoryAndGenerateAlerts.mockRejectedValue(
        new Error('Inventory check failed')
      );

      await controller.checkInventoryAndGenerateAlerts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Inventory check failed' })
      );
    });
  });

  describe('autoResolveAlerts', () => {
    it('should auto-resolve alerts successfully', async () => {
      mockAlertService.autoResolveAlerts.mockResolvedValue(15);

      await controller.autoResolveAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockAlertService.autoResolveAlerts).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Auto-resolve completed',
        resolvedCount: 15,
      });
    });

    it('should handle zero alerts resolved', async () => {
      mockAlertService.autoResolveAlerts.mockResolvedValue(0);

      await controller.autoResolveAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Auto-resolve completed',
        resolvedCount: 0,
      });
    });

    it('should handle auto-resolve error', async () => {
      mockAlertService.autoResolveAlerts.mockRejectedValue(new Error('Auto-resolve failed'));

      await controller.autoResolveAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Auto-resolve failed' })
      );
    });

    it('should handle auto-resolve error without message', async () => {
      mockAlertService.autoResolveAlerts.mockRejectedValue(new Error());

      await controller.autoResolveAlerts(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'An unexpected error occurred' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service throwing non-Error objects', async () => {
      mockRequest.params = { id: 'alert-123' };
      mockAlertService.getAlertById.mockRejectedValue('String error');

      await controller.getAlert(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'An unexpected error occurred' })
      );
    });

    it('should handle service throwing null error', async () => {
      mockRequest.body = { fleetId: 'fleet-123' };
      mockAlertService.checkInventoryAndGenerateAlerts.mockRejectedValue({ message: null });

      await controller.checkInventoryAndGenerateAlerts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'An unexpected error occurred' })
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full alert lifecycle', async () => {
      const alertDto: CreateAlertDto = {
        fleetId: 'fleet-123',
        inventoryItemId: 'item-123',
        itemName: 'Fuel Cells',
        type: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        title: 'Low Stock Alert',
        message: 'Stock level below threshold',
        recipients: [],
        notificationChannels: [],
      };

      const mockCreatedAlert: Partial<LogisticsAlert> = {
        id: 'alert-123',
        ...alertDto,
        status: AlertStatus.ACTIVE,
      };

      const mockAcknowledgedAlert: Partial<LogisticsAlert> = {
        ...mockCreatedAlert,
        status: AlertStatus.ACKNOWLEDGED,
      };

      const mockResolvedAlert: Partial<LogisticsAlert> = {
        ...mockCreatedAlert,
        status: AlertStatus.RESOLVED,
      };

      // Create
      mockRequest.body = alertDto;
      mockAlertService.createAlert.mockResolvedValue(mockCreatedAlert as LogisticsAlert);
      await controller.createAlert(mockRequest as Request, mockResponse as Response);
      expect(mockStatus).toHaveBeenCalledWith(201);

      // Acknowledge
      mockRequest.params = { id: 'alert-123' };
      mockRequest.body = { userId: 'user-456' };
      mockAlertService.acknowledgeAlert.mockResolvedValue(mockAcknowledgedAlert as LogisticsAlert);
      await controller.acknowledgeAlert(mockRequest as Request, mockResponse as Response);
      expect(mockStatus).toHaveBeenCalledWith(200);

      // Resolve
      mockRequest.body = { userId: 'user-456', notes: 'Fixed' };
      mockAlertService.resolveAlert.mockResolvedValue(mockResolvedAlert as LogisticsAlert);
      await controller.resolveAlert(mockRequest as Request, mockResponse as Response);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should handle bulk operations', async () => {
      const mockAlerts: Partial<LogisticsAlert>[] = [
        { id: 'alert-1', status: AlertStatus.ACTIVE },
        { id: 'alert-2', status: AlertStatus.ACTIVE },
        { id: 'alert-3', status: AlertStatus.ACTIVE },
      ];

      // Get all alerts
      mockRequest.query = { fleetId: 'fleet-123', activeOnly: 'true' };
      mockAlertService.getAlerts.mockResolvedValue(mockAlerts as LogisticsAlert[]);
      await controller.getAlerts(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith(mockAlerts);

      // Auto-resolve
      mockAlertService.autoResolveAlerts.mockResolvedValue(3);
      await controller.autoResolveAlerts(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Auto-resolve completed',
        resolvedCount: 3,
      });
    });
  });
});
