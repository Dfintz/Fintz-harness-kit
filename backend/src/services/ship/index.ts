/**
 * Ship Domain Services
 * Services for ship management, ownership tracking, loadout configuration,
 * maintenance scheduling, and ship comparison tools
 */

export { ShipService } from './ShipService';
export { ShipLoadoutService } from './ShipLoadoutService';
export { UserShipService } from './UserShipService';
export { OrganizationShipService } from './OrganizationShipService';
export { ShipMaintenanceService } from './ShipMaintenanceService';
export { ShipComparisonService } from './ShipComparisonService';

// Re-export types
export type { ShipFilters } from './ShipService';
export type { 
    UserShipFilters, 
    CreateUserShipDto, 
    UpdateUserShipDto,
    ShipInsuranceStatus
} from './UserShipService';
export type { 
    OrgShipFilters, 
    CreateOrgShipDto, 
    UpdateOrgShipDto 
} from './OrganizationShipService';
export type {
    MaintenanceFilters,
    CreateMaintenanceDto,
    UpdateMaintenanceDto,
    MaintenanceReminder,
    MaintenanceStats,
    MaintenanceCostSummary
} from './ShipMaintenanceService';
export type {
    ShipComparisonResult,
    ShipComparisonData,
    ComparisonCategory,
    ComparisonMetric,
    ComparisonSummary,
    ShipRecommendation,
    ShipRoleAnalysis,
    FleetCompositionAnalysis
} from './ShipComparisonService';

