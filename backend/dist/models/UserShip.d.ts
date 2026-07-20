import type { ShipCustomization } from '../types/models';
export declare enum ShipOwnershipStatus {
    OWNED = "owned",
    PLEDGED = "pledged",
    LOANED = "loaned",
    GIFTED = "gifted",
    LOST = "lost",
    DESTROYED = "destroyed",
    SOLD = "sold"
}
export declare enum ShipCondition {
    PRISTINE = "pristine",
    EXCELLENT = "excellent",
    GOOD = "good",
    FAIR = "fair",
    POOR = "poor",
    DAMAGED = "damaged",
    CRITICAL = "critical"
}
export declare enum ShipSharingLevel {
    PRIVATE = "private",
    PERSONAL = "personal",
    SHARED_USERS = "shared_users",
    ORGANIZATION = "organization",
    ALLIANCE = "alliance",
    PUBLIC = "public"
}
export declare class UserShip {
    id: string;
    userId: string;
    shipId?: string;
    shipName: string;
    customName?: string;
    status: ShipOwnershipStatus;
    condition: ShipCondition;
    acquiredDate?: Date;
    acquiredPrice?: number;
    acquiredCurrency?: string;
    insuranceLevel?: string;
    insuranceExpires?: Date;
    location?: string;
    hangar?: string;
    loanedFrom?: string;
    loanedTo?: string;
    loanExpires?: Date;
    description?: string;
    notes?: string;
    modifications?: {
        components?: string[];
        weapons?: string[];
        upgrades?: string[];
        customization?: ShipCustomization;
    };
    flightHours?: number;
    missionsCompleted?: number;
    totalEarnings?: number;
    tags?: string[];
    sharingLevel: ShipSharingLevel;
    useCustomVisibility: boolean;
    sharedWithUsers?: string[];
    visibleToOrganization: boolean;
    classificationChangedBy?: string;
    classificationChangedAt?: Date;
    classificationReason?: string;
    erkulLoadoutUrl?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    isLoaned(): boolean;
    needsInsuranceRenewal(): boolean;
    getDisplayName(): string;
    isOperational(): boolean;
    isSharedWithOrg(): boolean;
    isSharedWithUser(userId: string): boolean;
    isSharedWithAlliance(): boolean;
}
//# sourceMappingURL=UserShip.d.ts.map