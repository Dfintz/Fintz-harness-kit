import { IntelEntry } from '../../models/IntelEntry';
export declare enum IntelVisibilityLevel {
    PUBLIC = "PUBLIC",
    ORG = "ORG",
    PRIVATE = "PRIVATE"
}
export declare enum UserRoleInOrg {
    ADMIN = "admin",
    OFFICER = "officer",
    MEMBER = "member",
    GUEST = "guest"
}
export interface VisibilityCheckResult {
    canView: boolean;
    reason?: string;
    visibilityLevel?: IntelVisibilityLevel;
}
export declare class IntelVisibilityService {
    private static instance;
    private readonly intelRepo;
    private readonly membershipRepo;
    private readonly auditLogRepo;
    private userRoleCache;
    private readonly ROLE_CACHE_TTL_MS;
    constructor();
    static getInstance(): IntelVisibilityService;
    private getUserRoleInOrganization;
    clearRoleCache(userId: string, organizationId: string): void;
    canViewIntel(userId: string, intelId: string, organizationId: string): Promise<VisibilityCheckResult>;
    getVisibleIntelEntries(organizationId: string, userId: string, filters?: {
        limit?: number;
        offset?: number;
        search?: string;
    }): Promise<{
        entries: IntelEntry[];
        total: number;
    }>;
    getIntelDetails(intelId: string, organizationId: string, userId: string): Promise<IntelEntry>;
    updateIntelVisibility(intelId: string, organizationId: string, userId: string, newVisibility: IntelVisibilityLevel): Promise<IntelEntry>;
}
export declare const intelVisibilityService: IntelVisibilityService;
//# sourceMappingURL=IntelVisibilityService.d.ts.map