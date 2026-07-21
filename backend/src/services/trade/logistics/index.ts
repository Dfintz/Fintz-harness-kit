/**
 * Trade Domain - Logistics Submodule
 * 
 * Services for logistics dashboard, alerts, and supply chain management
 * Part of the unified Trade domain for commodity and supply chain management
 */

export { LogisticsDashboardService } from './LogisticsDashboardService';
export type { DashboardMetrics, CategoryBreakdown, AlertSummary, OperationsSummary, SupplierPerformance, ConsumptionReport } from './LogisticsDashboardService';
export { LogisticsAlertService } from './LogisticsAlertService';
export type { RestockRecommendation } from './LogisticsAlertService';

// Supplier Management Service
export { 
    SupplierManagementService, 
    supplierManagementService, 
    SupplierStatus, 
    SupplierCategory 
} from './SupplierManagementService';
export type { 
    Supplier, 
    SupplierMetrics, 
    CreateSupplierDto, 
    UpdateSupplierDto, 
    SupplierOrder, 
    SupplierFilterOptions, 
    SupplierComparison 
} from './SupplierManagementService';

// Logistics Route Optimization Service
export { 
    LogisticsRouteOptimizationService, 
    logisticsRouteOptimizationService 
} from './LogisticsRouteOptimizationService';
export type { 
    LogisticsWaypoint, 
    OptimizedLogisticsRoute, 
    RouteEfficiency, 
    RouteOptimizationOptions, 
    SupplyChainAnalysis 
} from './LogisticsRouteOptimizationService';

