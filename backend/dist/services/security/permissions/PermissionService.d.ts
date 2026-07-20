import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { Permission } from '../../../models/Permission';
import { SecurityLevel } from '../../../models/SecurityLevel';
export declare class PermissionService {
    private permissionRepository;
    private userOrgRepository;
    private securityLevelRepository;
    hasPermission(userId: string, organizationId: string, resource: string, action: string): Promise<boolean>;
    grantPermission(userId: string, organizationId: string, resource: string, action: string, grantedBy: string, expiresAt?: Date): Promise<Permission>;
    revokePermission(userId: string, organizationId: string, resource: string, action: string, revokedBy: string): Promise<void>;
    getUserPermissions(userId: string, organizationId: string): Promise<Permission[]>;
    getUsersWithPermission(organizationId: string, resource: string, action: string): Promise<Permission[]>;
    updateSecurityLevel(userId: string, organizationId: string, securityLevel: number, updatedBy: string): Promise<OrganizationMembership>;
    setInterOrgSecurityLevel(sourceOrgId: string, targetOrgId: string, level: number, resourceType: string, accessLevel: string, approvedBy: string, restrictions?: Record<string, unknown>, notes?: string, expiresAt?: Date): Promise<SecurityLevel>;
    hasInterOrgAccess(sourceOrgId: string, targetOrgId: string, resourceType: string, requiredAccessLevel?: string, requiredSecurityLevel?: number): Promise<boolean>;
    getInterOrgSecurityLevels(organizationId: string): Promise<SecurityLevel[]>;
    getAllSecurityLevels(): Promise<SecurityLevel[]>;
    revokeInterOrgSecurityLevel(sourceOrgId: string, targetOrgId: string, resourceType: string, revokedBy: string): Promise<void>;
    cleanupExpiredPermissions(): Promise<number>;
}
//# sourceMappingURL=PermissionService.d.ts.map