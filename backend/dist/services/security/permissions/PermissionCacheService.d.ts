interface CachedPermission {
    permissions: string[];
    role: string;
    securityLevel: number;
    cachedAt: number;
    expiresAt: number;
}
interface PermissionCacheConfig {
    ttlMs: number;
    maxEntries: number;
    cleanupIntervalMs: number;
}
export declare class PermissionCacheService {
    private static instance;
    private readonly cache;
    private readonly config;
    private cleanupTimer;
    private readonly permissionRepository;
    private readonly userOrgRepository;
    private constructor();
    static getInstance(config?: Partial<PermissionCacheConfig>): PermissionCacheService;
    private getCacheKey;
    getPermissions(userId: string, organizationId: string): Promise<CachedPermission | null>;
    refreshCache(userId: string, organizationId: string): Promise<CachedPermission | null>;
    hasPermission(userId: string, organizationId: string, resource: string, action: string): Promise<boolean>;
    invalidate(userId: string, organizationId: string): void;
    invalidateUser(userId: string): void;
    invalidateOrganization(organizationId: string): void;
    clearAll(): void;
    getStats(): {
        size: number;
        maxSize: number;
        ttlMs: number;
        hitRate: number;
    };
    private evictOldestEntries;
    private cleanup;
    private startCleanupTimer;
    stop(): void;
}
export {};
//# sourceMappingURL=PermissionCacheService.d.ts.map