import type { ShipCondition, ShipOwnershipStatus, ShipSharingLevel, UserShip } from '../../models/UserShip';
export interface UserShipFilters {
    userId?: string;
    shipId?: string;
    shipName?: string;
    status?: ShipOwnershipStatus | ShipOwnershipStatus[];
    condition?: ShipCondition | ShipCondition[];
    isLoaned?: boolean;
    needsInsurance?: boolean;
    location?: string;
    tags?: string[];
    search?: string;
    sharingLevel?: ShipSharingLevel | ShipSharingLevel[];
    accessibleToUser?: string;
    sharedWithOrg?: string;
}
export interface CreateUserShipDto {
    userId: string;
    shipId?: string;
    shipName: string;
    customName?: string;
    status?: ShipOwnershipStatus;
    condition?: ShipCondition;
    acquiredDate?: Date;
    acquiredPrice?: number;
    acquiredCurrency?: string;
    insuranceLevel?: string;
    insuranceExpires?: Date;
    location?: string;
    hangar?: string;
    description?: string;
    notes?: string;
    tags?: string[];
    sharingLevel?: ShipSharingLevel;
    sharedWithUsers?: string[];
    erkulLoadoutUrl?: string;
}
export interface UpdateUserShipDto {
    customName?: string;
    status?: ShipOwnershipStatus;
    condition?: ShipCondition;
    location?: string;
    hangar?: string;
    insuranceLevel?: string;
    insuranceExpires?: Date;
    loanedFrom?: string;
    loanedTo?: string;
    loanExpires?: Date;
    description?: string;
    notes?: string;
    tags?: string[];
    isActive?: boolean;
    modifications?: Record<string, unknown>;
    flightHours?: number;
    missionsCompleted?: number;
    totalEarnings?: number;
    sharingLevel?: ShipSharingLevel;
    sharedWithUsers?: string[];
    sharedWithOrgs?: string[];
    erkulLoadoutUrl?: string;
}
export interface ShipInsuranceStatus {
    daysUntilExpiration: number;
    ship: UserShip;
}
export interface UserShipListFilters {
    status?: string;
    condition?: string;
    manufacturer?: string;
    sharingLevel?: string;
    search?: string;
    productionStatus?: string;
}
export interface UserShipListOptions {
    limit: number;
    offset: number;
    sortField?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export interface UserShipListResult {
    data: Array<UserShip & {
        productionStatus?: string;
    }>;
    total: number;
}
//# sourceMappingURL=UserShipService.types.d.ts.map