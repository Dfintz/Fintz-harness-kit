import NodeCache from 'node-cache';
import { Repository } from 'typeorm';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { OrganizationPermission } from '../../../models/OrganizationPermission';
import { SecurityLevel } from '../../../models/SecurityLevel';
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    matchedPermissions?: OrganizationPermission[];
    source?: 'direct' | 'role' | 'inherited' | 'owner' | 'admin';
    missingPermission?: {
        resource: string;
        action: string;
        scope?: string;
        resourceId?: string;
    };
}
export interface PermissionCheck {
    resource: string;
    action: string;
    resourceId?: string;
}
export interface BatchPermissionResult {
    [key: string]: boolean;
}
export interface PermissionCacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
}
export interface SetInterOrgSecurityLevelOptions {
    sourceOrgId: string;
    targetOrgId: string;
    level: number;
    resourceType: string;
    accessLevel: string;
    approvedBy: string;
    restrictions?: Record<string, unknown>;
    notes?: string;
    expiresAt?: Date;
}
export declare class PermissionManagerService {
    protected repository: Repository<OrganizationPermission>;
    private readonly permissionRepository?;
    private readonly userOrgRepository;
    private readonly cache;
    private readonly cacheEnabled;
    constructor();
    protected getFromCache<V>(key: string): V | undefined;
    protected setInCache<V>(key: string, value: V, ttl?: number): void;
    protected getCacheStats(): NodeCache.Stats | null;
    hasPermission(orgId: string, userId: string, resource: string, action: string, resourceId?: string): Promise<boolean>;
    checkPermission(orgId: string, userId: string, resource: string, action: string, resourceId?: string): Promise<PermissionCheckResult>;
    hasTeamPermission(orgId: string, userId: string, teamId: string, resource: string, action: string): Promise<boolean>;
    checkTeamPermission(orgId: string, userId: string, teamId: string, resource: string, action: string): Promise<PermissionCheckResult>;
    batchCheckPermissions(orgId: string, userId: string, permissions: PermissionCheck[]): Promise<BatchPermissionResult>;
    getUserPermissions(orgId: string, userId: string): Promise<string[]>;
    getUserRole(orgId: string, userId: string): Promise<string | null>;
    getRolePermissions(roleId: string): Promise<string[]>;
    updateUserRole(orgId: string, userId: string, newRoleId: string, updatedBy: string): Promise<OrganizationMembership | null>;
    grantPermission(orgId: string, userId: string, resource: string, action: string, grantedBy: string, expiresAt?: Date, resourceId?: string): Promise<OrganizationPermission>;
    revokePermission(orgId: string, userId: string, resource: string, action: string, revokedBy: string, resourceId?: string): Promise<void>;
    private checkPermissionInternal;
    private checkRoleBasedPermission;
    private checkRoleDbPermissions;
    private checkRoleEntityPermissions;
    private checkRoleDefaultPermissions;
    private checkDirectGrantPermissions;
    private checkLegacyPermission;
    private collectActivePermissions;
    private getUserOrgRole;
    private getPermissionCacheKey;
    private getPermissionKey;
    private invalidateUserPermissionCache;
    invalidateUserPermissionCacheForUser(orgId: string, userId: string): void;
    getPermissionCacheStats(): PermissionCacheStats | null;
    clearOrganizationPermissionCache(orgId: string): void;
    private get securityLevelRepository();
    updateSecurityLevel(userId: string, organizationId: string, securityLevel: number, updatedBy: string): Promise<OrganizationMembership>;
    setInterOrgSecurityLevel(options: SetInterOrgSecurityLevelOptions): Promise<SecurityLevel>;
    hasInterOrgAccess(sourceOrgId: string, targetOrgId: string, resourceType: string, requiredAccessLevel?: string, requiredSecurityLevel?: number): Promise<boolean>;
    getInterOrgSecurityLevels(organizationId: string): Promise<SecurityLevel[]>;
    getAllSecurityLevels(): Promise<SecurityLevel[]>;
    revokeInterOrgSecurityLevel(sourceOrgId: string, targetOrgId: string, resourceType: string, revokedBy: string): Promise<void>;
    cleanupExpiredPermissions(): Promise<number>;
}
//# sourceMappingURL=PermissionManagerService.d.ts.map