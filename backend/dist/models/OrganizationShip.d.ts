import { TenantEntity } from './base/TenantEntity';
import { ShipOwnershipStatus, ShipCondition, ShipSharingLevel } from './UserShip';
export declare enum OrgShipRole {
    COMMAND = "command",
    COMBAT = "combat",
    LOGISTICS = "logistics",
    MINING = "mining",
    EXPLORATION = "exploration",
    MEDICAL = "medical",
    TRANSPORT = "transport",
    SUPPORT = "support",
    RESERVE = "reserve"
}
export declare class OrganizationShip extends TenantEntity {
    id: string;
    shipId: string;
    shipName: string;
    customName?: string;
    role: OrgShipRole;
    status: ShipOwnershipStatus;
    condition: ShipCondition;
    acquisitionMethod?: string;
    acquiredBy?: string;
    acquiredDate?: Date;
    acquisitionCost?: number;
    assignedCaptain?: string;
    assignedCrew?: string[];
    maxCrew?: number;
    location?: string;
    homeBase?: string;
    sharingLevel: ShipSharingLevel;
    minRequiredRank?: number;
    useCustomVisibility: boolean;
    insuranceLevel?: string;
    insuranceExpires?: Date;
    lastMaintenance?: Date;
    nextMaintenance?: Date;
    flightHours?: number;
    missionsCompleted?: number;
    totalEarnings?: number;
    maintenanceCosts?: number;
    modifications?: {
        components?: string[];
        weapons?: string[];
        upgrades?: string[];
        cargo?: Record<string, unknown>;
    };
    isAvailable: boolean;
    isCapital?: boolean;
    requiresPermission?: boolean;
    minimumRank?: string;
    notes?: string;
    tags?: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    getDisplayName(): string;
    needsMaintenance(): boolean;
    isOperational(): boolean;
    isReadyForUse(): boolean;
    canUserCaptain(userRank?: string): boolean;
    getCrewFillPercentage(): number;
}
//# sourceMappingURL=OrganizationShip.d.ts.map