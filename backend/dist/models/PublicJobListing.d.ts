import type { PassengerSlot, ShipRequirement, TransportType } from '@sc-fleet-manager/shared-types';
export interface ShipCrewRoleSlot {
    role: string;
    total: number;
    filled: number;
    assignedUserIds?: string[];
    assignedUserNames?: string[];
    assignedUserId?: string | null;
    assignedUserName?: string | null;
}
export interface ShipCrewBreakdownEntry {
    shipName: string;
    crewCapacity: number;
    roles: ShipCrewRoleSlot[];
    isLoaner?: boolean;
    contributedByUserId?: string | null;
    contributedByUserName?: string | null;
    parentShipIndex?: number;
    isTransported?: boolean;
    transportType?: TransportType;
    passengers?: PassengerSlot[];
}
export interface ApprovedVehicle {
    vehicleName: string;
    applicantUserId: string;
    applicantDisplayName: string;
    applicationId: string;
    approvedAt: string;
}
import { Organization } from './Organization';
import { OrgPrimaryFocus } from './PublicOrgProfile';
export declare enum JobType {
    CREW = "crew",
    PILOT = "pilot",
    GUNNER = "gunner",
    ENGINEER = "engineer",
    MEDIC = "medic",
    MINER = "miner",
    HAULER = "hauler",
    SCOUT = "scout",
    SECURITY = "security",
    LEADERSHIP = "leadership",
    SUPPORT = "support",
    OTHER = "other"
}
export declare enum PayType {
    FIXED = "fixed",
    HOURLY = "hourly",
    PERCENTAGE = "percentage",
    NEGOTIABLE = "negotiable",
    VOLUNTEER = "volunteer"
}
export declare enum ListingOwnerType {
    ORGANIZATION = "organization",
    ALLIANCE = "alliance",
    USER = "user"
}
export declare enum ListingCategory {
    JOB = "job",
    SERVICE = "service"
}
export declare class PublicJobListing {
    id: string;
    organizationId?: string;
    organization?: Organization;
    allianceId?: string;
    ownerType: ListingOwnerType;
    listingCategory: ListingCategory;
    title: string;
    description?: string;
    jobType: JobType;
    focus: OrgPrimaryFocus;
    payType?: PayType;
    payMin?: number;
    payMax?: number;
    experienceLevel: number;
    isActive: boolean;
    postedAt: Date;
    expiresAt?: Date;
    createdBy?: string;
    contactInfo?: string;
    timezone?: string;
    languages?: string[];
    tags?: string[];
    crewSpotsTotal?: number;
    crewSpotsFilled: number;
    requiredShips?: ShipRequirement[];
    shipRequirementType?: string;
    shipCrewBreakdown: ShipCrewBreakdownEntry[] | null;
    approvedVehicles: ApprovedVehicle[] | null;
    createdAt: Date;
    updatedAt: Date;
    isExpired(): boolean;
    isVisible(): boolean;
    getPayDisplay(): string;
}
//# sourceMappingURL=PublicJobListing.d.ts.map