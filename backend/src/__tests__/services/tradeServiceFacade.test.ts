jest.mock('../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { TradeServiceFacade } from '../../services/trade/TradeServiceFacade';

// ---------------------------------------------------------------------------
// Mock sub-services – every method is a jest.fn()
// ---------------------------------------------------------------------------
function createMockTradingService() {
  return {
    createRoute: jest.fn(),
    getRoutes: jest.fn(),
    getOrganizationRoutes: jest.fn(),
    getRouteById: jest.fn(),
    updateRoute: jest.fn(),
    deleteRoute: jest.fn(),
    recordRouteRun: jest.fn(),
    findTradeOpportunities: jest.fn(),
    optimizeRoute: jest.fn(),
    analyzeRouteProfitability: jest.fn(),
    shareRoute: jest.fn(),
  };
}

function createMockAlertService() {
  return {
    createAlert: jest.fn(),
    getAlerts: jest.fn(),
    getAlertById: jest.fn(),
    updateAlert: jest.fn(),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
    dismissAlert: jest.fn(),
    deleteAlert: jest.fn(),
    checkInventoryAndGenerateAlerts: jest.fn(),
    autoResolveAlerts: jest.fn(),
    getAlertStatistics: jest.fn(),
    getPredictiveRestockRecommendations: jest.fn(),
  };
}

function createMockDashboardService() {
  return {
    getDashboardMetrics: jest.fn(),
    getCategoryBreakdown: jest.fn(),
    getAlertSummary: jest.fn(),
    getOperationsSummary: jest.fn(),
    getSupplierPerformance: jest.fn(),
    getConsumptionReport: jest.fn(),
    getStockValueTrend: jest.fn(),
  };
}

function createMockSupplierService() {
  return {
    createSupplier: jest.fn(),
    getSupplier: jest.fn(),
    getSuppliers: jest.fn(),
    updateSupplier: jest.fn(),
    deleteSupplier: jest.fn(),
    setPreferredSupplier: jest.fn(),
    recordOrder: jest.fn(),
    completeOrder: jest.fn(),
    cancelOrder: jest.fn(),
    getSupplierOrders: jest.fn(),
    getOrganizationOrders: jest.fn(),
    compareSuppliers: jest.fn(),
    getPerformanceReport: jest.fn(),
    getRecommendedSupplier: jest.fn(),
  };
}

function createMockRouteOptimizationService() {
  return {
    optimizeRoute: jest.fn(),
    getRoute: jest.fn(),
    getOrganizationRoutes: jest.fn(),
    deleteRoute: jest.fn(),
    analyzeSupplyChain: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TradeServiceFacade', () => {
  let facade: TradeServiceFacade;
  let tradingService: ReturnType<typeof createMockTradingService>;
  let alertService: ReturnType<typeof createMockAlertService>;
  let dashboardService: ReturnType<typeof createMockDashboardService>;
  let supplierService: ReturnType<typeof createMockSupplierService>;
  let routeOptimizationService: ReturnType<typeof createMockRouteOptimizationService>;

  beforeEach(() => {
    tradingService = createMockTradingService();
    alertService = createMockAlertService();
    dashboardService = createMockDashboardService();
    supplierService = createMockSupplierService();
    routeOptimizationService = createMockRouteOptimizationService();

    facade = new TradeServiceFacade(
      tradingService as any,
      alertService as any,
      dashboardService as any,
      supplierService as any,
      routeOptimizationService as any
    );
  });

  // ====================== TRADING OPERATIONS ======================
  describe('Trading Operations', () => {
    it('should delegate createTradingRoute to tradingService.createRoute', async () => {
      const dto = { name: 'Route A', organizationId: 'org-1' } as any;
      const expected = { id: 'r-1', ...dto };
      tradingService.createRoute.mockResolvedValue(expected);

      const result = await facade.createTradingRoute(dto);

      expect(tradingService.createRoute).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });

    it('should delegate getTradingRoutes to tradingService.getRoutes', async () => {
      const filters = { organizationId: 'org-1', status: 'active' as any };
      const expected = [{ id: 'r-1' }];
      tradingService.getRoutes.mockResolvedValue(expected);

      const result = await facade.getTradingRoutes(filters);

      expect(tradingService.getRoutes).toHaveBeenCalledWith(filters);
      expect(result).toBe(expected);
    });

    it('should delegate getOrganizationRoutes to tradingService.getOrganizationRoutes', async () => {
      const options = { page: 1, limit: 10 };
      const expected = { data: [], pagination: {} };
      tradingService.getOrganizationRoutes.mockResolvedValue(expected);

      const result = await facade.getOrganizationRoutes('org-1', options);

      expect(tradingService.getOrganizationRoutes).toHaveBeenCalledWith('org-1', options);
      expect(result).toBe(expected);
    });

    it('should delegate getTradingRouteById to tradingService.getRouteById', async () => {
      const expected = { id: 'r-1', name: 'Route A' };
      tradingService.getRouteById.mockResolvedValue(expected);

      const result = await facade.getTradingRouteById('r-1', 'org-1');

      expect(tradingService.getRouteById).toHaveBeenCalledWith('r-1', 'org-1');
      expect(result).toBe(expected);
    });

    it('should delegate updateTradingRoute to tradingService.updateRoute', async () => {
      const dto = { name: 'Updated' } as any;
      const expected = { id: 'r-1', name: 'Updated' };
      tradingService.updateRoute.mockResolvedValue(expected);

      const result = await facade.updateTradingRoute('r-1', dto, 'org-1');

      expect(tradingService.updateRoute).toHaveBeenCalledWith('r-1', dto, 'org-1');
      expect(result).toBe(expected);
    });

    it('should delegate deleteTradingRoute to tradingService.deleteRoute', async () => {
      tradingService.deleteRoute.mockResolvedValue(undefined);

      await facade.deleteTradingRoute('r-1', 'org-1');

      expect(tradingService.deleteRoute).toHaveBeenCalledWith('r-1', 'org-1');
    });

    it('should delegate recordRouteRun to tradingService.recordRouteRun', async () => {
      const expected = { id: 'r-1', totalRuns: 5 };
      tradingService.recordRouteRun.mockResolvedValue(expected);

      const result = await facade.recordRouteRun('r-1', 5000, 120, 'org-1');

      expect(tradingService.recordRouteRun).toHaveBeenCalledWith(
        'r-1',
        5000,
        120,
        'org-1',
        undefined,
        undefined
      );
      expect(result).toBe(expected);
    });

    it('should delegate findTradeOpportunities to tradingService.findTradeOpportunities', async () => {
      const expected = [{ commodity: 'Laranite', profit: 3000 }];
      tradingService.findTradeOpportunities.mockResolvedValue(expected);

      const result = await facade.findTradeOpportunities('Lorville', 0.1, 5);

      expect(tradingService.findTradeOpportunities).toHaveBeenCalledWith('Lorville', 0.1, 5);
      expect(result).toBe(expected);
    });

    it('should delegate optimizeRoute to tradingService.optimizeRoute', async () => {
      const options = { routeId: 'r-1' } as any;
      const expected = [{ step: 1 }];
      tradingService.optimizeRoute.mockResolvedValue(expected);

      const result = await facade.optimizeRoute(options);

      expect(tradingService.optimizeRoute).toHaveBeenCalledWith(options);
      expect(result).toBe(expected);
    });

    it('should delegate analyzeRouteProfitability to tradingService.analyzeRouteProfitability', async () => {
      const expected = { avgProfit: 2500, marginPercent: 15 };
      tradingService.analyzeRouteProfitability.mockResolvedValue(expected);

      const result = await facade.analyzeRouteProfitability('r-1');

      expect(tradingService.analyzeRouteProfitability).toHaveBeenCalledWith('r-1');
      expect(result).toBe(expected);
    });

    it('should delegate shareRoute to tradingService.shareRoute', async () => {
      const expected = { shared: true };
      tradingService.shareRoute.mockResolvedValue(expected);

      const result = await facade.shareRoute('r-1', 'org-2', 'user-1', 'org-owner', 'view');

      expect(tradingService.shareRoute).toHaveBeenCalledWith(
        'r-1',
        'org-2',
        'user-1',
        'org-owner',
        'view'
      );
      expect(result).toBe(expected);
    });
  });

  // ====================== LOGISTICS ALERT OPERATIONS ======================
  describe('Logistics Alert Operations', () => {
    it('should delegate createLogisticsAlert to alertService.createAlert', async () => {
      const dto = { type: 'low_stock', fleetId: 'f-1' } as any;
      const expected = { id: 'a-1', ...dto };
      alertService.createAlert.mockResolvedValue(expected);

      const result = await facade.createLogisticsAlert(dto);

      expect(alertService.createAlert).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });

    it('should delegate getLogisticsAlerts to alertService.getAlerts', async () => {
      const filters = { fleetId: 'f-1', activeOnly: true } as any;
      const expected = [{ id: 'a-1' }];
      alertService.getAlerts.mockResolvedValue(expected);

      const result = await facade.getLogisticsAlerts(filters);

      expect(alertService.getAlerts).toHaveBeenCalledWith(filters);
      expect(result).toBe(expected);
    });

    it('should delegate getLogisticsAlertById to alertService.getAlertById', async () => {
      const expected = { id: 'a-1', type: 'low_stock' };
      alertService.getAlertById.mockResolvedValue(expected);

      const result = await facade.getLogisticsAlertById('a-1');

      expect(alertService.getAlertById).toHaveBeenCalledWith('a-1');
      expect(result).toBe(expected);
    });

    it('should delegate updateLogisticsAlert to alertService.updateAlert', async () => {
      const dto = { severity: 'high' } as any;
      const expected = { id: 'a-1', severity: 'high' };
      alertService.updateAlert.mockResolvedValue(expected);

      const result = await facade.updateLogisticsAlert('a-1', dto);

      expect(alertService.updateAlert).toHaveBeenCalledWith('a-1', dto);
      expect(result).toBe(expected);
    });

    it('should delegate acknowledgeLogisticsAlert to alertService.acknowledgeAlert', async () => {
      const expected = { id: 'a-1', acknowledged: true };
      alertService.acknowledgeAlert.mockResolvedValue(expected);

      const result = await facade.acknowledgeLogisticsAlert('a-1', 'user-1');

      expect(alertService.acknowledgeAlert).toHaveBeenCalledWith('a-1', 'user-1');
      expect(result).toBe(expected);
    });

    it('should delegate resolveLogisticsAlert to alertService.resolveAlert', async () => {
      const expected = { id: 'a-1', resolved: true };
      alertService.resolveAlert.mockResolvedValue(expected);

      const result = await facade.resolveLogisticsAlert('a-1', 'user-1', 'Fixed it');

      expect(alertService.resolveAlert).toHaveBeenCalledWith('a-1', 'user-1', 'Fixed it');
      expect(result).toBe(expected);
    });

    it('should delegate dismissLogisticsAlert to alertService.dismissAlert', async () => {
      const expected = { id: 'a-1', dismissed: true };
      alertService.dismissAlert.mockResolvedValue(expected);

      const result = await facade.dismissLogisticsAlert('a-1');

      expect(alertService.dismissAlert).toHaveBeenCalledWith('a-1');
      expect(result).toBe(expected);
    });

    it('should delegate deleteLogisticsAlert to alertService.deleteAlert', async () => {
      alertService.deleteAlert.mockResolvedValue(undefined);

      await facade.deleteLogisticsAlert('a-1');

      expect(alertService.deleteAlert).toHaveBeenCalledWith('a-1');
    });

    it('should delegate checkInventoryAndGenerateAlerts to alertService', async () => {
      const expected = [{ id: 'a-new' }];
      alertService.checkInventoryAndGenerateAlerts.mockResolvedValue(expected);

      const result = await facade.checkInventoryAndGenerateAlerts('f-1');

      expect(alertService.checkInventoryAndGenerateAlerts).toHaveBeenCalledWith('f-1');
      expect(result).toBe(expected);
    });

    it('should delegate autoResolveAlerts to alertService.autoResolveAlerts', async () => {
      alertService.autoResolveAlerts.mockResolvedValue(3);

      const result = await facade.autoResolveAlerts();

      expect(alertService.autoResolveAlerts).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it('should delegate getAlertStatistics to alertService.getAlertStatistics', async () => {
      const expected = { total: 10, critical: 2 };
      alertService.getAlertStatistics.mockResolvedValue(expected);

      const result = await facade.getAlertStatistics('f-1');

      expect(alertService.getAlertStatistics).toHaveBeenCalledWith('f-1');
      expect(result).toBe(expected);
    });

    it('should delegate getPredictiveRestockRecommendations to alertService', async () => {
      const expected = [{ item: 'fuel', qty: 100 }];
      alertService.getPredictiveRestockRecommendations.mockResolvedValue(expected);

      const result = await facade.getPredictiveRestockRecommendations('org-1', 'f-1');

      expect(alertService.getPredictiveRestockRecommendations).toHaveBeenCalledWith('org-1', 'f-1');
      expect(result).toBe(expected);
    });
  });

  // ====================== DASHBOARD OPERATIONS ======================
  describe('Dashboard Operations', () => {
    it('should delegate getDashboardMetrics to dashboardService', async () => {
      const expected = { totalValue: 50000 };
      dashboardService.getDashboardMetrics.mockResolvedValue(expected);

      const result = await facade.getDashboardMetrics('f-1');

      expect(dashboardService.getDashboardMetrics).toHaveBeenCalledWith('f-1');
      expect(result).toBe(expected);
    });

    it('should delegate getCategoryBreakdown to dashboardService', async () => {
      const expected = [{ category: 'ammo', count: 5 }];
      dashboardService.getCategoryBreakdown.mockResolvedValue(expected);

      const result = await facade.getCategoryBreakdown('f-1');

      expect(dashboardService.getCategoryBreakdown).toHaveBeenCalledWith('f-1');
      expect(result).toBe(expected);
    });

    it('should delegate getAlertSummary to dashboardService', async () => {
      const expected = [{ severity: 'high', count: 3 }];
      dashboardService.getAlertSummary.mockResolvedValue(expected);

      const result = await facade.getAlertSummary('f-1');

      expect(dashboardService.getAlertSummary).toHaveBeenCalledWith('f-1');
      expect(result).toBe(expected);
    });

    it('should delegate getOperationsSummary to dashboardService', async () => {
      const expected = [{ type: 'delivery', count: 12 }];
      dashboardService.getOperationsSummary.mockResolvedValue(expected);

      const result = await facade.getOperationsSummary('f-1');

      expect(dashboardService.getOperationsSummary).toHaveBeenCalledWith('f-1');
      expect(result).toBe(expected);
    });

    it('should delegate getSupplierPerformance to dashboardService', async () => {
      const expected = [{ supplier: 'ArcCorp', rating: 4.5 }];
      dashboardService.getSupplierPerformance.mockResolvedValue(expected);

      const result = await facade.getSupplierPerformance('f-1');

      expect(dashboardService.getSupplierPerformance).toHaveBeenCalledWith('f-1');
      expect(result).toBe(expected);
    });

    it('should delegate getConsumptionReport to dashboardService', async () => {
      const expected = [{ item: 'fuel', consumed: 500 }];
      dashboardService.getConsumptionReport.mockResolvedValue(expected);

      const result = await facade.getConsumptionReport('f-1', 30);

      expect(dashboardService.getConsumptionReport).toHaveBeenCalledWith('f-1', 30);
      expect(result).toBe(expected);
    });

    it('should delegate getStockValueTrend to dashboardService', async () => {
      const expected = [{ date: '2026-01-01', value: 10000 }];
      dashboardService.getStockValueTrend.mockResolvedValue(expected);

      const result = await facade.getStockValueTrend('f-1', 7);

      expect(dashboardService.getStockValueTrend).toHaveBeenCalledWith('f-1', 7);
      expect(result).toBe(expected);
    });
  });

  // ====================== COMBINED OPERATIONS ======================
  describe('Combined Operations', () => {
    it('should aggregate results in getTradeOverview without fleetId', async () => {
      const routes = [{ id: 'r-1' }];
      const alerts = [{ id: 'a-1' }];
      const restock = [{ item: 'ammo', qty: 50 }];

      tradingService.getRoutes.mockResolvedValue(routes);
      alertService.getAlerts.mockResolvedValue(alerts);
      alertService.getPredictiveRestockRecommendations.mockResolvedValue(restock);

      const result = await facade.getTradeOverview('org-1');

      expect(tradingService.getRoutes).toHaveBeenCalledWith({ organizationId: 'org-1' });
      expect(alertService.getAlerts).toHaveBeenCalledWith({ fleetId: undefined, activeOnly: true });
      expect(alertService.getPredictiveRestockRecommendations).toHaveBeenCalledWith(
        'org-1',
        undefined
      );
      expect(dashboardService.getDashboardMetrics).not.toHaveBeenCalled();
      expect(result).toEqual({
        tradingRoutes: routes,
        activeAlerts: alerts,
        dashboardMetrics: null,
        restockRecommendations: restock,
      });
    });

    it('should include dashboardMetrics in getTradeOverview when fleetId is provided', async () => {
      const routes = [{ id: 'r-1' }];
      const alerts = [{ id: 'a-1' }];
      const restock = [{ item: 'fuel', qty: 100 }];
      const metrics = { totalValue: 75000 };

      tradingService.getRoutes.mockResolvedValue(routes);
      alertService.getAlerts.mockResolvedValue(alerts);
      alertService.getPredictiveRestockRecommendations.mockResolvedValue(restock);
      dashboardService.getDashboardMetrics.mockResolvedValue(metrics);

      const result = await facade.getTradeOverview('org-1', 'f-1');

      expect(dashboardService.getDashboardMetrics).toHaveBeenCalledWith('f-1');
      expect(result.dashboardMetrics).toBe(metrics);
      expect(result.tradingRoutes).toBe(routes);
      expect(result.activeAlerts).toBe(alerts);
      expect(result.restockRecommendations).toBe(restock);
    });

    it('should aggregate all services in getFullOverview without fleetId', async () => {
      const routes = [{ id: 'r-1' }];
      const alerts = [{ id: 'a-1' }];
      const restock = [{ item: 'ammo', qty: 50 }];
      const supplierReport = {
        totalSuppliers: 5,
        activeSuppliers: 3,
        preferredSuppliers: 1,
        averageReliabilityScore: 0.85,
        totalSpent: 120000,
        topSuppliers: [],
        lowPerformers: [],
      };
      const supplyChain = { bottlenecks: [], score: 0.9 };

      tradingService.getRoutes.mockResolvedValue(routes);
      alertService.getAlerts.mockResolvedValue(alerts);
      alertService.getPredictiveRestockRecommendations.mockResolvedValue(restock);
      supplierService.getPerformanceReport.mockResolvedValue(supplierReport);
      routeOptimizationService.analyzeSupplyChain.mockResolvedValue(supplyChain);

      const result = await facade.getFullOverview('org-1');

      expect(tradingService.getRoutes).toHaveBeenCalledWith({ organizationId: 'org-1' });
      expect(alertService.getAlerts).toHaveBeenCalledWith({ fleetId: undefined, activeOnly: true });
      expect(alertService.getPredictiveRestockRecommendations).toHaveBeenCalledWith(
        'org-1',
        undefined
      );
      expect(supplierService.getPerformanceReport).toHaveBeenCalledWith('org-1');
      expect(routeOptimizationService.analyzeSupplyChain).toHaveBeenCalledWith('org-1');
      expect(dashboardService.getDashboardMetrics).not.toHaveBeenCalled();

      expect(result).toEqual({
        tradingRoutes: routes,
        activeAlerts: alerts,
        dashboardMetrics: null,
        restockRecommendations: restock,
        supplierReport,
        supplyChainAnalysis: supplyChain,
      });
    });

    it('should include dashboardMetrics in getFullOverview when fleetId is provided', async () => {
      const routes: any[] = [];
      const alerts: any[] = [];
      const restock: any[] = [];
      const supplierReport = {
        totalSuppliers: 0,
        activeSuppliers: 0,
        preferredSuppliers: 0,
        averageReliabilityScore: 0,
        totalSpent: 0,
        topSuppliers: [],
        lowPerformers: [],
      };
      const supplyChain = { bottlenecks: [], score: 1 };
      const metrics = { totalValue: 50000 };

      tradingService.getRoutes.mockResolvedValue(routes);
      alertService.getAlerts.mockResolvedValue(alerts);
      alertService.getPredictiveRestockRecommendations.mockResolvedValue(restock);
      supplierService.getPerformanceReport.mockResolvedValue(supplierReport);
      routeOptimizationService.analyzeSupplyChain.mockResolvedValue(supplyChain);
      dashboardService.getDashboardMetrics.mockResolvedValue(metrics);

      const result = await facade.getFullOverview('org-1', 'f-1');

      expect(dashboardService.getDashboardMetrics).toHaveBeenCalledWith('f-1');
      expect(result.dashboardMetrics).toBe(metrics);
    });
  });

  // ====================== SUPPLIER MANAGEMENT OPERATIONS ======================
  describe('Supplier Management Operations', () => {
    it('should delegate createSupplier to supplierService.createSupplier', async () => {
      const dto = { name: 'ArcCorp Mining', organizationId: 'org-1' } as any;
      const expected = { id: 's-1', ...dto };
      supplierService.createSupplier.mockResolvedValue(expected);

      const result = await facade.createSupplier(dto);

      expect(supplierService.createSupplier).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });

    it('should delegate getSupplier to supplierService.getSupplier', async () => {
      const expected = { id: 's-1', name: 'ArcCorp Mining' };
      supplierService.getSupplier.mockResolvedValue(expected);

      const result = await facade.getSupplier('s-1');

      expect(supplierService.getSupplier).toHaveBeenCalledWith('s-1');
      expect(result).toBe(expected);
    });

    it('should delegate getSuppliers to supplierService.getSuppliers', async () => {
      const filters = { active: true } as any;
      const expected = [{ id: 's-1' }];
      supplierService.getSuppliers.mockResolvedValue(expected);

      const result = await facade.getSuppliers('org-1', filters);

      expect(supplierService.getSuppliers).toHaveBeenCalledWith('org-1', filters);
      expect(result).toBe(expected);
    });

    it('should delegate updateSupplier to supplierService.updateSupplier', async () => {
      const dto = { name: 'Updated Name' } as any;
      const expected = { id: 's-1', name: 'Updated Name' };
      supplierService.updateSupplier.mockResolvedValue(expected);

      const result = await facade.updateSupplier('s-1', dto);

      expect(supplierService.updateSupplier).toHaveBeenCalledWith('s-1', dto);
      expect(result).toBe(expected);
    });

    it('should delegate deleteSupplier to supplierService.deleteSupplier', async () => {
      supplierService.deleteSupplier.mockResolvedValue(true);

      const result = await facade.deleteSupplier('s-1');

      expect(supplierService.deleteSupplier).toHaveBeenCalledWith('s-1');
      expect(result).toBe(true);
    });

    it('should delegate setPreferredSupplier to supplierService.setPreferredSupplier', async () => {
      const expected = { id: 's-1', preferred: true };
      supplierService.setPreferredSupplier.mockResolvedValue(expected);

      const result = await facade.setPreferredSupplier('s-1', 'org-1');

      expect(supplierService.setPreferredSupplier).toHaveBeenCalledWith('s-1', 'org-1');
      expect(result).toBe(expected);
    });

    it('should delegate recordSupplierOrder to supplierService.recordOrder', async () => {
      const items = [{ name: 'Quantanium', quantity: 10, unitPrice: 500 }];
      const deliveryDate = new Date('2026-03-01');
      const expected = { id: 'o-1', items, status: 'pending' };
      supplierService.recordOrder.mockResolvedValue(expected);

      const result = await facade.recordSupplierOrder(
        's-1',
        'org-1',
        items,
        deliveryDate,
        'Urgent'
      );

      expect(supplierService.recordOrder).toHaveBeenCalledWith(
        's-1',
        'org-1',
        items,
        deliveryDate,
        'Urgent'
      );
      expect(result).toBe(expected);
    });

    it('should delegate completeSupplierOrder to supplierService.completeOrder', async () => {
      const deliveryDate = new Date('2026-02-28');
      const expected = { id: 'o-1', status: 'completed' };
      supplierService.completeOrder.mockResolvedValue(expected);

      const result = await facade.completeSupplierOrder('o-1', deliveryDate, 4.5);

      expect(supplierService.completeOrder).toHaveBeenCalledWith('o-1', deliveryDate, 4.5);
      expect(result).toBe(expected);
    });

    it('should delegate cancelSupplierOrder to supplierService.cancelOrder', async () => {
      const expected = { id: 'o-1', status: 'cancelled' };
      supplierService.cancelOrder.mockResolvedValue(expected);

      const result = await facade.cancelSupplierOrder('o-1');

      expect(supplierService.cancelOrder).toHaveBeenCalledWith('o-1');
      expect(result).toBe(expected);
    });

    it('should delegate getSupplierOrders to supplierService.getSupplierOrders', async () => {
      const expected = [{ id: 'o-1' }];
      supplierService.getSupplierOrders.mockResolvedValue(expected);

      const result = await facade.getSupplierOrders('s-1', 'pending' as any);

      expect(supplierService.getSupplierOrders).toHaveBeenCalledWith('s-1', 'pending');
      expect(result).toBe(expected);
    });

    it('should delegate getOrganizationOrders to supplierService', async () => {
      const expected = [{ id: 'o-1' }, { id: 'o-2' }];
      supplierService.getOrganizationOrders.mockResolvedValue(expected);

      const result = await facade.getOrganizationOrders('org-1', 'completed' as any);

      expect(supplierService.getOrganizationOrders).toHaveBeenCalledWith('org-1', 'completed');
      expect(result).toBe(expected);
    });

    it('should delegate compareSuppliers to supplierService.compareSuppliers', async () => {
      const weights = { reliability: 0.4, quality: 0.3, price: 0.2, deliveryTime: 0.1 };
      const expected = { rankings: [], bestOverall: null };
      supplierService.compareSuppliers.mockResolvedValue(expected);

      const result = await facade.compareSuppliers('org-1', 'Laranite', weights);

      expect(supplierService.compareSuppliers).toHaveBeenCalledWith('org-1', 'Laranite', weights);
      expect(result).toBe(expected);
    });

    it('should delegate getSupplierPerformanceReport to supplierService.getPerformanceReport', async () => {
      const expected = {
        totalSuppliers: 5,
        activeSuppliers: 3,
        preferredSuppliers: 1,
        averageReliabilityScore: 0.9,
        totalSpent: 80000,
        topSuppliers: [],
        lowPerformers: [],
      };
      supplierService.getPerformanceReport.mockResolvedValue(expected);

      const result = await facade.getSupplierPerformanceReport('org-1');

      expect(supplierService.getPerformanceReport).toHaveBeenCalledWith('org-1');
      expect(result).toBe(expected);
    });

    it('should delegate getRecommendedSupplier to supplierService.getRecommendedSupplier', async () => {
      const expected = { id: 's-1', name: 'Best Supplier' };
      supplierService.getRecommendedSupplier.mockResolvedValue(expected);

      const result = await facade.getRecommendedSupplier('org-1', 'Titanium');

      expect(supplierService.getRecommendedSupplier).toHaveBeenCalledWith('org-1', 'Titanium');
      expect(result).toBe(expected);
    });
  });

  // ====================== ROUTE OPTIMIZATION OPERATIONS ======================
  describe('Route Optimization Operations', () => {
    it('should delegate optimizeLogisticsRoute to routeOptimizationService.optimizeRoute', async () => {
      const options = { organizationId: 'org-1', waypoints: ['A', 'B', 'C'] } as any;
      const expected = { id: 'lr-1', optimizedPath: ['A', 'C', 'B'] };
      routeOptimizationService.optimizeRoute.mockResolvedValue(expected);

      const result = await facade.optimizeLogisticsRoute(options);

      expect(routeOptimizationService.optimizeRoute).toHaveBeenCalledWith(options);
      expect(result).toBe(expected);
    });

    it('should delegate getOptimizedRoute to routeOptimizationService.getRoute', async () => {
      const expected = { id: 'lr-1', optimizedPath: ['A', 'B'] };
      routeOptimizationService.getRoute.mockResolvedValue(expected);

      const result = await facade.getOptimizedRoute('lr-1');

      expect(routeOptimizationService.getRoute).toHaveBeenCalledWith('lr-1');
      expect(result).toBe(expected);
    });

    it('should delegate getOrganizationOptimizedRoutes to routeOptimizationService', async () => {
      const expected = [{ id: 'lr-1' }, { id: 'lr-2' }];
      routeOptimizationService.getOrganizationRoutes.mockResolvedValue(expected);

      const result = await facade.getOrganizationOptimizedRoutes('org-1');

      expect(routeOptimizationService.getOrganizationRoutes).toHaveBeenCalledWith('org-1');
      expect(result).toBe(expected);
    });

    it('should delegate deleteOptimizedRoute to routeOptimizationService.deleteRoute', async () => {
      routeOptimizationService.deleteRoute.mockResolvedValue(true);

      const result = await facade.deleteOptimizedRoute('lr-1');

      expect(routeOptimizationService.deleteRoute).toHaveBeenCalledWith('lr-1');
      expect(result).toBe(true);
    });

    it('should delegate analyzeSupplyChain to routeOptimizationService.analyzeSupplyChain', async () => {
      const expected = { bottlenecks: ['Port Olisar'], score: 0.72 };
      routeOptimizationService.analyzeSupplyChain.mockResolvedValue(expected);

      const result = await facade.analyzeSupplyChain('org-1');

      expect(routeOptimizationService.analyzeSupplyChain).toHaveBeenCalledWith('org-1');
      expect(result).toBe(expected);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
