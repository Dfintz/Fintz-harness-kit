import { Organization, OrganizationStatus, OrganizationType } from '../../models/Organization';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { OrganizationActivityService } from './OrganizationActivityService';
import { OrganizationHierarchyService } from './OrganizationHierarchyService';
import { OrganizationMemberService } from './OrganizationMemberService';
import { OrganizationPermissionService } from './OrganizationPermissionService';
import { OrganizationSettingsService } from './OrganizationSettingsService';
export declare class OrganizationService {
    private readonly organizationRepository;
    private readonly membershipRepository;
    private readonly userRepository;
    private readonly cache;
    private readonly hierarchyService;
    private readonly permissionService;
    private readonly memberService;
    private readonly activityService;
    private readonly settingsService;
    private readonly deletionService;
    constructor();
    private applyOrgFilters;
    private applyBasicOrgFilters;
    private applyMemberFilters;
    private applyDateFilters;
    getOrganizations(filters?: {
        name?: string;
        type?: OrganizationType;
        status?: OrganizationStatus;
        parentOrgId?: string;
        level?: number;
        tags?: string[];
        hasMembers?: boolean;
        memberCount?: {
            min?: number;
            max?: number;
        };
        createdAfter?: Date;
        createdBefore?: Date;
    }, pagination?: PaginationOptions): Promise<PaginatedResponse<Organization>>;
    getOrganizationById(id: string, options?: {
        includeHierarchy?: boolean;
        includeMembers?: boolean;
        includeSettings?: boolean;
        includePermissions?: boolean;
        includeStats?: boolean;
    }): Promise<Organization | null>;
    createOrganization(orgData: Partial<Organization>, creatorId: string, parentId?: string): Promise<Organization>;
    updateOrganization(id: string, updates: Partial<Organization>, actorId: string): Promise<Organization>;
    renameOrganization(id: string, newName: string, actorId: string): Promise<Organization>;
    syncNameFromRsi(id: string, actorId: string): Promise<{
        organization: Organization;
        rsiName: string;
    }>;
    deleteOrganization(id: string, actorId: string, deleteDescendants?: boolean, options?: {
        reason?: string;
        gracePeriodDays?: number;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<{
        requestId: string;
        message: string;
        scheduledFor?: Date;
    }>;
    getOrganizationWithHierarchy(id: string): Promise<(Organization & {
        children?: Organization[];
    }) | null>;
    searchOrganizations(query: string, filters?: {
        type?: OrganizationType[];
        status?: OrganizationStatus[];
        hasPublicProfile?: boolean;
        minMembers?: number;
        maxMembers?: number;
        tags?: string[];
    }, pagination?: PaginationOptions): Promise<PaginatedResponse<Organization>>;
    getOrganizationStats(id: string): Promise<{
        memberStats: unknown;
        hierarchyStats: unknown;
        activitySummary: unknown;
        recentActivity: unknown[];
    }>;
    canUserAccessOrganization(userId: string, orgId: string): Promise<{
        canAccess: boolean;
        reason?: string;
        accessLevel?: 'owner' | 'admin' | 'member' | 'viewer' | 'none';
    }>;
    getHierarchyService(): OrganizationHierarchyService;
    getPermissionService(): OrganizationPermissionService;
    getMemberService(): OrganizationMemberService;
    getActivityService(): OrganizationActivityService;
    getSettingsService(): OrganizationSettingsService;
}
//# sourceMappingURL=OrganizationService.d.ts.map