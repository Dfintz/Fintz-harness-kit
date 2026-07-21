import { Request, Response } from 'express';

import { LogisticsDashboardController } from '../../controllers/logisticsDashboardController';
import { LogisticsDashboardService } from '../../services/trade/logistics/LogisticsDashboardService';

// Mock dependencies
jest.mock('../../services/trade/logistics/LogisticsDashboardService');
describe('LogisticsDashboardController', () => {
  let controller: LogisticsDashboardController;
  let mockDashboardService: jest.Mocked<LogisticsDashboardService>;
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

    // Mock dashboard service
    mockDashboardService = {
      getDashboardMetrics: jest.fn(),
      getCategoryBreakdown: jest.fn(),
      getAlertSummary: jest.fn(),
      getOperationsSummary: jest.fn(),
      getSupplierPerformance: jest.fn(),
      getConsumptionReport: jest.fn(),
      getStockValueTrend: jest.fn(),
    } as any;

    (LogisticsDashboardService as jest.Mock).mockImplementation(() => mockDashboardService);

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
    };

    controller = new LogisticsDashboardController();
  });

  describe('getDashboardMetrics', () => {
    it('should get comprehensive dashboard metrics successfully', async () => {
      const mockMetrics = {
        inventory: {
          totalItems: 50,
          totalValue: 1000000,
          lowStockItems: 5,
          criticalItems: 2,
          outOfStockItems: 1,
          adequateItems: 42,
          averageDaysRemaining: 45,
          totalAlerts: 8,
        },
        alerts: {
          active: 5,
          critical: 2,
          warning: 3,
          unacknowledged: 4,
          resolvedToday: 1,
        },
        operations: {
          active: 3,
          planning: 2,
          completed: 15,
          totalShips: 12,
          totalCargo: 50000,
          totalFuel: 10000,
        },
        trends: {
          stockTrend: 'improving' as any,
          alertTrend: 'decreasing' as any,
          consumptionTrend: 'normal' as any,
        },
      };

      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getDashboardMetrics.mockResolvedValue(mockMetrics);

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getDashboardMetrics).toHaveBeenCalledWith('fleet-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle empty dashboard metrics', async () => {
      const mockMetrics = {
        inventory: {
          totalItems: 0,
          totalValue: 0,
          lowStockItems: 0,
          criticalItems: 0,
          outOfStockItems: 0,
          adequateItems: 0,
          averageDaysRemaining: 0,
          totalAlerts: 0,
        },
        alerts: { active: 0, critical: 0, warning: 0, unacknowledged: 0, resolvedToday: 0 },
        operations: {
          active: 0,
          planning: 0,
          completed: 0,
          totalShips: 0,
          totalCargo: 0,
          totalFuel: 0,
        },
        trends: {
          stockTrend: 'stable' as any,
          alertTrend: 'stable' as any,
          consumptionTrend: 'normal' as any,
        },
      };

      mockRequest.params = { fleetId: 'fleet-empty' };
      mockDashboardService.getDashboardMetrics.mockResolvedValue(mockMetrics);

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle error getting dashboard metrics', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getDashboardMetrics.mockRejectedValue(new Error('Database error'));

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Database error' }));
    });

    it('should handle error without message', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getDashboardMetrics.mockRejectedValue(new Error(''));

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should get category breakdown successfully', async () => {
      const mockBreakdown: any[] = [
        {
          category: 'fuel',
          totalItems: 10,
          totalQuantity: 50000,
          totalValue: 250000,
          lowStockCount: 2,
          topItems: [
            { name: 'Quantum Fuel', quantity: 20000, unit: 'L', status: 'adequate', value: 100000 },
            { name: 'Hydrogen Fuel', quantity: 15000, unit: 'L', status: 'low', value: 75000 },
          ],
        },
        {
          category: 'supplies',
          totalItems: 15,
          totalQuantity: 2000,
          totalValue: 150000,
          lowStockCount: 3,
          topItems: [
            {
              name: 'Medical Supplies',
              quantity: 500,
              unit: 'units',
              status: 'critical',
              value: 50000,
            },
          ],
        },
      ];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getCategoryBreakdown.mockResolvedValue(mockBreakdown);

      await controller.getCategoryBreakdown(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getCategoryBreakdown).toHaveBeenCalledWith('fleet-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockBreakdown);
    });

    it('should handle empty category breakdown', async () => {
      mockRequest.params = { fleetId: 'fleet-empty' };
      mockDashboardService.getCategoryBreakdown.mockResolvedValue([]);

      await controller.getCategoryBreakdown(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith([]);
    });

    it('should handle error getting category breakdown', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getCategoryBreakdown.mockRejectedValue(new Error('Query failed'));

      await controller.getCategoryBreakdown(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Query failed' }));
    });
  });

  describe('getAlertSummary', () => {
    it('should get alert summary successfully', async () => {
      const mockSummary: any[] = [
        {
          type: 'low_stock',
          count: 5,
          severity: 'warning',
          topAlerts: [
            { id: 'alert-1', title: 'Low Fuel', itemName: 'Quantum Fuel' },
            { id: 'alert-2', title: 'Low Supplies', itemName: 'Medical Kit' },
          ],
        },
        {
          type: 'critical_stock',
          count: 2,
          severity: 'critical',
          topAlerts: [{ id: 'alert-3', title: 'Critical Ammo', itemName: 'Ballistic Rounds' }],
        },
      ];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getAlertSummary.mockResolvedValue(mockSummary);

      await controller.getAlertSummary(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getAlertSummary).toHaveBeenCalledWith('fleet-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockSummary);
    });

    it('should handle empty alert summary', async () => {
      mockRequest.params = { fleetId: 'fleet-no-alerts' };
      mockDashboardService.getAlertSummary.mockResolvedValue([]);

      await controller.getAlertSummary(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith([]);
    });

    it('should handle error getting alert summary', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getAlertSummary.mockRejectedValue(new Error('Alert query failed'));

      await controller.getAlertSummary(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Alert query failed' })
      );
    });
  });

  describe('getOperationsSummary', () => {
    it('should get operations summary successfully', async () => {
      const mockSummary: any[] = [
        {
          status: 'in_progress',
          count: 3,
          totalShips: 12,
          totalCargo: 50000,
          topOperations: [
            { id: 'op-1', name: 'Supply Run Alpha', coordinator: 'John Doe' },
            { id: 'op-2', name: 'Fuel Transport', coordinator: 'Jane Smith' },
          ],
        },
        {
          status: 'planning',
          count: 2,
          totalShips: 5,
          totalCargo: 15000,
          topOperations: [{ id: 'op-3', name: 'Mining Operation', coordinator: 'Bob Johnson' }],
        },
      ];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getOperationsSummary.mockResolvedValue(mockSummary);

      await controller.getOperationsSummary(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getOperationsSummary).toHaveBeenCalledWith('fleet-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockSummary);
    });

    it('should handle empty operations summary', async () => {
      mockRequest.params = { fleetId: 'fleet-no-ops' };
      mockDashboardService.getOperationsSummary.mockResolvedValue([]);

      await controller.getOperationsSummary(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith([]);
    });

    it('should handle error getting operations summary', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getOperationsSummary.mockRejectedValue(
        new Error('Operations query failed')
      );

      await controller.getOperationsSummary(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Operations query failed' })
      );
    });
  });

  describe('getSupplierPerformance', () => {
    it('should get supplier performance successfully', async () => {
      const mockPerformance: any[] = [
        {
          supplierId: 'supplier-1',
          supplierName: 'ArcCorp Supplies',
          totalDeliveries: 25,
          onTimeDeliveries: 23,
          onTimeRate: 92,
          averageDeliveryTime: 3.5,
          qualityScore: 4.5,
          totalValue: 500000,
        },
        {
          supplierId: 'supplier-2',
          supplierName: 'Crusader Industries',
          totalDeliveries: 18,
          onTimeDeliveries: 16,
          onTimeRate: 88.9,
          averageDeliveryTime: 4.2,
          qualityScore: 4.2,
          totalValue: 350000,
        },
      ];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getSupplierPerformance.mockResolvedValue(mockPerformance);

      await controller.getSupplierPerformance(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getSupplierPerformance).toHaveBeenCalledWith('fleet-123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockPerformance);
    });

    it('should handle empty supplier performance', async () => {
      mockRequest.params = { fleetId: 'fleet-no-suppliers' };
      mockDashboardService.getSupplierPerformance.mockResolvedValue([]);

      await controller.getSupplierPerformance(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith([]);
    });

    it('should handle error getting supplier performance', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getSupplierPerformance.mockRejectedValue(
        new Error('Supplier query failed')
      );

      await controller.getSupplierPerformance(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Supplier query failed' })
      );
    });
  });

  describe('getConsumptionReport', () => {
    it('should get consumption report with default days', async () => {
      const mockReport: any[] = [
        {
          period: '30-days',
          category: 'fuel' as any,
          totalConsumed: 150000,
          averageDaily: 5000,
          peakDate: new Date('2025-10-15'),
          peakConsumption: 8000,
          trend: 'stable' as any,
        },
        {
          period: '30-days',
          category: 'supplies' as any,
          totalConsumed: 5000,
          averageDaily: 166.67,
          peakDate: new Date('2025-10-12'),
          peakConsumption: 300,
          trend: 'increasing' as any,
        },
      ];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = {};
      mockDashboardService.getConsumptionReport.mockResolvedValue(mockReport);

      await controller.getConsumptionReport(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getConsumptionReport).toHaveBeenCalledWith('fleet-123', 30);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockReport);
    });

    it('should get consumption report with custom days', async () => {
      const mockReport: any[] = [
        {
          period: '70-days',
          category: 'fuel' as any,
          totalConsumed: 350000,
          averageDaily: 5000,
          peakDate: new Date('2025-10-10'),
          peakConsumption: 9000,
          trend: 'stable' as any,
        },
      ];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = { days: '70' };
      mockDashboardService.getConsumptionReport.mockResolvedValue(mockReport);

      await controller.getConsumptionReport(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getConsumptionReport).toHaveBeenCalledWith('fleet-123', 70);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockReport);
    });

    it('should handle invalid days parameter', async () => {
      const mockReport: any[] = [];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = { days: 'invalid' };
      mockDashboardService.getConsumptionReport.mockResolvedValue(mockReport);

      await controller.getConsumptionReport(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getConsumptionReport).toHaveBeenCalledWith('fleet-123', 30);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should handle empty consumption report', async () => {
      mockRequest.params = { fleetId: 'fleet-no-consumption' };
      mockRequest.query = {};
      mockDashboardService.getConsumptionReport.mockResolvedValue([]);

      await controller.getConsumptionReport(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith([]);
    });

    it('should handle error getting consumption report', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = {};
      mockDashboardService.getConsumptionReport.mockRejectedValue(
        new Error('Consumption query failed')
      );

      await controller.getConsumptionReport(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Consumption query failed' })
      );
    });
  });

  describe('getStockValueTrend', () => {
    it('should get stock value trend with default days', async () => {
      const mockTrend: any[] = [
        { date: '2025-09-17', totalValue: 900000 },
        { date: '2025-09-24', totalValue: 920000 },
        { date: '2025-10-01', totalValue: 950000 },
        { date: '2025-10-08', totalValue: 980000 },
        { date: '2025-10-17', totalValue: 1000000 },
      ];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = {};
      mockDashboardService.getStockValueTrend.mockResolvedValue(mockTrend);

      await controller.getStockValueTrend(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getStockValueTrend).toHaveBeenCalledWith('fleet-123', 30);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockTrend);
    });

    it('should get stock value trend with custom days', async () => {
      const mockTrend: any[] = [
        { date: '2025-07-19', totalValue: 800000 },
        { date: '2025-08-15', totalValue: 850000 },
        { date: '2025-09-10', totalValue: 900000 },
        { date: '2025-10-17', totalValue: 1000000 },
      ];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = { days: '90' };
      mockDashboardService.getStockValueTrend.mockResolvedValue(mockTrend);

      await controller.getStockValueTrend(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getStockValueTrend).toHaveBeenCalledWith('fleet-123', 90);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockTrend);
    });

    it('should handle invalid days parameter', async () => {
      const mockTrend: any[] = [];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = { days: 'not-a-number' };
      mockDashboardService.getStockValueTrend.mockResolvedValue(mockTrend);

      await controller.getStockValueTrend(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getStockValueTrend).toHaveBeenCalledWith('fleet-123', 30);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should handle zero days parameter by defaulting to 30', async () => {
      const mockTrend: any[] = [];

      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = { days: '0' };
      mockDashboardService.getStockValueTrend.mockResolvedValue(mockTrend);

      await controller.getStockValueTrend(mockRequest as Request, mockResponse as Response);

      expect(mockDashboardService.getStockValueTrend).toHaveBeenCalledWith('fleet-123', 30);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should handle error getting stock value trend', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockRequest.query = {};
      mockDashboardService.getStockValueTrend.mockRejectedValue(new Error('Trend query failed'));

      await controller.getStockValueTrend(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Trend query failed' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors without message property', async () => {
      mockRequest.params = { fleetId: 'fleet-123' };
      mockDashboardService.getDashboardMetrics.mockRejectedValue(new Error('Service unavailable'));

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Service unavailable' })
      );
    });

    it('should handle all endpoints with generic error', async () => {
      mockRequest.params = { fleetId: 'fleet-error' };
      const genericError = new Error('Service error');

      // Test each endpoint's error handling
      mockDashboardService.getDashboardMetrics.mockRejectedValue(genericError);
      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Service error' }));

      mockDashboardService.getCategoryBreakdown.mockRejectedValue(genericError);
      await controller.getCategoryBreakdown(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Service error' }));

      mockDashboardService.getAlertSummary.mockRejectedValue(genericError);
      await controller.getAlertSummary(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Service error' }));

      mockDashboardService.getOperationsSummary.mockRejectedValue(genericError);
      await controller.getOperationsSummary(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Service error' }));

      mockDashboardService.getSupplierPerformance.mockRejectedValue(genericError);
      await controller.getSupplierPerformance(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Service error' }));

      mockDashboardService.getConsumptionReport.mockRejectedValue(genericError);
      mockRequest.query = {};
      await controller.getConsumptionReport(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Service error' }));

      mockDashboardService.getStockValueTrend.mockRejectedValue(genericError);
      await controller.getStockValueTrend(mockRequest as Request, mockResponse as Response);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Service error' }));
    });
  });

  describe('Integration Scenarios', () => {
    it('should fetch complete dashboard for a fleet', async () => {
      const fleetId = 'fleet-integration-test';
      mockRequest.params = { fleetId };
      mockRequest.query = {};

      // Mock all dashboard methods
      mockDashboardService.getDashboardMetrics.mockResolvedValue({
        inventory: {
          totalItems: 0,
          totalValue: 0,
          lowStockItems: 0,
          criticalItems: 0,
          outOfStockItems: 0,
          adequateItems: 0,
          averageDaysRemaining: 0,
          totalAlerts: 0,
        },
        alerts: { active: 0, critical: 0, warning: 0, unacknowledged: 0, resolvedToday: 0 },
        operations: {
          active: 0,
          planning: 0,
          completed: 0,
          totalShips: 0,
          totalCargo: 0,
          totalFuel: 0,
        },
        trends: { stockTrend: 'stable', alertTrend: 'stable', consumptionTrend: 'normal' },
      });
      mockDashboardService.getCategoryBreakdown.mockResolvedValue([]);
      mockDashboardService.getAlertSummary.mockResolvedValue([]);
      mockDashboardService.getOperationsSummary.mockResolvedValue([]);
      mockDashboardService.getSupplierPerformance.mockResolvedValue([]);
      mockDashboardService.getConsumptionReport.mockResolvedValue([]);
      mockDashboardService.getStockValueTrend.mockResolvedValue([]);

      // Call all endpoints
      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);
      await controller.getCategoryBreakdown(mockRequest as Request, mockResponse as Response);
      await controller.getAlertSummary(mockRequest as Request, mockResponse as Response);
      await controller.getOperationsSummary(mockRequest as Request, mockResponse as Response);
      await controller.getSupplierPerformance(mockRequest as Request, mockResponse as Response);
      await controller.getConsumptionReport(mockRequest as Request, mockResponse as Response);
      await controller.getStockValueTrend(mockRequest as Request, mockResponse as Response);

      // Verify all were called with correct fleetId
      expect(mockDashboardService.getDashboardMetrics).toHaveBeenCalledWith(fleetId);
      expect(mockDashboardService.getCategoryBreakdown).toHaveBeenCalledWith(fleetId);
      expect(mockDashboardService.getAlertSummary).toHaveBeenCalledWith(fleetId);
      expect(mockDashboardService.getOperationsSummary).toHaveBeenCalledWith(fleetId);
      expect(mockDashboardService.getSupplierPerformance).toHaveBeenCalledWith(fleetId);
      expect(mockDashboardService.getConsumptionReport).toHaveBeenCalledWith(fleetId, 30);
      expect(mockDashboardService.getStockValueTrend).toHaveBeenCalledWith(fleetId, 30);

      // All should return 200
      expect(mockStatus).toHaveBeenCalledTimes(7);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should handle mixed success and failure scenarios', async () => {
      mockRequest.params = { fleetId: 'fleet-mixed' };
      mockRequest.query = {};

      // Some succeed, some fail
      mockDashboardService.getDashboardMetrics.mockResolvedValue({
        inventory: {
          totalItems: 0,
          totalValue: 0,
          lowStockItems: 0,
          criticalItems: 0,
          outOfStockItems: 0,
          adequateItems: 0,
          averageDaysRemaining: 0,
          totalAlerts: 0,
        },
        alerts: { active: 0, critical: 0, warning: 0, unacknowledged: 0, resolvedToday: 0 },
        operations: {
          active: 0,
          planning: 0,
          completed: 0,
          totalShips: 0,
          totalCargo: 0,
          totalFuel: 0,
        },
        trends: { stockTrend: 'stable', alertTrend: 'stable', consumptionTrend: 'normal' },
      });
      mockDashboardService.getCategoryBreakdown.mockRejectedValue(new Error('Category error'));
      mockDashboardService.getAlertSummary.mockResolvedValue([]);
      mockDashboardService.getOperationsSummary.mockRejectedValue(new Error('Operations error'));

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);
      expect(mockStatus).toHaveBeenLastCalledWith(200);

      await controller.getCategoryBreakdown(mockRequest as Request, mockResponse as Response);
      expect(mockStatus).toHaveBeenLastCalledWith(500);
      expect(mockJson).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: 'Category error' })
      );

      await controller.getAlertSummary(mockRequest as Request, mockResponse as Response);
      expect(mockStatus).toHaveBeenLastCalledWith(200);

      await controller.getOperationsSummary(mockRequest as Request, mockResponse as Response);
      expect(mockStatus).toHaveBeenLastCalledWith(500);
      expect(mockJson).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: 'Operations error' })
      );
    });
  });
});
