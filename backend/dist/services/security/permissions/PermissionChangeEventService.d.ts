export type PermissionChangeType = 'permission_added' | 'permission_removed' | 'role_updated' | 'role_assigned' | 'role_revoked' | 'roles_reordered' | 'role_deleted';
type EmissionMode = 'per_user' | 'org_fallback';
export interface PermissionChangeProcessingMetrics {
    invalidatedCount: number;
    emittedCount: number;
    failedEmitCount: number;
    emissionMode: EmissionMode;
}
export declare class PermissionChangeEventService {
    private static instance;
    private readonly permissionManager;
    private readonly permissionCacheService;
    private readonly refreshVersionByOrg;
    private readonly batchSize;
    private readonly orgFallbackThreshold;
    private constructor();
    static getInstance(): PermissionChangeEventService;
    onRolePermissionChanged(orgId: string, affectedUserIds: string[], changeType: PermissionChangeType, actorUserId: string): Promise<PermissionChangeProcessingMetrics>;
    onUserRoleChanged(orgId: string, userId: string, changeType: PermissionChangeType, actorUserId: string): Promise<PermissionChangeProcessingMetrics>;
    private processChange;
    private decideEmissionMode;
    private invalidatePermissionCaches;
    private emitSessionRefresh;
    private normalizeUserIds;
    private toChunks;
    private nextRefreshVersion;
    private resolvePositiveNumber;
}
export declare const permissionChangeEventService: PermissionChangeEventService;
export {};
//# sourceMappingURL=PermissionChangeEventService.d.ts.map