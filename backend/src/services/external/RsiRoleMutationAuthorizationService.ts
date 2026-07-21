import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { RsiRoleMapping } from '../../models/RsiRoleMapping';
import { RsiSyncSchedule } from '../../models/RsiSyncSchedule';
import { RsiUserLink, SyncStatus } from '../../models/RsiUserLink';

const DEFAULT_AUTHZ_CACHE_TTL_MS = 30_000;
// Hard cap so a long-lived bot/worker syncing many orgs cannot grow these
// in-memory caches without bound (mirrors the replay-cache convention in
// roleIpcAuth.ts and NonceStorage). The schedule/role-mapping reads are cached
// for at most DEFAULT_AUTHZ_CACHE_TTL_MS, so a deactivated role mapping or guild
// reassignment can authorize for up to that window; user-link and membership
// checks are always read fresh and are never cached.
const MAX_AUTHZ_CACHE_ENTRIES = 5_000;

interface CacheEntry<TValue> {
  value: TValue;
  expiresAt: number;
}

export interface RoleMutationAuthorizationInput {
  organizationId: string;
  guildId: string;
  roleId: string;
  discordUserId: string;
}

/**
 * Centralized authorization policy for Discord role mutation IPC requests.
 *
 * Keeps policy checks in the RSI external domain while allowing the bot IPC
 * transport layer to stay focused on delivery and shard routing.
 */
export class RsiRoleMutationAuthorizationService {
  private readonly scheduleCache = new Map<string, CacheEntry<RsiSyncSchedule | null>>();
  private readonly roleAllowedCache = new Map<string, CacheEntry<boolean>>();

  constructor(private readonly cacheTtlMs = DEFAULT_AUTHZ_CACHE_TTL_MS) {}

  private getCachedValue<TValue>(
    cache: Map<string, CacheEntry<TValue>>,
    key: string
  ): TValue | undefined {
    const entry = cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  private setCachedValue<TValue>(
    cache: Map<string, CacheEntry<TValue>>,
    key: string,
    value: TValue
  ): void {
    this.evictIfOverCapacity(cache);
    cache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  /** Drop expired entries, then the oldest entry, when a cache reaches capacity. */
  private evictIfOverCapacity<TValue>(cache: Map<string, CacheEntry<TValue>>): void {
    if (cache.size < MAX_AUTHZ_CACHE_ENTRIES) {
      return;
    }

    const now = Date.now();
    for (const [cacheKey, entry] of cache) {
      if (entry.expiresAt <= now) {
        cache.delete(cacheKey);
      }
    }

    if (cache.size >= MAX_AUTHZ_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }
  }

  private async getSchedule(organizationId: string): Promise<RsiSyncSchedule | null> {
    const cached = this.getCachedValue(this.scheduleCache, organizationId);
    if (cached !== undefined) {
      return cached;
    }

    const schedule = await AppDataSource.getRepository(RsiSyncSchedule)
      .createQueryBuilder('schedule')
      .where('schedule.organizationId = :organizationId', { organizationId })
      .getOne();

    this.setCachedValue(this.scheduleCache, organizationId, schedule);
    return schedule;
  }

  private async isMappedRole(organizationId: string, roleId: string): Promise<boolean> {
    const cacheKey = `${organizationId}:${roleId}`;
    const cached = this.getCachedValue(this.roleAllowedCache, cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const isMappedRole = await AppDataSource.getRepository(RsiRoleMapping).exist({
      where: {
        organizationId,
        discordRoleId: roleId,
        isActive: true,
      },
    });

    this.setCachedValue(this.roleAllowedCache, cacheKey, isMappedRole);
    return isMappedRole;
  }

  async validateRoleMutation(payload: RoleMutationAuthorizationInput): Promise<string | null> {
    if (!AppDataSource.isInitialized) {
      return 'Role IPC authorization unavailable';
    }

    const schedule = await this.getSchedule(payload.organizationId);

    if (!schedule) {
      return 'Unknown organization for role synchronization';
    }

    if (schedule.guildId && schedule.guildId !== payload.guildId) {
      return 'Guild is not authorized for organization role synchronization';
    }

    const isMappedRole = await this.isMappedRole(payload.organizationId, payload.roleId);
    const isAffiliateRole = schedule.affiliateRoleId === payload.roleId;
    if (!isMappedRole && !isAffiliateRole) {
      return 'Role is not allowed for this organization';
    }

    const link = await AppDataSource.getRepository(RsiUserLink)
      .createQueryBuilder('link')
      .where('link.organizationId = :organizationId', { organizationId: payload.organizationId })
      .andWhere('link.discordUserId = :discordUserId', { discordUserId: payload.discordUserId })
      .getOne();

    if (!link?.verifiedAt || link.syncStatus === SyncStatus.REMOVED) {
      return 'Discord user is not linked to an active verified organization member';
    }

    const isMemberActive = await AppDataSource.getRepository(OrganizationMembership).exist({
      where: {
        organizationId: payload.organizationId,
        userId: link.userId,
        isActive: true,
      },
    });

    if (!isMemberActive) {
      return 'Discord user is not an active member of the organization';
    }

    return null;
  }

  clearCachesForTests(): void {
    this.scheduleCache.clear();
    this.roleAllowedCache.clear();
  }
}

export const rsiRoleMutationAuthorizationService = new RsiRoleMutationAuthorizationService();

