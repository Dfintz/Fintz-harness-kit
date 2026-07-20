import { OrganizationShip, OrgShipRole } from '../../models/OrganizationShip';
import { ShipCondition, ShipOwnershipStatus } from '../../models/UserShip';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export interface OrgShipFilters {
    shipId?: string;
    role?: OrgShipRole | OrgShipRole[];
    status?: ShipOwnershipStatus | ShipOwnershipStatus[];
    condition?: ShipCondition | ShipCondition[];
    isAvailable?: boolean;
    isCapital?: boolean;
    assignedCaptain?: string;
    location?: string;
    needsMaintenance?: boolean;
    search?: string;
}
export interface CreateOrgShipDto {
    shipId: string;
    shipName: string;
    customName?: string;
    role?: OrgShipRole;
    status?: ShipOwnershipStatus;
    condition?: ShipCondition;
    acquisitionMethod?: string;
    acquiredBy?: string;
    acquiredDate?: Date;
    acquisitionCost?: number;
    assignedCaptain?: string;
    assignedCrew?: string[];
    maxCrew?: number;
    location?: string;
    homeBase?: string;
    insuranceLevel?: string;
    insuranceExpires?: Date;
    isCapital?: boolean;
    requiresPermission?: boolean;
    minimumRank?: string;
    notes?: string;
    tags?: string[];
}
export interface UpdateOrgShipDto {
    customName?: string;
    role?: OrgShipRole;
    status?: ShipOwnershipStatus;
    condition?: ShipCondition;
    assignedCaptain?: string;
    assignedCrew?: string[];
    maxCrew?: number;
    location?: string;
    homeBase?: string;
    insuranceLevel?: string;
    insuranceExpires?: Date;
    lastMaintenance?: Date;
    nextMaintenance?: Date;
    isAvailable?: boolean;
    requiresPermission?: boolean;
    minimumRank?: string;
    notes?: string;
    tags?: string[];
    modifications?: Record<string, unknown>;
    flightHours?: number;
    missionsCompleted?: number;
    totalEarnings?: number;
    maintenanceCosts?: number;
}
export declare function attachCatalogueMetadata<T extends {
    shipId?: string;
    shipName?: string;
}>(ships: T[]): Promise<T[]>;
export declare class OrganizationShipService extends TenantService<OrganizationShip> {
    constructor();
    createOrgShip(organizationId: string, data: CreateOrgShipDto): Promise<OrganizationShip>;
    getOrgShipById(organizationId: string, shipId: string): Promise<OrganizationShip | null>;
    getOrgShips(organizationId: string, options?: PaginationOptions): Promise<PaginatedResponse<OrganizationShip>>;
    findOrgShips(organizationId: string, filters: OrgShipFilters, options?: PaginationOptions): Promise<PaginatedResponse<OrganizationShip>>;
    updateOrgShip(organizationId: string, shipId: string, updates: UpdateOrgShipDto): Promise<OrganizationShip | null>;
    assignCaptain(organizationId: string, shipId: string, captainId: string): Promise<OrganizationShip | null>;
    assignCrew(organizationId: string, shipId: string, crewIds: string[]): Promise<OrganizationShip | null>;
    addCrewMember(organizationId: string, shipId: string, userId: string, _role?: string): Promise<OrganizationShip | null>;
    removeCrewMember(organizationId: string, shipId: string, userId: string): Promise<OrganizationShip | null>;
    getShipsNeedingMaintenance(organizationId: string): Promise<OrganizationShip[]>;
    getCapitalShips(organizationId: string, options?: PaginationOptions): Promise<PaginatedResponse<OrganizationShip>>;
    getShipsByRole(organizationId: string, role: OrgShipRole, options?: PaginationOptions): Promise<PaginatedResponse<OrganizationShip>>;
    getAvailableShips(organizationId: string, options?: PaginationOptions): Promise<PaginatedResponse<OrganizationShip>>;
    getFleetSummary(organizationId: string): Promise<{
        totalShips: number;
        byRole: Record<string, number>;
        byStatus: Record<string, number>;
        byCondition: Record<string, number>;
        capitalShips: number;
        availableShips: number;
        needsMaintenance: number;
        totalValue: number;
        totalMaintenanceCosts: number;
    }>;
    deleteOrgShip(organizationId: string, shipId: string): Promise<boolean>;
    loanOrgShip(organizationId: string, shipId: string, borrowerId: string, options?: {
        purpose?: string;
        activityId?: string;
        activityName?: string;
    }): Promise<OrganizationShip | null>;
    returnOrgShipLoan(organizationId: string, shipId: string): Promise<OrganizationShip | null>;
}
//# sourceMappingURL=OrganizationShipService.d.ts.map