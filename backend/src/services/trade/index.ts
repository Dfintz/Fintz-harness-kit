/**
 * Trade Domain
 *
 * Unified domain for trade and logistics management.
 * Consolidates trading operations, logistics alerts, dashboard services,
 * and supply chain management into a single cohesive domain.
 *
 * Structure:
 *   /trading - Trading routes, UIF integration, price alerts
 *   /logistics - Logistics alerts, dashboard, supply chain management, supplier management, route optimization
 */

// Re-export from logistics submodule
export {
  LogisticsAlertService,
  LogisticsDashboardService,
  LogisticsRouteOptimizationService,
  SupplierCategory,
  SupplierManagementService,
  SupplierStatus,
  logisticsRouteOptimizationService,
  supplierManagementService,
} from './logistics';

export type {
  AlertSummary,
  CategoryBreakdown,
  ConsumptionReport,
  CreateSupplierDto,
  DashboardMetrics,
  LogisticsWaypoint,
  OperationsSummary,
  OptimizedLogisticsRoute,
  RestockRecommendation,
  RouteEfficiency,
  RouteOptimizationOptions,
  Supplier,
  SupplierComparison,
  SupplierFilterOptions,
  SupplierMetrics,
  SupplierOrder,
  SupplierPerformance,
  SupplyChainAnalysis,
  UpdateSupplierDto,
} from './logistics';

// Re-export from trading submodule
export {
  AlertCondition,
  PriceAlertService,
  ROUTE_TEMPLATES,
  RiskLevel,
  RouteCategory,
  RouteDifficulty,
  RouteTemplateService,
  TradingService,
  UIFService,
  priceAlertService,
} from './trading';

export type { PriceAlertEvent, RouteTemplate } from './trading';

export { PriceAlert } from './trading';
export type { PriceAlertCondition } from './trading';

// Unified Trade Service Facade
export { TradeServiceFacade, tradeServiceFacade } from './TradeServiceFacade';

