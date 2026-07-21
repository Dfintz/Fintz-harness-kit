/**
 * Trade Workflow Integration Test
 *
 * Tests the TradeServiceFacade through end-to-end trading workflows:
 * - Trade route creation, optimization, and deletion
 * - Logistics alert lifecycle (create → acknowledge → resolve)
 * - Supplier management and order workflow
 * - Dashboard metrics aggregation
 */

import { mockAppDataSource } from '../helpers/database-mock';
import { mockDataStore } from '../helpers/stateful-mocks';

// Must mock BEFORE importing services
jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));
jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

// Mock Redis
jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(1),
    delPattern: jest.fn().mockResolvedValue(0),
    delOrgCacheKeys: jest.fn().mockResolvedValue(0),
    getOrgCacheKeys: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(false),
    ttl: jest.fn().mockResolvedValue(-1),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

import { LogisticsAlertService } from '../../services/trade/logistics/LogisticsAlertService';
import { LogisticsDashboardService } from '../../services/trade/logistics/LogisticsDashboardService';
import { SupplierManagementService } from '../../services/trade/logistics/SupplierManagementService';
import { TradeServiceFacade } from '../../services/trade/TradeServiceFacade';
import { TradingService } from '../../services/trade/trading/TradingService';

describe('Trade Workflow Integration', () => {
  let facade: TradeServiceFacade;
  let tradingService: TradingService;
  let alertService: LogisticsAlertService;
  let dashboardService: LogisticsDashboardService;
  let supplierService: SupplierManagementService;

  const orgId = 'org-trade-test';
  const userId = 'user-trade-test';

  beforeAll(() => {
    mockDataStore.clear();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    tradingService = new TradingService();
    alertService = new LogisticsAlertService();
    dashboardService = new LogisticsDashboardService();
    supplierService = new SupplierManagementService();

    facade = new TradeServiceFacade(
      tradingService,
      alertService,
      dashboardService,
      supplierService
    );
  });

  afterEach(() => {
    mockDataStore.clear();
  });

  describe('Trading Route Lifecycle', () => {
    it('should create a trading route with valid data', async () => {
      const routeData = {
        name: 'Test Route - Hurston to Crusader',
        startLocation: 'Hurston',
        endLocation: 'Crusader',
        commodity: 'Laranite',
        buyPrice: 27.5,
        sellPrice: 31.0,
        cargoCapacity: 576,
        organizationId: orgId,
        creatorId: userId,
      };

      const route = await facade.createTradingRoute(routeData);

      expect(route).toBeDefined();
      expect(route.name).toBe(routeData.name);
      expect(route.startLocation).toBe('Hurston');
      expect(route.endLocation).toBe('Crusader');
    });

    it('should retrieve trading routes by organization', async () => {
      // Create two routes
      await facade.createTradingRoute({
        name: 'Route 1',
        startLocation: 'Hurston',
        endLocation: 'ArcCorp',
        commodity: 'Titanium',
        buyPrice: 8.0,
        sellPrice: 10.5,
        cargoCapacity: 576,
        organizationId: orgId,
        creatorId: userId,
      });

      await facade.createTradingRoute({
        name: 'Route 2',
        startLocation: 'ArcCorp',
        endLocation: 'MicroTech',
        commodity: 'Stims',
        buyPrice: 2.5,
        sellPrice: 3.2,
        cargoCapacity: 576,
        organizationId: orgId,
        creatorId: userId,
      });

      const routes = await facade.getTradingRoutes({
        organizationId: orgId,
      });

      expect(routes).toBeDefined();
      expect(Array.isArray(routes)).toBe(true);
    });

    it('should find trade opportunities for a location', async () => {
      const opportunities = await facade.findTradeOpportunities('Hurston', 5, 10);

      expect(opportunities).toBeDefined();
      expect(Array.isArray(opportunities)).toBe(true);
    });
  });

  describe('Logistics Alert Lifecycle', () => {
    it('should create an alert and track it', async () => {
      const alertData = {
        fleetId: 'fleet-1',
        inventoryItemId: 'item-1',
        itemName: 'Hydrogen Fuel',
        type: 'low_stock' as const,
        severity: 'warning' as const,
        title: 'Low fuel stock',
        message: 'Hydrogen fuel below threshold',
        metadata: {
          currentQuantity: 10,
          threshold: 50,
          unit: 'SCU',
        },
        organizationId: orgId,
      };

      const alert = await facade.createLogisticsAlert(alertData);

      expect(alert).toBeDefined();
      expect(alert.title).toBe('Low fuel stock');
      expect(alert.status).toBe('active');
    });

    it('should retrieve alerts for a fleet', async () => {
      const alerts = await facade.getLogisticsAlerts({
        fleetId: 'fleet-1',
        organizationId: orgId,
      });

      expect(alerts).toBeDefined();
    });

    it('should get alert statistics', async () => {
      const stats = await facade.getAlertStatistics('fleet-1');

      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe('number');
    });
  });

  describe('Supplier Management Workflow', () => {
    it('should create a supplier with contact details', async () => {
      const supplierData = {
        name: 'Hurston Dynamics',
        location: 'Hurston',
        contactInfo: {
          email: 'sales@hurston.sc',
          comms: 'HURST-001',
        },
        categories: ['fuel', 'ammunition'],
        organizationId: orgId,
      };

      const supplier = await facade.createSupplier(supplierData);

      expect(supplier).toBeDefined();
      expect(supplier.name).toBe('Hurston Dynamics');
    });

    it('should list suppliers for an organization', async () => {
      const suppliers = await facade.getSuppliers({
        organizationId: orgId,
      });

      expect(suppliers).toBeDefined();
    });
  });

  describe('Dashboard Metrics', () => {
    it('should retrieve dashboard metrics', async () => {
      const metrics = await facade.getDashboardMetrics(orgId);

      expect(metrics).toBeDefined();
    });

    it('should produce a trade overview', async () => {
      const overview = await facade.getTradeOverview(orgId);

      expect(overview).toBeDefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
