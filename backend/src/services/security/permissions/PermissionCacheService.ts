import { AppDataSource } from '../../../data-source';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { Permission } from '../../../models/Permission';
import { logger } from '../../../utils/logger';
import { getRoleName } from '../../../utils/roleUtils';

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

/**
 * Permission caching service for improved performance
 * Issue #173: Add permission caching - Cache effective permissions with TTL
 */
export class PermissionCacheService {
  private static instance: PermissionCacheService;
  private readonly cache: Map<string, CachedPermission> = new Map();
  private readonly config: PermissionCacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly permissionRepository = AppDataSource.getRepository(Permission);
  private readonly userOrgRepository = AppDataSource.getRepository(OrganizationMembership);

  private constructor(config?: Partial<PermissionCacheConfig>) {
    this.config = {
      ttlMs: config?.ttlMs || 5 * 60 * 1000, // 5 minutes default
      maxEntries: config?.maxEntries || 10000,
      cleanupIntervalMs: config?.cleanupIntervalMs || 60 * 1000, // 1 minute
    };
    this.startCleanupTimer();
  }

  public static getInstance(config?: Partial<PermissionCacheConfig>): PermissionCacheService {
    if (!PermissionCacheService.instance) {
      PermissionCacheService.instance = new PermissionCacheService(config);
    }
    return PermissionCacheService.instance;
  }

  /**
   * Generate cache key for user-organization pair
   */
  private getCacheKey(userId: string, organizationId: string): string {
    return `${userId}:${organizationId}`;
  }

  /**
   * Get cached permissions for a user in an organization
   */
  public async getPermissions(
    userId: string,
    organizationId: string
  ): Promise<CachedPermission | null> {
    const key = this.getCacheKey(userId, organizationId);
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    // Cache miss or expired - fetch from database
    return this.refreshCache(userId, organizationId);
  }

  /**
   * Refresh cache for a user-organization pair
   */
  public async refreshCache(
    userId: string,
    organizationId: string
  ): Promise<CachedPermission | null> {
    try {
      // Get user organization membership
      const userOrg = await this.userOrgRepository.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (!userOrg) {
        return null;
      }

      // Get explicit permissions
      const permissions = await this.permissionRepository.find({
        where: { userId, organizationId, granted: true },
      });

      // Filter out expired permissions
      const validPermissions = permissions
        .filter(p => !p.expiresAt || p.expiresAt > new Date())
        .map(p => `${p.resource}:${p.action}`);

      // Combine with custom permissions from UserOrganization
      const allPermissions = [...validPermissions, ...(userOrg.permissions || [])];

      const cachedPermission: CachedPermission = {
        permissions: [...new Set(allPermissions)], // Deduplicate
        role: getRoleName(userOrg.role),
        securityLevel: userOrg.securityLevel || 1,
        cachedAt: Date.now(),
        expiresAt: Date.now() + this.config.ttlMs,
      };

      // Enforce max entries
      if (this.cache.size >= this.config.maxEntries) {
        this.evictOldestEntries(Math.floor(this.config.maxEntries * 0.1));
      }

      const key = this.getCacheKey(userId, organizationId);
      this.cache.set(key, cachedPermission);

      return cachedPermission;
    } catch (error: unknown) {
      logger.error('Error refreshing permission cache', { userId, organizationId, error });
      return null;
    }
  }

  /**
   * Check if user has a specific permission (with caching)
   */
  public async hasPermission(
    userId: string,
    organizationId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const cached = await this.getPermissions(userId, organizationId);

    if (!cached) {
      return false;
    }

    // Owners, founders, and admins have all permissions
    if (cached.role === 'owner' || cached.role === 'founder' || cached.role === 'admin') {
      return true;
    }

    const permissionKey = `${resource}:${action}`;
    return cached.permissions.includes(permissionKey);
  }

  /**
   * Invalidate cache for a user-organization pair
   */
  public invalidate(userId: string, organizationId: string): void {
    const key = this.getCacheKey(userId, organizationId);
    this.cache.delete(key);
    logger.debug('Permission cache invalidated', { userId, organizationId });
  }

  /**
   * Invalidate all cache entries for a user
   */
  public invalidateUser(userId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    logger.debug('Permission cache invalidated for user', { userId, count: keysToDelete.length });
  }

  /**
   * Invalidate all cache entries for an organization
   */
  public invalidateOrganization(organizationId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${organizationId}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    logger.debug('Permission cache invalidated for organization', {
      organizationId,
      count: keysToDelete.length,
    });
  }

  /**
   * Clear entire cache
   */
  public clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Permission cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      ttlMs: this.config.ttlMs,
      hitRate: 0, // Could be tracked with additional counters
    };
  }

  /**
   * Evict oldest entries from cache
   */
  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
      .slice(0, count);

    entries.forEach(([key]) => this.cache.delete(key));
    logger.debug('Evicted oldest cache entries', { count: entries.length });
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      logger.debug('Permission cache cleanup', { expiredRemoved: keysToDelete.length });
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs);
    // Allow process shutdown in test/runtime contexts while keeping periodic cleanup behavior.
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  public stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

