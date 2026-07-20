import { OrganizationPermission, PermissionAction, PermissionScope, PermissionTemplates, ResourceType } from '../../models/OrganizationPermission';
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    matchedPermissions?: OrganizationPermission[];
}
export declare class OrganizationPermissionService {
    private readonly permissionRepository;
    private readonly organizationRepository;
    private readonly membershipRepository;
    checkPermission(userId: string, orgId: string, resource: ResourceType, action: PermissionAction, resourceId?: string, requestIP?: string): Promise<PermissionCheckResult>;
    checkMultiplePermissions(userId: string, orgId: string, checks: Array<{
        resource: ResourceType;
        action: PermissionAction;
        resourceId?: string;
    }>): Promise<Map<string, PermissionCheckResult>>;
    isOwnerOrAdmin(userId: string, orgId: string): Promise<boolean>;
    getUserPermissions(userId: string, orgId: string): Promise<OrganizationPermission[]>;
    private getInheritedPermissions;
    getOrganizationPermissions(orgId: string): Promise<OrganizationPermission[]>;
    getRolePermissions(orgId: string, roleId: string): Promise<OrganizationPermission[]>;
    grantPermission(orgId: string, userId: string, permissionData: Partial<OrganizationPermission>, grantedBy: string): Promise<OrganizationPermission>;
    grantMultiplePermissions(orgId: string, userId: string, permissions: Array<Partial<OrganizationPermission>>, grantedBy: string): Promise<OrganizationPermission[]>;
    revokePermission(permissionId: string): Promise<void>;
    revokeAllUserPermissions(userId: string, orgId: string): Promise<void>;
    updatePermission(permissionId: string, updates: Partial<OrganizationPermission>): Promise<OrganizationPermission>;
    applyPermissionTemplate(orgId: string, userId: string, templateName: keyof typeof PermissionTemplates, grantedBy: string): Promise<OrganizationPermission[]>;
    getAvailableTemplates(): Array<{
        name: string;
        description: string;
    }>;
    propagateToChildren(orgId: string, permissionId: string): Promise<void>;
    cleanupExpiredPermissions(): Promise<number>;
    cleanupOrphanedPermissions(): Promise<number>;
    getPermissionStats(orgId: string): Promise<{
        totalPermissions: number;
        activePermissions: number;
        inheritedPermissions: number;
        directPermissions: number;
        permissionsByResource: Record<string, number>;
        userCount: number;
    }>;
    batchGrantPermissions(orgId: string, grants: Array<{
        userId: string;
        resource: ResourceType;
        actions: PermissionAction[];
        scope?: PermissionScope;
        resourceId?: string;
        expiresAt?: Date;
        metadata?: Record<string, unknown>;
    }>, grantedBy: string): Promise<OrganizationPermission[]>;
    batchRevokePermissions(permissionIds: string[]): Promise<void>;
    batchGrantUserPermissions(orgId: string, userId: string, permissions: Array<{
        resource: ResourceType;
        actions: PermissionAction[];
    }>, grantedBy: string): Promise<OrganizationPermission[]>;
    batchGrantSamePermissions(orgId: string, userIds: string[], permissions: Array<{
        resource: ResourceType;
        actions: PermissionAction[];
    }>, grantedBy: string): Promise<OrganizationPermission[]>;
}
//# sourceMappingURL=OrganizationPermissionService.d.ts.map