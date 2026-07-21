/**
 * MemberProfileService — Aggregator
 *
 * Assembles a MemberIntelProfile by fetching data from 6+ sources:
 *
 *   1. RsiUserLink + RsiMemberCache → RSI handle, orgs, ranks
 *   2. OrganizationMembership       → platform org memberships
 *   3. Discord (cached)             → guild presence, roles
 *   4. OrgWatchlistService          → citizen watchlist cross-ref hits
 *   5. MemberAuditEvent             → active flags (via MemberAuditService)
 *   6. ModerationIncidentService    → moderation history
 *
 * Wave 2.1 — Membership Audit & Intel (Phase D)
 */
import type {
  DiscordPresence,
  FlagStatus,
  MemberFlagSummary,
  MemberIntelProfile,
  MemberRoleAlignment,
  ModerationSummary,
  PlatformMembership,
  RsiOrgMembership,
  RsiPresence,
  UserFlagStats,
  WatchlistCrossReferenceResult,
} from '@sc-fleet-manager/shared-types';
import type { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { GuildOrganization } from '../../models/GuildOrganization';
import { MemberEngagement } from '../../models/MemberEngagement';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { RsiCitizenOrg } from '../../models/RsiCitizenOrg';
import { RsiMemberCache } from '../../models/RsiMemberCache';
import { RsiSyncSchedule } from '../../models/RsiSyncSchedule';
import { RsiUserLink, SyncStatus } from '../../models/RsiUserLink';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import { ModerationIncidentService } from '../discord/ModerationIncidentService';
import { rsiCrawlerService } from '../external/RsiCrawlerService';
import { RsiRoleMappingService } from '../external/RsiRoleMappingService';
import { VisibilityService } from '../shared/VisibilityService';

import { MemberAuditService } from './MemberAuditService';
import { OrgWatchlistService } from './OrgWatchlistService';

/* ──────────────────────────────────────────────────────────────────── */
/*  Service                                                            */
/* ──────────────────────────────────────────────────────────────────── */

// Simple in-memory cache for Discord presence (avoids hitting Discord API on every drawer open)
const discordPresenceCache = new Map<string, { data: DiscordPresence | null; expiresAt: number }>();
const DISCORD_PRESENCE_CACHE_TTL = 60_000; // 60 seconds

export class MemberProfileService {
  private readonly rsiLinkRepo: Repository<RsiUserLink>;
  private readonly rsiCacheRepo: Repository<RsiMemberCache>;
  private readonly citizenOrgRepo: Repository<RsiCitizenOrg>;
  private readonly membershipRepo: Repository<OrganizationMembership>;
  private readonly guildOrgRepo: Repository<GuildOrganization>;
  private readonly userRepo: Repository<User>;

  private readonly auditService: MemberAuditService;
  private readonly watchlistService: OrgWatchlistService;
  private readonly visibilityService: VisibilityService;
  private readonly roleMappingService: RsiRoleMappingService;

  constructor() {
    this.rsiLinkRepo = AppDataSource.getRepository(RsiUserLink);
    this.rsiCacheRepo = AppDataSource.getRepository(RsiMemberCache);
    this.citizenOrgRepo = AppDataSource.getRepository(RsiCitizenOrg);
    this.membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    this.guildOrgRepo = AppDataSource.getRepository(GuildOrganization);
    this.userRepo = AppDataSource.getRepository(User);

    this.auditService = new MemberAuditService();
    this.watchlistService = new OrgWatchlistService();
    this.visibilityService = new VisibilityService();
    this.roleMappingService = new RsiRoleMappingService();
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Public API                                                        */
  /* ═══════════════════════════════════════════════════════════════════ */

  /**
   * Build the full aggregated profile for a member in a specific org.
   *
   * Sources are fetched in parallel where possible.
   *
   * @param viewerId      The user requesting the profile (for visibility filtering)
   * @param isPlatformAdmin Whether the viewer is a platform admin
   */
  async getProfile(
    organizationId: string,
    targetUserId: string,
    viewerId?: string,
    isPlatformAdmin: boolean = false
  ): Promise<MemberIntelProfile> {
    /* ── 1. RSI link + other orgs (sequential — cross-ref depends on orgs) ── */
    let rsiLink: RsiUserLink | null = null;
    let otherRsiOrgs: RsiOrgMembership[] = [];
    let isFoundInOrgCrawl = false;
    try {
      rsiLink = await this.rsiLinkRepo.findOne({
        where: { userId: targetUserId, organizationId },
      });

      // Enrich link from crawled data if rank/discordUserId are missing
      if (rsiLink && (!rsiLink.lastKnownRank || !rsiLink.discordUserId)) {
        try {
          const { RsiCrawledMember } = await import('../../models/RsiCrawledMember');
          const scheduleRepo = AppDataSource.getRepository(RsiSyncSchedule);
          const schedule = await scheduleRepo.findOne({
            where: { organizationId },
            select: ['rsiOrgSid'],
          });
          if (schedule?.rsiOrgSid) {
            const crawledRepo = AppDataSource.getRepository(RsiCrawledMember);
            const crawled = await crawledRepo.findOne({
              where: { organizationSid: schedule.rsiOrgSid, handle: rsiLink.rsiHandle },
            });
            if (crawled) {
              isFoundInOrgCrawl = true;
              let updated = false;
              if (!rsiLink.lastKnownRank && crawled.rank) {
                rsiLink.lastKnownRank = crawled.rank;
                updated = true;
              }
              if (rsiLink.isAffiliate !== crawled.isAffiliate) {
                rsiLink.isAffiliate = crawled.isAffiliate;
                updated = true;
              }
              if (!rsiLink.lastSyncedAt) {
                rsiLink.lastSyncedAt = new Date();
                updated = true;
              }
              // Backfill discordUserId from User if missing on link
              if (!rsiLink.discordUserId) {
                const user = await this.userRepo.findOne({
                  where: { id: targetUserId },
                  select: ['id', 'discordId'],
                });
                if (user?.discordId) {
                  rsiLink.discordUserId = user.discordId;
                  updated = true;
                }
              }
              if (updated) {
                await this.rsiLinkRepo.save(rsiLink);
              }
            }
          }
        } catch {
          // Non-fatal — continue with whatever data we have
        }
      } else if (rsiLink?.lastKnownRank) {
        // If rank was already populated from a previous crawl, member was found before
        isFoundInOrgCrawl = true;
      }

      otherRsiOrgs = await this.fetchOtherRsiOrgs(rsiLink);
    } catch (err: unknown) {
      logger.error('MemberProfileService: RSI link/orgs fetch failed', {
        error: err instanceof Error ? err.message : String(err),
        organizationId,
        targetUserId,
      });
    }

    /* ── Default values for resilient assembly ───────────────── */
    const emptyFlags = {
      data: [] as MemberFlagSummary[],
      pagination: { total: 0, count: 0, page: 1, pageSize: 50, hasMore: false, totalPages: 0 },
    };
    const emptyFlagStats: UserFlagStats = {
      userId: targetUserId,
      organizationId,
      totalFlags: 0,
      openFlags: 0,
      resolvedFlags: 0,
      dismissedFlags: 0,
      escalatedFlags: 0,
      highestSeverity: null,
      lastFlagAt: null,
    };

    /* ── Parallel batch: independent sources (each individually safe) ── */
    const [memberships, flagsResult, flagStats, watchlistHits, moderation, discord, targetUser] =
      await Promise.all([
        this.safeFetch(
          'platformMemberships',
          () => this.fetchPlatformMemberships(targetUserId),
          [] as PlatformMembership[]
        ),
        this.safeFetch(
          'listFlags',
          () =>
            this.auditService.listFlags(organizationId, {
              userId: targetUserId,
              statuses: ['open' as FlagStatus],
              pageSize: 50,
            }),
          emptyFlags
        ),
        this.safeFetch(
          'getUserFlagStats',
          () => this.auditService.getUserFlagStats(organizationId, targetUserId),
          emptyFlagStats
        ),
        this.safeFetch(
          'watchlistCrossRef',
          () => this.crossReferenceWatchlist(organizationId, rsiLink, otherRsiOrgs),
          [] as WatchlistCrossReferenceResult[]
        ),
        this.fetchModerationSummary(organizationId, rsiLink),
        this.fetchDiscordPresence(organizationId, targetUserId),
        this.safeFetch(
          'targetUser',
          () =>
            this.userRepo.findOne({ where: { id: targetUserId }, select: ['id', 'activeOrgId'] }),
          null
        ),
      ]);

    /* ── D8: Apply visibility rules to RSI orgs ─────────────── */
    let viewerMembershipIds: string[] = [];
    if (viewerId) {
      try {
        viewerMembershipIds = (await this.fetchPlatformMemberships(viewerId)).map(
          m => m.organizationId
        );
      } catch (err: unknown) {
        logger.error('MemberProfileService: viewer memberships fetch failed', {
          error: err instanceof Error ? err.message : String(err),
          viewerId,
        });
      }
    }

    const filteredRsiOrgs = this.applyVisibilityRules(
      otherRsiOrgs,
      viewerId ?? targetUserId,
      viewerMembershipIds,
      isPlatformAdmin
    );

    /* ── Assemble ───────────────────────────────────────────── */
    // Build RSI presence — fall back to User model's rsiHandle if no RsiUserLink exists
    let rsi = this.buildRsiPresence(rsiLink, filteredRsiOrgs, isFoundInOrgCrawl);
    if (!rsi) {
      // Check if the User has an rsiHandle even without a formal RsiUserLink
      const userWithRsi = await this.userRepo.findOne({
        where: { id: targetUserId },
        select: ['id', 'rsiHandle'],
      });
      if (userWithRsi?.rsiHandle) {
        rsi = {
          rsiHandle: userWithRsi.rsiHandle,
          verificationStatus: 'pending',
          lastSyncedAt: null,
          rank: null,
          isAffiliate: false,
          isPrimaryOrg: false,
          isFoundInOrg: false,
          isHidden: false,
          otherRsiOrgs: filteredRsiOrgs,
        };
      }
    }

    /* ── Enrich platform memberships with isPrimary ────────── */
    const enrichedMemberships = memberships.map(m => ({
      ...m,
      isPrimary: targetUser?.activeOrgId === m.organizationId,
    }));

    /* ── Build role alignment ─────────────────────────────── */
    let roleAlignment: MemberRoleAlignment | null = null;
    try {
      roleAlignment = await this.buildRoleAlignment(
        organizationId,
        rsiLink,
        discord,
        enrichedMemberships
      );
    } catch (err: unknown) {
      logger.error('MemberProfileService: role alignment build failed', {
        error: err instanceof Error ? err.message : String(err),
        organizationId,
        targetUserId,
      });
    }

    // Resolve username for display
    const profileUser = await this.userRepo.findOne({
      where: { id: targetUserId },
      select: ['id', 'username', 'displayName'],
    });

    return {
      userId: targetUserId,
      organizationId,
      username: profileUser?.displayName ?? profileUser?.username ?? undefined,
      rsi,
      discord,
      platformMemberships: enrichedMemberships,
      watchlistHits,
      activeFlags: flagsResult.data,
      flagStats,
      moderation,
      roleAlignment,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Safely fetch a data source, returning a default value on error.
   * Logs the error for debugging without crashing the entire profile.
   */
  private async safeFetch<T>(source: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      logger.error(`MemberProfileService: ${source} fetch failed`, {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return fallback;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Source fetchers                                                   */
  /* ═══════════════════════════════════════════════════════════════════ */

  /**
   * Source 1b: Fetch all RSI orgs this member appears in.
   * First checks the RSI member cache (populated by sync jobs).
   * Falls back to live RSI crawler if cache is empty.
   */
  private async fetchOtherRsiOrgs(link: RsiUserLink | null): Promise<RsiOrgMembership[]> {
    if (!link?.rsiHandle) {
      return [];
    }

    // Try cache first
    const cached = await this.rsiCacheRepo.find({
      where: { rsiHandle: link.rsiHandle },
    });

    if (cached.length > 0) {
      return cached.map(c => ({
        rsiOrgSid: c.rsiOrgSid,
        rsiOrgName: c.displayName ?? undefined,
        rank: c.rsiRank,
        isAffiliate: c.isAffiliate,
        isPrimary: !c.isAffiliate, // Main members are primary, affiliates are not
        isHidden: false, // Cached members were visible when crawled
      }));
    }

    // Fallback 1: check RsiCitizenOrg (populated by enrichment)
    try {
      const citizenOrgs = await this.citizenOrgRepo.find({
        where: { citizenHandle: link.rsiHandle },
      });
      if (citizenOrgs.length > 0) {
        return citizenOrgs.map(co => ({
          rsiOrgSid: co.organizationSid,
          rsiOrgName: co.organizationName,
          rank: co.rank ?? 'Member',
          isAffiliate: co.isAffiliate,
          isPrimary: co.isMain,
          isHidden: false,
        }));
      }
    } catch {
      // Non-fatal — continue to crawler fallback
    }

    // Fallback 2: use RSI crawler for live data
    try {
      const memberships = await rsiCrawlerService.crawlUserMemberships(link.rsiHandle);
      return memberships.map(m => ({
        rsiOrgSid: m.sid,
        rsiOrgName: m.name,
        rank: m.rank ?? 'Member',
        isAffiliate: !m.isMain,
        isPrimary: m.isMain ?? false,
        isHidden: false, // crawlUserMemberships doesn't return isHidden per-org
      }));
    } catch {
      // Crawler unavailable (rate limited, circuit open, etc.) — return empty
      return [];
    }
  }

  /**
   * Source 2: Platform org memberships.
   */
  private async fetchPlatformMemberships(userId: string): Promise<PlatformMembership[]> {
    const memberships = await this.membershipRepo.find({
      where: { userId },
      relations: ['organization'],
    });

    return memberships.map(m => ({
      organizationId: m.organizationId,
      organizationName: (m as unknown as { organization?: { name?: string } }).organization?.name,
      role: getRoleName(m.role),
      title: m.title ?? null,
      isActive: m.isActive,
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    }));
  }

  /**
   * Source 4: Watchlist cross-reference.
   * Checks if the member's RSI handle is on the watching org's citizen watchlist.
   */
  private async crossReferenceWatchlist(
    organizationId: string,
    link: RsiUserLink | null,
    _otherOrgs: RsiOrgMembership[]
  ): Promise<WatchlistCrossReferenceResult[]> {
    if (!link?.rsiHandle) {
      return [];
    }

    return this.watchlistService.crossReference(organizationId, [link.rsiHandle]);
  }

  /**
   * Source 6: Moderation incident summary.
   * Uses ModerationIncidentService.lookupUser() which requires a Discord ID.
   */
  private async fetchModerationSummary(
    organizationId: string,
    link: RsiUserLink | null
  ): Promise<ModerationSummary | null> {
    const discordId = link?.discordUserId;
    if (!discordId) {
      return null;
    }

    try {
      const service = ModerationIncidentService.getInstance();
      const summary = await service.lookupUser(organizationId, discordId);

      return {
        totalIncidents: summary.totalIncidents,
        activeIncidents: summary.activeIncidents,
        highestSeverity: summary.totalIncidents > 0 ? String(summary.highestSeverity) : null,
        sharedIncidents: summary.sharedIncidents,
        lastIncidentAt: summary.lastIncident ? summary.lastIncident.toISOString() : null,
      };
    } catch {
      // ModerationIncidentService may not be initialised in all contexts
      return null;
    }
  }

  /**
   * Source 3: Discord guild presence.
   * Fetches the user's Discord ID and checks guild membership
   * via the GuildOrganization mapping. Uses the bot client to
   * resolve display name, roles, and join date when available.
   */
  private async fetchDiscordPresence(
    organizationId: string,
    userId: string
  ): Promise<DiscordPresence | null> {
    // Check cache first
    const cacheKey = `${organizationId}:${userId}`;
    const cached = discordPresenceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      // Get user's Discord ID and username (fallback for display name)
      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'discordId', 'username'],
      });

      if (!user?.discordId) {
        return null;
      }

      // Get the primary guild for this organization
      let guildId: string | null = null;
      const guildMapping = await this.guildOrgRepo.findOne({
        where: { organizationId, isActive: true, isPrimary: true },
      });
      guildId = guildMapping?.guildId ?? null;

      // Fallback: try the RSI sync schedule's guildId
      if (!guildId) {
        const schedule = await AppDataSource.getRepository(RsiSyncSchedule).findOne({
          where: { organizationId },
          select: ['guildId'],
        });
        guildId = schedule?.guildId ?? null;
      }

      if (!guildId) {
        // No guild mapped — return minimal Discord info
        const minimal: DiscordPresence = {
          discordId: user.discordId,
          displayName: user.username ?? null,
          roleIds: [],
          roleNames: [],
          status: null,
          joinedAt: null,
        };
        discordPresenceCache.set(cacheKey, {
          data: minimal,
          expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
        });
        return minimal;
      }

      // Try to fetch live member data from Discord via the bot client
      try {
        const { BotClientManager } = await import('../../bot/BotClientManager');
        const botManager = BotClientManager.getInstance();

        if (botManager.isReady()) {
          const client = botManager.getClient();
          const guild = client.guilds.cache.get(guildId);

          if (guild) {
            const member = await guild.members.fetch(user.discordId).catch(() => null);

            if (member) {
              const presence: DiscordPresence = {
                discordId: user.discordId,
                displayName: member.displayName ?? member.user.username,
                guildId: guild.id,
                guildName: guild.name,
                roleIds: member.roles.cache
                  .filter(r => r.id !== guild.id) // exclude @everyone
                  .map(r => r.id),
                roleNames: member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name),
                status:
                  member.presence?.status === 'invisible'
                    ? 'offline'
                    : (member.presence?.status ?? null),
                joinedAt: member.joinedAt?.toISOString() ?? null,
                isInGuild: true,
              };
              discordPresenceCache.set(cacheKey, {
                data: presence,
                expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
              });
              return presence;
            }
          }
        }
      } catch {
        // Bot not available in-process — fall through to IPC
      }

      // IPC fallback: query the bot running in a separate container via Redis Pub/Sub
      const ipcResult = await this.fetchDiscordPresenceViaIPC(
        user.discordId,
        user.username ?? null,
        guildId,
        guildMapping?.guildName ?? null
      );
      if (ipcResult) {
        discordPresenceCache.set(cacheKey, {
          data: ipcResult,
          expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
        });
        return ipcResult;
      }

      // Fallback: return Discord info from stored data when bot is unavailable
      // Infer guild membership from engagement data if available
      let inferredInGuild: boolean | undefined;
      if (guildId) {
        const hasEngagement = await AppDataSource.getRepository(MemberEngagement)
          .createQueryBuilder('me')
          .where('me.guildId = :guildId AND me.userId = :userId', {
            guildId,
            userId: user.discordId,
          })
          .limit(1)
          .getExists();
        if (hasEngagement) {
          inferredInGuild = true;
        }
      }

      const fallback: DiscordPresence = {
        discordId: user.discordId,
        displayName: user.username ?? null,
        guildId: guildId ?? undefined,
        guildName: guildMapping?.guildName ?? undefined,
        roleIds: [],
        roleNames: [],
        status: null,
        joinedAt: null,
        isInGuild: inferredInGuild,
      };
      discordPresenceCache.set(cacheKey, {
        data: fallback,
        expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
      });
      return fallback;
    } catch {
      discordPresenceCache.set(cacheKey, {
        data: null,
        expiresAt: Date.now() + DISCORD_PRESENCE_CACHE_TTL,
      });
      return null;
    }
  }

  /**
   * Fetch Discord guild presence via IPC (Redis Pub/Sub).
   * Used when the bot runs in a separate container and BotClientManager is not ready.
   */
  private async fetchDiscordPresenceViaIPC(
    discordId: string,
    username: string | null,
    guildId: string,
    guildName: string | null
  ): Promise<DiscordPresence | null> {
    try {
      const { BotIPCService } = await import('../../bot/BotIPCService');
      const ipcService = BotIPCService.getInstance();

      if (!ipcService.isAvailable()) {
        return null;
      }

      const ipcResponse = await ipcService.request(
        'guild:fetchMember',
        {
          guildId,
          discordUserId: discordId,
        },
        {
          timeoutMs: 3_500,
          requireDefinitiveResponse: true,
          definitiveWaitMs: 500,
          routing: {
            scope: 'guild',
            guildId,
          },
        }
      );

      if (!ipcResponse?.success || !ipcResponse.data) {
        return null;
      }

      const d = ipcResponse.data;
      const isDefinitive = ipcResponse.definitive ?? ipcResponse.status !== 'not_handled';

      if (d.found) {
        return {
          discordId,
          displayName: (d.displayName as string) ?? username ?? null,
          guildId: (d.guildId as string) ?? guildId ?? undefined,
          guildName: (d.guildName as string) ?? guildName ?? undefined,
          roleIds: (d.roleIds as string[]) ?? [],
          roleNames: (d.roleNames as string[]) ?? [],
          status: (d.status as DiscordPresence['status']) ?? null,
          joinedAt: (d.joinedAt as string) ?? null,
          isInGuild: true,
        };
      }

      // Only map to "not in guild" when the response is definitive.
      return {
        discordId,
        displayName: username ?? null,
        guildId: guildId ?? undefined,
        guildName: (d.guildName as string) ?? guildName ?? undefined,
        roleIds: [],
        roleNames: [],
        status: null,
        joinedAt: null,
        isInGuild: isDefinitive ? false : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * D8: Apply VisibilityService rules to RSI org memberships.
   * Redacts orgs the viewer isn't allowed to see.
   */
  private applyVisibilityRules(
    orgs: RsiOrgMembership[],
    viewerId: string,
    viewerMembershipIds: string[],
    isPlatformAdmin: boolean
  ): RsiOrgMembership[] {
    // Convert RSI orgs to a shape VisibilityService expects
    const entitiesWithVisibility = orgs.map(org => ({
      id: org.rsiOrgSid,
      isPublic: true, // Default to public; RSI orgs are considered public unless on watchlist
      ...org,
    }));

    const filtered = this.visibilityService.redactForViewer(
      entitiesWithVisibility,
      viewerId,
      viewerMembershipIds,
      isPlatformAdmin,
      'organization'
    );

    return filtered.map(item => {
      if ('isRedacted' in item && item.isRedacted) {
        return {
          rsiOrgSid: item.id,
          rsiOrgName: 'Redacted Organization',
          rank: '—',
          isAffiliate: false,
          isPrimary: false,
          isHidden: true,
        };
      }
      // Safe cast: non-redacted items retain original shape
      const org = item as RsiOrgMembership & { id: string };
      return {
        rsiOrgSid: org.rsiOrgSid,
        rsiOrgName: org.rsiOrgName,
        rank: org.rank,
        isAffiliate: org.isAffiliate,
        isPrimary: org.isPrimary,
        isHidden: org.isHidden,
      };
    });
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Private helpers                                                   */
  /* ═══════════════════════════════════════════════════════════════════ */

  private buildRsiPresence(
    link: RsiUserLink | null,
    otherOrgs: RsiOrgMembership[],
    isFoundInOrg: boolean
  ): RsiPresence | null {
    if (!link) {
      return null;
    }

    // Determine if this org is the user's primary RSI affiliation
    // Only trust isPrimaryOrg when the member was actually found in the org crawl
    const isPrimaryOrg = isFoundInOrg ? !link.isAffiliate : false;

    // If verifiedAt is set the user was verified — use that as the source of truth
    // even if syncStatus fell out of sync (e.g. legacy data before the markVerified fix)
    const verificationStatus =
      link.verifiedAt && link.syncStatus !== SyncStatus.REMOVED
        ? 'verified'
        : this.mapSyncStatus(link.syncStatus);

    return {
      rsiHandle: link.rsiHandle,
      verificationStatus,
      lastSyncedAt: link.lastSyncedAt ? link.lastSyncedAt.toISOString() : null,
      rank: link.lastKnownRank ?? null,
      isAffiliate: link.isAffiliate,
      isPrimaryOrg,
      isFoundInOrg,
      isHidden: false, // The link exists, so not hidden in this org
      otherRsiOrgs: otherOrgs,
    };
  }

  private mapSyncStatus(syncStatus: string): 'pending' | 'verified' | 'failed' | 'removed' {
    switch (syncStatus.toLowerCase()) {
      case 'synced':
        return 'verified';
      case 'failed':
      case 'needs_review':
        return 'failed';
      case 'removed':
        return 'removed';
      default:
        return 'pending';
    }
  }

  /**
   * Build role alignment check.
   * Compares RSI rank mapping expectations against actual Discord + web roles.
   */
  private async buildRoleAlignment(
    organizationId: string,
    rsiLink: RsiUserLink | null,
    discord: DiscordPresence | null,
    memberships: PlatformMembership[]
  ): Promise<MemberRoleAlignment | null> {
    const rsiRank = rsiLink?.lastKnownRank ?? null;
    if (!rsiRank) {
      return null;
    }

    const mapping = await this.roleMappingService.getMappingByRank(organizationId, rsiRank);
    if (!mapping) {
      return null;
    }

    const actualDiscordRoles = discord?.roleNames ?? [];
    const actualDiscordRoleIds = discord?.roleIds ?? [];
    const currentMembership = memberships.find(m => m.organizationId === organizationId);
    const actualWebRole = currentMembership?.role ?? 'unknown';

    // Resolve expected Discord role name from role IDs
    let mappedDiscordRole: string | null = null;
    if (mapping.discordRoleId) {
      // Try to resolve role name from the user's actual Discord data
      const roleIndex = actualDiscordRoleIds.indexOf(mapping.discordRoleId);
      if (roleIndex >= 0 && roleIndex < actualDiscordRoles.length) {
        mappedDiscordRole = actualDiscordRoles[roleIndex];
      } else {
        // Fallback: show the role ID
        mappedDiscordRole = mapping.discordRoleId;
      }
    }

    // Resolve expected web role name
    let mappedWebRole: string | null = null;
    if (mapping.internalRoleId && mapping.internalRole) {
      mappedWebRole = mapping.internalRole.name;
    }

    // Check alignment — compare by ID, not name
    const mismatches: string[] = [];
    const hasExpectedDiscordRole = mapping.discordRoleId
      ? actualDiscordRoleIds.includes(mapping.discordRoleId)
      : true;

    if (mapping.discordRoleId && !hasExpectedDiscordRole) {
      const expectedLabel =
        mappedDiscordRole === mapping.discordRoleId
          ? mapping.discordRoleId
          : `"${mappedDiscordRole}"`;
      if (actualDiscordRoles.length > 0) {
        mismatches.push(
          `Discord role mismatch: expected ${expectedLabel} but user has [${actualDiscordRoles.join(', ')}]`
        );
      } else {
        mismatches.push(
          `Discord role mismatch: expected ${expectedLabel} but user has no Discord roles`
        );
      }
    }

    if (mappedWebRole && actualWebRole.toLowerCase() !== mappedWebRole.toLowerCase()) {
      mismatches.push(
        `Web role mismatch: expected "${mappedWebRole}" but user has "${actualWebRole}"`
      );
    }

    return {
      rsiRank,
      mappedDiscordRole,
      actualDiscordRoles,
      mappedWebRole,
      actualWebRole,
      isAligned: mismatches.length === 0,
      mismatches,
    };
  }
}

