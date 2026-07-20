import { Repository } from 'typeorm';
import { ShipSharingLevel, UserShip } from '../../models/UserShip';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import type { CreateUserShipDto, ShipInsuranceStatus, UpdateUserShipDto, UserShipFilters, UserShipListFilters, UserShipListOptions, UserShipListResult } from './UserShipService.types';
export type { CreateUserShipDto, ShipInsuranceStatus, UpdateUserShipDto, UserShipFilters, UserShipListFilters, UserShipListOptions, UserShipListResult, } from './UserShipService.types';
export declare class UserShipService {
    protected repository: Repository<UserShip>;
    private readonly shipNameCache;
    private readonly cacheTTL;
    private cacheTimestamp;
    constructor();
    private resolveShipId;
    createUserShip(data: CreateUserShipDto): Promise<UserShip>;
    bulkCreateUserShips(userId: string, shipsData: Omit<CreateUserShipDto, 'userId'>[]): Promise<{
        created: number;
        failed: number;
        errors: string[];
    }>;
    getUserShipById(shipId: string): Promise<UserShip | null>;
    getUserShips(userId: string, options?: PaginationOptions): Promise<PaginatedResponse<UserShip>>;
    findMyShips(userId: string, filters: UserShipListFilters, options: UserShipListOptions): Promise<UserShipListResult>;
    findPublicShips(targetUserId: string, requestingUserId: string, options: UserShipListOptions): Promise<UserShipListResult>;
    findUserShips(organizationId: string, filters: UserShipFilters, options?: PaginationOptions): Promise<PaginatedResponse<UserShip>>;
    updateUserShip(organizationId: string, shipId: string, updates: UpdateUserShipDto): Promise<UserShip | null>;
    loanShip(organizationId: string, shipId: string, loanedTo: string, options?: {
        expiresAt?: Date;
        scope?: string;
        startDate?: Date;
        purpose?: string;
        activityId?: string;
        activityName?: string;
    }): Promise<UserShip | null>;
    returnLoanedShip(organizationId: string, shipId: string): Promise<UserShip | null>;
    getShipsNeedingInsurance(userId?: string, daysThreshold?: number): Promise<ShipInsuranceStatus[]>;
    private static readonly ALLOWED_SORT_FIELDS;
    private getOrgMemberUserIds;
    private emptyPaginatedResponse;
    private safeSortBy;
    getOrgAvailableShips(organizationId: string, options?: PaginationOptions): Promise<PaginatedResponse<UserShip & {
        ownerName?: string;
    }>>;
    getUserShipSummary(organizationId: string, userId: string): Promise<{
        totalShips: number;
        byStatus: Record<string, number>;
        byCondition: Record<string, number>;
        bySharingLevel: Record<string, number>;
        bySize: Record<string, number>;
        byRole: Record<string, number>;
        byCareer: Record<string, number>;
        byManufacturer: Record<string, number>;
        totalValue: number;
        needsInsurance: number;
    }>;
    private enrichWithCatalogStatus;
    private incrementCatalogBreakdown;
    deleteUserShip(organizationId: string, shipId: string): Promise<boolean>;
    bulkDeleteAllUserShips(userId: string): Promise<number>;
    updateSharingLevel(organizationId: string, shipId: string, sharingLevel: ShipSharingLevel, sharedWithUsers?: string[]): Promise<UserShip | null>;
    shareWithUsers(organizationId: string, shipId: string, userIds: string[]): Promise<UserShip | null>;
    unshareFromUser(organizationId: string, shipId: string, userId: string): Promise<UserShip | null>;
    shareWithOrganizations(shipId: string, targetOrgIds: string[]): Promise<UserShip | null>;
    getShipsSharedWithOrg(userIds: string[], options?: PaginationOptions): Promise<PaginatedResponse<UserShip>>;
    getAccessibleShips(userId: string, options?: PaginationOptions): Promise<PaginatedResponse<UserShip>>;
    getAllianceSharedShips(organizationId: string, options?: PaginationOptions): Promise<PaginatedResponse<UserShip>>;
    updateErkulLoadoutUrl(organizationId: string, shipId: string, erkulLoadoutUrl: string): Promise<UserShip | null>;
    getOrgFleetSummary(organizationId: string): Promise<{
        totalShips: number;
        byStatus: Record<string, number>;
        byCondition: Record<string, number>;
        bySharingLevel: Record<string, number>;
        totalValue: number;
        sharedWithOrg: number;
        sharedWithAlliance: number;
    }>;
}
//# sourceMappingURL=UserShipService.d.ts.map