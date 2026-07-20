export interface AuditContext {
    ipAddress?: string;
    userAgent?: string;
    username?: string;
}
export interface IPermissionService {
    checkPermission(userId: string, orgId: string, resource: string, action: string, resourceId?: string): Promise<{
        allowed: boolean;
        reason?: string;
        missingPermission?: {
            resource: string;
            action: string;
            scope?: string;
            resourceId?: string;
        };
    }>;
}
export interface RequirePermissionOptions {
    customMessage?: string;
    resourceId?: string;
    auditContext?: AuditContext;
}
export declare function requirePermission(permissionService: IPermissionService, orgId: string, userId: string, resource: string, action: string, options?: RequirePermissionOptions): Promise<void>;
export declare function requireAnyPermission(permissionService: IPermissionService, orgId: string, userId: string, permissions: Array<{
    resource: string;
    action: string;
    resourceId?: string;
}>, options?: RequirePermissionOptions): Promise<void>;
export declare function requireAllPermissions(permissionService: IPermissionService, orgId: string, userId: string, permissions: Array<{
    resource: string;
    action: string;
    resourceId?: string;
}>, options?: RequirePermissionOptions): Promise<void>;
export declare function formatPermissionError(resource: string, action: string): string;
export interface ITeamPermissionService {
    checkTeamPermission(orgId: string, userId: string, teamId: string, resource: string, action: string): Promise<{
        allowed: boolean;
        reason?: string;
        missingPermission?: {
            resource: string;
            action: string;
            scope?: string;
            resourceId?: string;
        };
    }>;
}
export declare function requireTeamPermission(permissionService: ITeamPermissionService, orgId: string, userId: string, teamId: string, resource: string, action: string, options?: RequirePermissionOptions): Promise<void>;
//# sourceMappingURL=permissionHelpers.d.ts.map