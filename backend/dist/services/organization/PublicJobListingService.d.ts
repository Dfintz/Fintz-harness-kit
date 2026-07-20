import { type ParticipantInfo, type ShipRequirement } from '@sc-fleet-manager/shared-types';
import { JobType, ListingCategory, ListingOwnerType, PayType, PublicJobListing, type ApprovedVehicle } from '../../models/PublicJobListing';
import { OrgPrimaryFocus } from '../../models/PublicOrgProfile';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface JobListingFilterOptions {
    organizationId?: string;
    allianceId?: string;
    ownerType?: ListingOwnerType;
    jobTypes?: JobType[];
    focuses?: OrgPrimaryFocus[];
    payTypes?: PayType[];
    minPay?: number;
    maxPay?: number;
    maxExperienceLevel?: number;
    searchTerm?: string;
    isActive?: boolean;
    includeExpired?: boolean;
    listingCategory?: ListingCategory;
}
export interface PublicJobListItem {
    id: string;
    organizationId?: string;
    organizationName?: string;
    organizationLogoUrl?: string;
    allianceId?: string;
    allianceName?: string;
    ownerType: ListingOwnerType;
    listingCategory: ListingCategory;
    title: string;
    description?: string;
    jobType: JobType;
    focus: OrgPrimaryFocus;
    payType?: PayType;
    payMin?: number;
    payMax?: number;
    payDisplay: string;
    experienceLevel: number;
    isActive: boolean;
    postedAt: Date;
    expiresAt?: Date;
    contactInfo?: string;
    timezone?: string;
    languages?: string[];
    tags?: string[];
    crewSpotsTotal?: number;
    crewSpotsFilled?: number;
    requiredShips?: ShipRequirement[];
    shipRequirementType?: string;
    shipCrewBreakdown?: Array<{
        shipName: string;
        crewCapacity: number;
        roles: Array<{
            role: string;
            total: number;
            filled: number;
            assignedUserId?: string | null;
            assignedUserName?: string | null;
        }>;
        isLoaner?: boolean;
        contributedByUserId?: string | null;
        contributedByUserName?: string | null;
        cargo?: number;
        quantumFuelCapacity?: number;
    }>;
    approvedVehicles?: ApprovedVehicle[];
    createdBy?: string;
    totalScu?: number;
    averageQuantumFuel?: number;
}
export interface CreateJobListingInput {
    organizationId?: string;
    allianceId?: string;
    ownerType: ListingOwnerType;
    listingCategory?: ListingCategory;
    title: string;
    description?: string;
    jobType: JobType;
    focus: OrgPrimaryFocus;
    payType?: PayType;
    payMin?: number;
    payMax?: number;
    experienceLevel?: number;
    expiresAt?: Date;
    createdBy?: string;
    contactInfo?: string;
    timezone?: string;
    languages?: string[];
    tags?: string[];
    crewSpotsTotal?: number;
    crewSpotsFilled?: number;
    requiredShips?: ShipRequirement[];
    shipRequirementType?: string;
}
export interface UpdateJobListingInput {
    listingCategory?: ListingCategory;
    title?: string;
    description?: string;
    jobType?: JobType;
    focus?: OrgPrimaryFocus;
    payType?: PayType;
    payMin?: number;
    payMax?: number;
    experienceLevel?: number;
    isActive?: boolean;
    expiresAt?: Date;
    contactInfo?: string;
    timezone?: string;
    languages?: string[];
    tags?: string[];
}
export interface JobListingStats {
    totalListings: number;
    activeListings: number;
    organizationListings: number;
    allianceListings: number;
    userListings: number;
    jobListings: number;
    serviceListings: number;
    byJobType: Record<string, number>;
    byFocus: Record<string, number>;
}
export declare class PublicJobListingService {
    private readonly jobRepository;
    private readonly organizationRepository;
    private readonly shipService;
    constructor();
    private withJobLock;
    private getAssignedUserIds;
    private enrichWithShipStats;
    private enrichMultipleWithShipStats;
    private applyShipStatsToItem;
    private applyJobFilters;
    private applyArrayFilters;
    private applyRangeAndTextFilters;
    getPublicJobListings(filters?: JobListingFilterOptions, pagination?: PaginationOptions): Promise<PaginatedResponse<PublicJobListItem>>;
    getJobListing(identifier: string): Promise<PublicJobListItem | null>;
    getJobListingInternal(jobId: string): Promise<PublicJobListing | null>;
    createJobListing(input: CreateJobListingInput): Promise<PublicJobListing>;
    updateJobListing(jobId: string, input: UpdateJobListingInput): Promise<PublicJobListing | null>;
    deleteJobListing(jobId: string): Promise<boolean>;
    deactivateJobListing(jobId: string): Promise<PublicJobListing | null>;
    getOrganizationJobCount(organizationId: string): Promise<number>;
    getAllianceJobCount(allianceId: string): Promise<number>;
    getOrganizationJobCounts(organizationIds: string[]): Promise<Map<string, number>>;
    getAllianceJobCounts(allianceIds: string[]): Promise<Map<string, number>>;
    getOrganizationListings(organizationId: string, includeInactive?: boolean): Promise<PublicJobListing[]>;
    getAllianceListings(allianceId: string, includeInactive?: boolean): Promise<PublicJobListing[]>;
    getJobListingStats(): Promise<JobListingStats>;
    getJobTypeOptions(): JobType[];
    getPayTypeOptions(): PayType[];
    cleanupExpiredListings(): Promise<number>;
    static toParticipantInfo(listing: Pick<PublicJobListing, 'id' | 'organizationId' | 'createdBy' | 'postedAt' | 'isActive' | 'expiresAt'>, options?: {
        username?: string;
        displayName?: string;
    }): ParticipantInfo;
    toParticipantInfo(listing: Pick<PublicJobListing, 'id' | 'organizationId' | 'createdBy' | 'postedAt' | 'isActive' | 'expiresAt'>, options?: {
        username?: string;
        displayName?: string;
    }): ParticipantInfo;
    assignCrewRole(jobId: string, shipIndex: number, roleIndex: number, userId: string, userName: string): Promise<PublicJobListing>;
    unassignCrewRole(jobId: string, shipIndex: number, roleIndex: number): Promise<PublicJobListing>;
    markShipAsLoaner(jobId: string, shipIndex: number, contributorUserId: string, contributorUserName: string): Promise<PublicJobListing>;
    private static calculateCrewTotal;
}
//# sourceMappingURL=PublicJobListingService.d.ts.map