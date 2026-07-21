/**
 * RsiMemberIntelService — Member Intelligence Orchestration (Wave 3.3)
 *
 * Provides composite member intelligence by aggregating data from:
 *  1. RsiCrawledMember (RSI org member data)
 *  2. RsiCitizenOrg (citizen's other org affiliations)
 *  3. RsiUserLink (web app link status)
 *  4. OrganizationMembership (internal role + active status)
 *  5. DiscordService (Discord guild roles)
 *  6. RsiRoleMapping (expected role for rank)
 *  7. MemberAuditEvent (active flags)
 *
 * Also provides:
 *  - Member enrichment (fetch citizen's other orgs)
 *  - Automatic flag generation
 *  - Role mapping validation
 */

import crypto from 'crypto';

import { DEFAULT_FLAG_SEVERITY, FlagStatus, MemberFlagType } from '@sc-fleet-manager/shared-types';
import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { GuildOrganization } from '../../models/GuildOrganization';
import { MemberAuditEvent } from '../../models/MemberAuditEvent';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { RsiCitizenOrg } from '../../models/RsiCitizenOrg';
import { RsiCrawledMember } from '../../models/RsiCrawledMember';
import { RsiMemberCache } from '../../models/RsiMemberCache';
import { RsiRoleMapping } from '../../models/RsiRoleMapping';
import { RsiSyncSchedule } from '../../models/RsiSyncSchedule';
import { RsiUserLink, SyncStatus, VerificationMethod } from '../../models/RsiUserLink';
import { User } from '../../models/User';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import {
  DiscordService,
  getDiscordService,
  isDiscordServiceInitialized,
} from '../discord/DiscordService';
import { MemberAuditService } from '../intel/MemberAuditService';

import { RsiCrawlerService } from './RsiCrawlerService';
// Return/DTO types live in a sibling module (E5 decomposition); imported back for
// internal use and re-exported so `./RsiMemberIntelService` and the `services/rsi`
// barrel importers are unchanged.
import type {
  AuditRunResult,
  BatchEnrichmentResult,
  ClearCacheResult,
  EnrichmentResult,
  LinkCandidate,
  ManualLinkInput,
  ManualLinkResult,
  MemberIntelCard,
  MemberIntelSummary,
  RoleMappingMismatch,
  RoleMappingValidationResult,
} from './RsiMemberIntelService.types';

export type {
  AuditRunResult,
  BatchEnrichmentResult,
  ClearCacheResult,
  EnrichmentResult,
  LinkCandidate,
  ManualLinkInput,
  ManualLinkResult,
  MemberIntelCard,
  MemberIntelSummary,
  RoleMappingMismatch,
  RoleMappingValidationResult,
} from './RsiMemberIntelService.types';

// ─── Helpers ───────────────────────────────────────────────────────────

/** Generate a deterministic UUID from an RSI handle for unlinked members. */
function generateHandleUuid(handle: string): string {
  const hash = crypto.createHash('sha256').update(`unlinked:${handle.toLowerCase()}`).digest('hex');
  // Format as UUID v4 shape: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`, // version nibble
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // variant
    hash.slice(20, 32),
  ].join('-');
}

// ─── Service ───────────────────────────────────────────────────────────

export class RsiMemberIntelService {
  private crawledMemberRepo: Repository<RsiCrawledMember>;
  private citizenOrgRepo: Repository<RsiCitizenOrg>;
  private userLinkRepo: Repository<RsiUserLink>;
  private membershipRepo: Repository<OrganizationMembership>;
  private roleMappingRepo: Repository<RsiRoleMapping>;
  private flagRepo: Repository<MemberAuditEvent>;
  private scheduleRepo: Repository<RsiSyncSchedule>;
  private userRepo: Repository<User>;
  private memberCacheRepo: Repository<RsiMemberCache>;

  constructor() {
    this.crawledMemberRepo = AppDataSource.getRepository(RsiCrawledMember);
    this.citizenOrgRepo = AppDataSource.getRepository(RsiCitizenOrg);
    this.userLinkRepo = AppDataSource.getRepository(RsiUserLink);
    this.membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    this.roleMappingRepo = AppDataSource.getRepository(RsiRoleMapping);
    this.flagRepo = AppDataSource.getRepository(MemberAuditEvent);
    this.scheduleRepo = AppDataSource.getRepository(RsiSyncSchedule);
    this.userRepo = AppDataSource.getRepository(User);
    this.memberCacheRepo = AppDataSource.getRepository(RsiMemberCache);
  }

  // ==================== MEMBER LIST ====================

  /**
   * Status indicating why the member list may be empty.
   */
  public static readonly LIST_STATUS = {
    OK: 'ok',
    NO_SCHEDULE: 'no_schedule',
    NO_MEMBERS: 'no_members',
  } as const;

  /**
   * List all RSI members for an organization with intel summary.
   * Combines crawled member data with link/flag/Discord status.
   * Returns a status field to distinguish "no schedule" from "no data".
   */
  async getMemberList(
    organizationId: string,
    rsiOrgSid?: string
  ): Promise<{
    members: MemberIntelSummary[];
    status: string;
  }> {
    // Resolve rsiOrgSid from schedule if not provided
    const orgSid = rsiOrgSid ?? (await this.resolveOrgSid(organizationId));
    if (!orgSid) {
      return { members: [], status: RsiMemberIntelService.LIST_STATUS.NO_SCHEDULE };
    }

    const [crawledMembers, links, activeFlagCounts] = await Promise.all([
      this.crawledMemberRepo.find({
        where: { organizationSid: orgSid },
        order: { rank: 'ASC', handle: 'ASC' },
      }),
      this.userLinkRepo.find({
        where: { organizationId },
      }),
      this.getActiveFlagCountsByUser(organizationId),
    ]);

    // Auto-link: find platform users with matching RSI handles or usernames who are org members but have no link
    const linkedHandles = new Set(links.map(l => l.rsiHandle.toLowerCase()));
    const unlinkedHandles = crawledMembers
      .filter(m => !linkedHandles.has(m.handle.toLowerCase()))
      .map(m => m.handle);

    if (unlinkedHandles.length > 0) {
      // Match by rsiHandle first, then fall back to username (case-insensitive)
      const loweredHandles = unlinkedHandles.map(h => h.toLowerCase());
      const matchableUsers: Array<{
        u_id: string;
        u_rsiHandle: string | null;
        u_discordId: string | null;
        u_username: string | null;
      }> = await this.userRepo
        .createQueryBuilder('u')
        .innerJoin(
          'organization_memberships',
          'om',
          'om."userId" = u.id AND om."organizationId" = :orgId AND om."isActive" = true',
          { orgId: organizationId }
        )
        .where('LOWER(u."rsiHandle") IN (:...lowered) OR LOWER(u.username) IN (:...lowered)', {
          lowered: loweredHandles,
        })
        .select(['u.id', 'u."rsiHandle"', 'u."discordId"', 'u.username'])
        .getRawMany();

      // Deduplicate: one link per RSI handle, prefer rsiHandle match over username match
      const alreadyLinkedUserIds = new Set<string>();
      for (const user of matchableUsers) {
        const userId = user.u_id;
        if (alreadyLinkedUserIds.has(userId)) {
          continue;
        }

        // Determine match type: rsiHandle (high confidence) vs username (needs review)
        const rsiHandleField = user.u_rsiHandle;
        const usernameField = user.u_username;
        let matchedHandle: string | undefined;
        let isHighConfidence = false;

        if (rsiHandleField && loweredHandles.includes(rsiHandleField.toLowerCase())) {
          matchedHandle = rsiHandleField;
          isHighConfidence = true; // Explicit rsiHandle match
        } else if (usernameField) {
          matchedHandle = unlinkedHandles.find(
            h => h.toLowerCase() === usernameField.toLowerCase()
          );
          isHighConfidence = false; // Username fallback — uncertain
        }

        if (!matchedHandle) {
          continue;
        }
        if (linkedHandles.has(matchedHandle.toLowerCase())) {
          continue;
        }

        // Look up the crawled member to get rank/affiliate data
        const crawled = crawledMembers.find(
          m => m.handle.toLowerCase() === matchedHandle.toLowerCase()
        );

        const newLink = this.userLinkRepo.create({
          organizationId,
          rsiHandle: matchedHandle,
          userId,
          discordUserId: user.u_discordId ?? undefined,
          syncStatus: isHighConfidence ? SyncStatus.SYNCED : SyncStatus.NEEDS_REVIEW,
          verificationMethod: isHighConfidence
            ? VerificationMethod.DISCORD_MATCH
            : VerificationMethod.MANUAL,
          verifiedAt: isHighConfidence ? new Date() : undefined,
          lastSyncedAt: new Date(),
          lastKnownRank: crawled?.rank ?? undefined,
          isAffiliate: crawled?.isAffiliate ?? false,
        });
        if (!isHighConfidence) {
          newLink.markNeedsReview(`Username match: "${usernameField}" ~ "${matchedHandle}"`);
        }
        await this.userLinkRepo.save(newLink);
        links.push(newLink);
        linkedHandles.add(matchedHandle.toLowerCase());
        alreadyLinkedUserIds.add(userId);
        if (isHighConfidence) {
          logger.info(
            `Auto-linked RSI member ${matchedHandle} to platform user ${userId} (rsiHandle match)`,
            { organizationId }
          );
        } else {
          logger.info(
            `Tentative link: RSI member ${matchedHandle} ↔ platform user ${userId} (username match, pending review)`,
            { organizationId }
          );
        }
      }
    }

    // Discord guild name matching: for still-unlinked handles, check Discord guild member names
    const stillUnlinked = crawledMembers
      .filter(m => !linkedHandles.has(m.handle.toLowerCase()))
      .map(m => m.handle);

    const guildId = await this.resolveGuildId(organizationId);

    if (stillUnlinked.length > 0 && guildId) {
      await this.tryDiscordGuildNameMatch(
        organizationId,
        guildId,
        stillUnlinked,
        linkedHandles,
        crawledMembers,
        links
      );
      // Clear the in-memory guild member name map after batch matching
      this.guildMemberNameMapCache.delete(guildId);
    }

    const linkByHandle = new Map(links.map(l => [l.rsiHandle.toLowerCase(), l]));

    // Backfill discordUserId on links where it's missing but the platform user has one
    const linksWithoutDiscord = links.filter(l => !l.discordUserId && l.userId);
    if (linksWithoutDiscord.length > 0) {
      const userIds = linksWithoutDiscord.map(l => l.userId);
      const usersWithDiscord = await this.userRepo.find({
        where: { id: In(userIds) },
        select: ['id', 'discordId'],
      });
      const userDiscordMap = new Map(
        usersWithDiscord.filter(u => u.discordId).map(u => [u.id, u.discordId])
      );

      for (const link of linksWithoutDiscord) {
        const discordId = userDiscordMap.get(link.userId);
        if (discordId) {
          link.discordUserId = discordId;
          await this.userLinkRepo.save(link);
          logger.info(
            `Backfilled discordUserId on link for ${link.rsiHandle} (user ${link.userId})`,
            { organizationId }
          );
        }
      }
    }

    // Check Discord status in bulk if possible
    const discordUserIds = links
      .map(l => l.discordUserId)
      .filter((id): id is string => Boolean(id));

    const discordStatusMap = new Map<string, boolean>();
    if (guildId && isDiscordServiceInitialized() && discordUserIds.length > 0) {
      const discordService = getDiscordService();
      // Check each linked user's Discord presence (cached via DiscordService)
      for (const link of links) {
        if (link.discordUserId) {
          try {
            const roles = await discordService.getUserRoles(guildId, link.discordUserId);
            discordStatusMap.set(link.rsiHandle.toLowerCase(), roles.length > 0);
          } catch {
            discordStatusMap.set(link.rsiHandle.toLowerCase(), false);
          }
        }
      }
    }

    const members = crawledMembers.map(m => {
      const handleLower = m.handle.toLowerCase();
      const link = linkByHandle.get(handleLower);
      const flagCount = link ? (activeFlagCounts.get(link.userId) ?? 0) : 0;

      return {
        rsiHandle: m.handle,
        displayName: m.displayName,
        rsiRank: m.rank,
        rsiStars: m.stars,
        isMainOrg: m.isMain,
        isAffiliate: m.isAffiliate,
        isHidden: m.isHidden,
        isRedacted: m.isRedacted ?? false,
        isLinked: !!link,
        isInDiscord: discordStatusMap.get(handleLower) ?? false,
        activeFlagCount: flagCount,
        hasMismatch: false, // Populated only in full card view
      };
    });

    return {
      members,
      status:
        members.length > 0
          ? RsiMemberIntelService.LIST_STATUS.OK
          : RsiMemberIntelService.LIST_STATUS.NO_MEMBERS,
    };
  }

  // ==================== MEMBER CARD ====================

  /**
   * Get full member intel card for a specific RSI handle.
   */
  async getMemberCard(organizationId: string, rsiHandle: string): Promise<MemberIntelCard | null> {
    const orgSid = await this.resolveOrgSid(organizationId);
    if (!orgSid) {
      return null;
    }

    // Parallel data fetches
    const [crawledMember, citizenOrgs, existingLink, roleMappings] = await Promise.all([
      this.crawledMemberRepo.findOne({
        where: { organizationSid: orgSid, handle: rsiHandle },
      }),
      this.citizenOrgRepo.find({
        where: { citizenHandle: rsiHandle },
        order: { isMain: 'DESC', organizationName: 'ASC' },
      }),
      this.userLinkRepo.findOne({
        where: { organizationId, rsiHandle },
      }),
      this.roleMappingRepo.find({
        where: { organizationId, isActive: true },
      }),
    ]);

    if (!crawledMember) {
      return null;
    }

    // Auto-link: if no RsiUserLink exists, try to match a platform user by rsiHandle or username
    let link = existingLink;
    if (!link) {
      // Try matching by rsiHandle first (case-insensitive) — high confidence
      let matchedUser = await this.userRepo
        .createQueryBuilder('u')
        .where('LOWER(u.rsiHandle) = LOWER(:handle)', { handle: rsiHandle })
        .select(['u.id', 'u.discordId', 'u.rsiHandle', 'u.username'])
        .getOne();
      let isHighConfidence = !!matchedUser;

      // Fallback: try username match — low confidence, needs review
      if (!matchedUser) {
        matchedUser = await this.userRepo
          .createQueryBuilder('u')
          .where('LOWER(u.username) = LOWER(:handle)', { handle: rsiHandle })
          .select(['u.id', 'u.discordId', 'u.rsiHandle', 'u.username'])
          .getOne();
        isHighConfidence = false;
      }

      // Fallback: try Discord guild member name match
      let discordMatchSource: string | undefined;
      if (!matchedUser) {
        const cardGuildId = await this.resolveGuildId(organizationId);
        if (cardGuildId) {
          const nameMap = await this.fetchGuildMemberNameMap(cardGuildId);
          const discordMatch = nameMap.get(rsiHandle.toLowerCase());
          if (discordMatch) {
            matchedUser = await this.userRepo
              .createQueryBuilder('u')
              .where('u."discordId" = :discordId', { discordId: discordMatch.discordUserId })
              .select(['u.id', 'u.discordId', 'u.rsiHandle', 'u.username'])
              .getOne();
            isHighConfidence = false;
            discordMatchSource = discordMatch.matchedVia;
          }
        }
      }

      if (matchedUser) {
        // Check if this user is an active member of the org
        const isMember = await this.membershipRepo.findOne({
          where: { userId: matchedUser.id, organizationId, isActive: true },
          select: ['id'],
        });
        if (isMember) {
          // Verify no existing link for this user in this org
          const existingForUser = await this.userLinkRepo.findOne({
            where: { userId: matchedUser.id, organizationId },
          });
          if (!existingForUser) {
            link = this.userLinkRepo.create({
              organizationId,
              rsiHandle,
              userId: matchedUser.id,
              discordUserId: matchedUser.discordId ?? undefined,
              syncStatus: isHighConfidence ? SyncStatus.SYNCED : SyncStatus.NEEDS_REVIEW,
              verificationMethod: isHighConfidence
                ? VerificationMethod.DISCORD_MATCH
                : VerificationMethod.MANUAL,
              verifiedAt: isHighConfidence ? new Date() : undefined,
              lastSyncedAt: new Date(),
              lastKnownRank: crawledMember.rank ?? undefined,
              isAffiliate: crawledMember.isAffiliate,
            });
            if (!isHighConfidence) {
              const reviewReason = discordMatchSource
                ? `Discord guild ${discordMatchSource} match: "${rsiHandle}" ↔ Discord user ${matchedUser.username ?? matchedUser.id}`
                : `Username match: "${matchedUser.username}" ≈ "${rsiHandle}"`;
              link.markNeedsReview(reviewReason);
            }
            await this.userLinkRepo.save(link);
            if (isHighConfidence) {
              logger.info(
                `Auto-linked RSI member ${rsiHandle} to platform user ${matchedUser.id} (rsiHandle match)`,
                { organizationId }
              );
            } else {
              const matchType = discordMatchSource ? `Discord ${discordMatchSource}` : 'username';
              logger.info(
                `Tentative link: RSI member ${rsiHandle} ↔ platform user ${matchedUser.id} (${matchType} match, pending review)`,
                { organizationId }
              );
            }
          }
        }
      }
    }

    // Get membership + flags if linked
    let membership: OrganizationMembership | null = null;
    let activeFlags: MemberAuditEvent[] = [];
    if (link) {
      [membership, activeFlags] = await Promise.all([
        this.membershipRepo.findOne({
          where: { userId: link.userId, organizationId, isActive: true },
          relations: ['role'],
        }),
        this.flagRepo.find({
          where: {
            organizationId,
            userId: link.userId,
            status: FlagStatus.OPEN,
          },
          order: { createdAt: 'DESC' },
        }),
      ]);
    }

    // Discord status — use link's discordUserId, or fall back to User model
    let discordUserId = link?.discordUserId;
    if (!discordUserId && link?.userId) {
      const user = await this.userRepo.findOne({
        where: { id: link.userId },
        select: ['id', 'discordId'],
      });
      if (
        user?.discordId &&
        !user.discordId.startsWith('google:') &&
        !user.discordId.startsWith('twitch:')
      ) {
        discordUserId = user.discordId;
      }
    }
    const discordStatus = await this.getDiscordStatus(
      organizationId,
      discordUserId,
      crawledMember.rank,
      roleMappings
    );

    // Role mapping validation
    const roleMappingStatus = this.validateMemberRoleMapping(
      crawledMember.rank,
      roleMappings,
      discordStatus,
      membership
    );

    return {
      rsiHandle: crawledMember.handle,
      displayName: crawledMember.displayName,
      rsiRank: crawledMember.rank,
      rsiStars: crawledMember.stars,
      rsiRoles: crawledMember.roles ?? [],
      isMainOrg: crawledMember.isMain,
      isAffiliate: crawledMember.isAffiliate,
      isHidden: crawledMember.isHidden,
      isRedacted: crawledMember.isRedacted ?? false,
      avatar: crawledMember.avatar,
      enlisted: crawledMember.enlisted,
      lastCrawledAt: crawledMember.lastCrawledAt,
      otherOrgs: citizenOrgs
        .filter(co => co.organizationSid !== orgSid)
        .map(co => ({
          sid: co.organizationSid,
          name: co.organizationName,
          rank: co.rank,
          stars: co.stars ?? undefined,
          isMain: co.isMain,
        })),
      webAppStatus: {
        isLinked: !!link,
        syncStatus: link?.syncStatus,
        userId: link?.userId,
        membershipRole: membership?.role?.name,
        isActiveMember: membership?.isActive ?? false,
      },
      discordStatus,
      activeFlags: activeFlags.map(f => ({
        id: f.id,
        flagType: f.flagType,
        severity: f.severity,
        description: f.description,
        createdAt: f.createdAt,
      })),
      roleMappingStatus,
    };
  }

  // ==================== ENRICHMENT ====================

  /**
   * Enrich a single member by fetching their other RSI org affiliations.
   */
  async enrichMember(organizationId: string, rsiHandle: string): Promise<EnrichmentResult> {
    try {
      const crawler = new RsiCrawlerService();
      const memberships = await crawler.crawlUserMemberships(rsiHandle);

      // Upsert citizen org records
      for (const org of memberships) {
        await this.citizenOrgRepo.upsert(
          {
            citizenHandle: rsiHandle,
            organizationSid: org.sid,
            organizationName: org.name,
            rank: org.rank,
            stars: org.stars,
            isMain: org.isMain,
            isAffiliate: !org.isMain,
            lastFetchedAt: new Date(),
          },
          {
            conflictPaths: ['citizenHandle', 'organizationSid'],
          }
        );
      }

      logger.info(`Enriched member ${rsiHandle}: found ${memberships.length} org affiliations`, {
        organizationId,
        rsiHandle,
        orgsFound: memberships.length,
      });

      return { rsiHandle, orgsFound: memberships.length, success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to enrich member ${rsiHandle}: ${message}`, {
        organizationId,
        rsiHandle,
      });
      return { rsiHandle, orgsFound: 0, success: false, error: message };
    }
  }

  /**
   * Batch enrich all crawled members of an organization.
   * Respects rate limiting of the underlying crawler.
   */
  async enrichOrganizationMembers(organizationId: string): Promise<BatchEnrichmentResult> {
    const orgSid = await this.resolveOrgSid(organizationId);
    if (!orgSid) {
      return { total: 0, enriched: 0, failed: 0, results: [] };
    }

    const members = await this.crawledMemberRepo.find({
      where: { organizationSid: orgSid, isHidden: false },
      select: ['handle'],
    });

    const results: EnrichmentResult[] = [];
    let enriched = 0;
    let failed = 0;

    for (const member of members) {
      const result = await this.enrichMember(organizationId, member.handle);
      results.push(result);
      if (result.success) {
        enriched++;
      } else {
        failed++;
      }
    }

    logger.info(`Batch enrichment complete for org ${organizationId}`, {
      total: members.length,
      enriched,
      failed,
    });

    return { total: members.length, enriched, failed, results };
  }

  // ==================== MEMBER AUDIT ====================

  /**
   * Run automated member audit checks across all org members.
   * Creates flags for detected issues (deduplicates against existing open flags).
   */
  async runMemberAudit(organizationId: string, guildId?: string): Promise<AuditRunResult> {
    const orgSid = await this.resolveOrgSid(organizationId);
    const resolvedGuildId = guildId ?? (await this.resolveGuildId(organizationId));
    const auditService = new MemberAuditService();

    const result: AuditRunResult = {
      organizationId,
      totalChecked: 0,
      flagsCreated: 0,
      flagsSkipped: 0,
      errors: [],
      flagsByType: {},
    };

    if (!orgSid) {
      result.errors.push('No RSI org SID configured for this organization');
      return result;
    }

    // Fetch all data needed for audit
    const [crawledMembers, links, memberships, roleMappings, existingFlags] = await Promise.all([
      this.crawledMemberRepo.find({ where: { organizationSid: orgSid } }),
      this.userLinkRepo.find({ where: { organizationId } }),
      this.membershipRepo.find({
        where: { organizationId, isActive: true },
        relations: ['role'],
      }),
      this.roleMappingRepo.find({ where: { organizationId, isActive: true } }),
      this.flagRepo.find({
        where: { organizationId, status: FlagStatus.OPEN },
      }),
    ]);

    const linkByHandle = new Map(links.map(l => [l.rsiHandle.toLowerCase(), l]));
    const memberByUserId = new Map(memberships.map(m => [m.userId, m]));
    const crawledByHandle = new Map(crawledMembers.map(m => [m.handle.toLowerCase(), m]));
    const mappingByRank = new Map(roleMappings.map(r => [r.rsiRank, r]));
    const existingFlagSet = new Set(existingFlags.map(f => `${f.userId}:${f.flagType}`));

    // Backfill discordUserId on links where it's missing but the platform user has one
    const auditLinksWithoutDiscord = links.filter(l => !l.discordUserId && l.userId);
    if (auditLinksWithoutDiscord.length > 0) {
      const userIds = auditLinksWithoutDiscord.map(l => l.userId);
      const usersWithDiscord = await this.userRepo.find({
        where: { id: In(userIds) },
        select: ['id', 'discordId'],
      });
      const userDiscordMap = new Map(
        usersWithDiscord.filter(u => u.discordId).map(u => [u.id, u.discordId])
      );

      for (const link of auditLinksWithoutDiscord) {
        const discordId = userDiscordMap.get(link.userId);
        if (discordId) {
          link.discordUserId = discordId;
          await this.userLinkRepo.save(link);
          logger.info(
            `Audit backfilled discordUserId on link for ${link.rsiHandle} (user ${link.userId})`,
            { organizationId }
          );
        }
      }
    }

    // Helper: create flag if not already open
    const maybeCreateFlag = async (
      userId: string,
      flagType: MemberFlagType,
      description: string,
      metadata?: Record<string, unknown>
    ): Promise<void> => {
      const key = `${userId}:${flagType}`;
      if (existingFlagSet.has(key)) {
        result.flagsSkipped++;
        return;
      }

      try {
        await auditService.createFlag({
          userId,
          organizationId,
          flagType,
          severity: DEFAULT_FLAG_SEVERITY[flagType],
          description,
          metadata,
          isAutoGenerated: true,
        });
        existingFlagSet.add(key);
        result.flagsCreated++;
        result.flagsByType[flagType] = (result.flagsByType[flagType] ?? 0) + 1;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Flag creation failed for ${userId}/${flagType}: ${msg}`);
      }
    };

    // Discord service (optional)
    let discordService: DiscordService | null = null;
    if (resolvedGuildId && isDiscordServiceInitialized()) {
      discordService = getDiscordService();
    }

    // ── Check 1: RSI crawled members → missing from web app, hidden, affiliate ──
    for (const member of crawledMembers) {
      result.totalChecked++;
      const handleLower = member.handle.toLowerCase();
      const link = linkByHandle.get(handleLower);

      // MISSING_FROM_WEB_APP: in RSI but not linked
      // Generate a deterministic UUID from the handle so each unlinked member
      // gets a unique flag. The RSI handle is stored in metadata for display.
      if (!link) {
        const syntheticId = generateHandleUuid(member.handle);
        await maybeCreateFlag(
          syntheticId,
          MemberFlagType.MISSING_FROM_WEB_APP,
          `RSI member "${member.handle}" (rank: ${member.rank ?? 'unknown'}) is not linked in the web app`,
          { rsiHandle: member.handle, rsiRank: member.rank }
        );
        continue; // Can't check Discord/role for unlinked members
      }

      // HIDDEN_RSI_MEMBER
      if (member.isHidden || member.isRedacted) {
        await maybeCreateFlag(
          link.userId,
          MemberFlagType.HIDDEN_RSI_MEMBER,
          `RSI member "${member.handle}" has a hidden/redacted profile`,
          { rsiHandle: member.handle, isHidden: member.isHidden, isRedacted: member.isRedacted }
        );
      }

      // AFFILIATE_NOT_PRIMARY
      if (member.isAffiliate && !member.isMain) {
        await maybeCreateFlag(
          link.userId,
          MemberFlagType.AFFILIATE_NOT_PRIMARY,
          `"${member.handle}" is an affiliate member, not a primary member of this organization`,
          { rsiHandle: member.handle }
        );
      }

      // MISSING_FROM_DISCORD
      if (discordService && resolvedGuildId && link.discordUserId) {
        try {
          const roles = await discordService.getUserRoles(resolvedGuildId, link.discordUserId);
          if (roles.length === 0) {
            await maybeCreateFlag(
              link.userId,
              MemberFlagType.MISSING_FROM_DISCORD,
              `"${member.handle}" is linked but not found in the Discord guild`,
              { rsiHandle: member.handle, discordUserId: link.discordUserId }
            );
          } else {
            // ROLE_MISMATCH_DISCORD
            const mapping = member.rank ? mappingByRank.get(member.rank) : undefined;
            if (mapping?.discordRoleId) {
              const hasExpectedRole = roles.some(r => r.id === mapping.discordRoleId);
              if (!hasExpectedRole) {
                await maybeCreateFlag(
                  link.userId,
                  MemberFlagType.ROLE_MISMATCH_DISCORD,
                  `"${member.handle}" has RSI rank "${member.rank}" but does not have the mapped Discord role`,
                  {
                    rsiHandle: member.handle,
                    rsiRank: member.rank,
                    expectedDiscordRoleId: mapping.discordRoleId,
                    actualRoles: roles.map(r => r.id),
                  }
                );
              }
            }
          }
        } catch {
          // Discord API error — skip this check silently
        }
      } else if (!link.discordUserId && link.userId) {
        // No Discord ID linked
        await maybeCreateFlag(
          link.userId,
          MemberFlagType.MISSING_FROM_DISCORD,
          `"${member.handle}" has no Discord account linked`,
          { rsiHandle: member.handle }
        );
      }

      // ROLE_MISMATCH_INTERNAL
      const membership = memberByUserId.get(link.userId);
      if (membership && member.rank) {
        const mapping = mappingByRank.get(member.rank);
        if (mapping?.internalRoleId && membership.roleId !== mapping.internalRoleId) {
          await maybeCreateFlag(
            link.userId,
            MemberFlagType.ROLE_MISMATCH_INTERNAL,
            `"${member.handle}" has RSI rank "${member.rank}" but internal role does not match the mapping`,
            {
              rsiHandle: member.handle,
              rsiRank: member.rank,
              expectedInternalRoleId: mapping.internalRoleId,
              actualRoleId: membership.roleId,
            }
          );
        }
      }
    }

    // ── Check 2: Linked members → missing from RSI ──
    for (const link of links) {
      if (String(link.syncStatus) === 'removed') {
        continue;
      }
      const handleLower = link.rsiHandle.toLowerCase();
      if (!crawledByHandle.has(handleLower)) {
        await maybeCreateFlag(
          link.userId,
          MemberFlagType.MISSING_FROM_RSI,
          `Linked member "${link.rsiHandle}" was not found in the RSI org member listing`,
          { rsiHandle: link.rsiHandle, lastKnownRank: link.lastKnownRank }
        );
      }
    }

    logger.info(`Member audit complete for org ${organizationId}`, {
      totalChecked: result.totalChecked,
      flagsCreated: result.flagsCreated,
      flagsSkipped: result.flagsSkipped,
      errorCount: result.errors.length,
    });

    return result;
  }

  // ==================== ROLE MAPPING VALIDATION ====================

  /**
   * Validate that role mappings are correctly applied across all members.
   */
  async validateRoleMappings(
    organizationId: string,
    guildId?: string
  ): Promise<RoleMappingValidationResult> {
    const orgSid = await this.resolveOrgSid(organizationId);
    const resolvedGuildId = guildId ?? (await this.resolveGuildId(organizationId));

    const result: RoleMappingValidationResult = {
      organizationId,
      totalMembers: 0,
      validatedMembers: 0,
      mismatches: [],
      unmappedRanks: [],
      summary: {
        correctDiscordRoles: 0,
        incorrectDiscordRoles: 0,
        correctInternalRoles: 0,
        incorrectInternalRoles: 0,
        noMappingDefined: 0,
        notInDiscord: 0,
      },
    };

    if (!orgSid) {
      return result;
    }

    const [crawledMembers, links, memberships, roleMappings] = await Promise.all([
      this.crawledMemberRepo.find({ where: { organizationSid: orgSid } }),
      this.userLinkRepo.find({ where: { organizationId } }),
      this.membershipRepo.find({
        where: { organizationId, isActive: true },
        relations: ['role'],
      }),
      this.roleMappingRepo.find({ where: { organizationId, isActive: true } }),
    ]);

    result.totalMembers = crawledMembers.length;

    const linkByHandle = new Map(links.map(l => [l.rsiHandle.toLowerCase(), l]));
    const memberByUserId = new Map(memberships.map(m => [m.userId, m]));
    const mappingByRank = new Map(roleMappings.map(r => [r.rsiRank, r]));

    let discordService: DiscordService | null = null;
    if (resolvedGuildId && isDiscordServiceInitialized()) {
      discordService = getDiscordService();
    }

    const unmappedRanks = new Set<string>();

    for (const member of crawledMembers) {
      if (!member.rank) {
        continue;
      }

      const mapping = mappingByRank.get(member.rank);
      if (!mapping) {
        unmappedRanks.add(member.rank);
        result.summary.noMappingDefined++;
        continue;
      }

      const link = linkByHandle.get(member.handle.toLowerCase());
      if (!link) {
        continue;
      } // Can't validate unlinked members

      result.validatedMembers++;

      const mismatch: RoleMappingMismatch = {
        rsiHandle: member.handle,
        userId: link.userId,
        rsiRank: member.rank,
        expectedMapping: {
          discordRoleId: mapping.discordRoleId,
          internalRoleId: mapping.internalRoleId,
        },
        actual: { discordRoles: [], internalRoleId: undefined },
        issues: [],
      };

      // Discord role check
      if (mapping.discordRoleId && discordService && resolvedGuildId && link.discordUserId) {
        try {
          const roles = await discordService.getUserRoles(resolvedGuildId, link.discordUserId);
          mismatch.actual.discordRoles = roles.map(r => r.id);
          const hasRole = roles.some(r => r.id === mapping.discordRoleId);
          if (hasRole) {
            result.summary.correctDiscordRoles++;
          } else {
            result.summary.incorrectDiscordRoles++;
            mismatch.issues.push(
              `Expected Discord role ${mapping.discordRoleId} but user has: [${roles.map(r => r.name).join(', ')}]`
            );
          }
        } catch {
          result.summary.notInDiscord++;
          mismatch.issues.push('Could not fetch Discord roles');
        }
      } else if (mapping.discordRoleId && !link.discordUserId) {
        result.summary.notInDiscord++;
        mismatch.issues.push('No Discord account linked');
      }

      // Internal role check
      const membership = memberByUserId.get(link.userId);
      if (mapping.internalRoleId && membership) {
        mismatch.actual.internalRoleId = membership.roleId;
        if (membership.roleId === mapping.internalRoleId) {
          result.summary.correctInternalRoles++;
        } else {
          result.summary.incorrectInternalRoles++;
          mismatch.issues.push(
            `Expected internal role ${mapping.internalRoleId} but user has ${membership.roleId}`
          );
        }
      }

      if (mismatch.issues.length > 0) {
        result.mismatches.push(mismatch);
      }
    }

    result.unmappedRanks = Array.from(unmappedRanks);
    return result;
  }

  // ==================== PRIVATE HELPERS ====================

  private async resolveOrgSid(organizationId: string): Promise<string | null> {
    const schedule = await this.scheduleRepo.findOne({
      where: { organizationId },
      select: ['rsiOrgSid'],
    });
    return schedule?.rsiOrgSid ?? null;
  }

  private async resolveGuildId(organizationId: string): Promise<string | null> {
    // Try RsiSyncSchedule first
    const schedule = await this.scheduleRepo.findOne({
      where: { organizationId },
      select: ['guildId'],
    });
    if (schedule?.guildId) {
      return schedule.guildId;
    }

    // Fallback: check GuildOrganization
    const guildOrg = await AppDataSource.getRepository(GuildOrganization).findOne({
      where: { organizationId, isActive: true, isPrimary: true },
      select: ['guildId'],
    });
    return guildOrg?.guildId ?? null;
  }

  /**
   * Fetch all Discord guild members and build a case-insensitive name → discordUserId map.
   * Matches against nickname, displayName, globalName, and username.
   * Results are cached in memory for the lifetime of this service call.
   */
  private guildMemberNameMapCache = new Map<
    string,
    Map<string, { discordUserId: string; matchedVia: string }>
  >();

  private async fetchGuildMemberNameMap(
    guildId: string
  ): Promise<Map<string, { discordUserId: string; matchedVia: string }>> {
    // Return cached result if available (avoids re-fetching within the same request cycle)
    const cached = this.guildMemberNameMapCache.get(guildId);
    if (cached) {
      return cached;
    }

    const nameMap = new Map<string, { discordUserId: string; matchedVia: string }>();

    try {
      const { BotClientManager } = await import('../../bot/BotClientManager');
      const botManager = BotClientManager.getInstance();
      if (!botManager.isReady()) {
        return nameMap;
      }

      const client = botManager.getClient();
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return nameMap;
      }

      const guildMembers = await guild.members.fetch();

      for (const [, member] of guildMembers) {
        const candidates: Array<{ name: string; via: string }> = [];
        if (member.nickname) {
          candidates.push({ name: member.nickname, via: 'nickname' });
        }
        if (member.user.globalName) {
          candidates.push({ name: member.user.globalName, via: 'globalName' });
        }
        if (member.displayName) {
          candidates.push({ name: member.displayName, via: 'displayName' });
        }
        if (member.user.username) {
          candidates.push({ name: member.user.username, via: 'username' });
        }

        for (const { name, via } of candidates) {
          const key = name.toLowerCase();
          if (!nameMap.has(key)) {
            nameMap.set(key, { discordUserId: member.user.id, matchedVia: via });
          }
        }
      }

      this.guildMemberNameMapCache.set(guildId, nameMap);
      logger.debug(`Built Discord guild name map for guild ${guildId}: ${nameMap.size} entries`);
    } catch (error: unknown) {
      logger.debug('Failed to fetch Discord guild members for name matching', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return nameMap;
  }

  /**
   * Try to match unlinked RSI handles against Discord guild member names.
   * For each match, looks up the platform User by discordId and creates a tentative link.
   */
  private async tryDiscordGuildNameMatch(
    organizationId: string,
    guildId: string,
    unlinkedHandles: string[],
    linkedHandles: Set<string>,
    crawledMembers: RsiCrawledMember[],
    links: RsiUserLink[]
  ): Promise<void> {
    if (unlinkedHandles.length === 0) {
      return;
    }

    try {
      const nameMap = await this.fetchGuildMemberNameMap(guildId);
      if (nameMap.size === 0) {
        return;
      }

      const alreadyLinkedUserIds = new Set(links.map(l => l.userId));

      for (const handle of unlinkedHandles) {
        if (linkedHandles.has(handle.toLowerCase())) {
          continue;
        }

        const discordMatch = nameMap.get(handle.toLowerCase());
        if (!discordMatch) {
          continue;
        }

        // Find platform user with this discordId
        const user = await this.userRepo.findOne({
          where: { discordId: discordMatch.discordUserId },
          select: ['id', 'discordId', 'rsiHandle', 'username'],
        });

        if (!user || alreadyLinkedUserIds.has(user.id)) {
          continue;
        }

        // Verify user is an active org member
        const isMember = await this.membershipRepo.findOne({
          where: { userId: user.id, organizationId, isActive: true },
          select: ['id'],
        });
        if (!isMember) {
          continue;
        }

        // Verify no existing link for this user in this org
        const existingLink = await this.userLinkRepo.findOne({
          where: { userId: user.id, organizationId },
        });
        if (existingLink) {
          continue;
        }

        const crawled = crawledMembers.find(m => m.handle.toLowerCase() === handle.toLowerCase());

        const newLink = this.userLinkRepo.create({
          organizationId,
          rsiHandle: handle,
          userId: user.id,
          discordUserId: discordMatch.discordUserId,
          syncStatus: SyncStatus.NEEDS_REVIEW,
          verificationMethod: VerificationMethod.DISCORD_MATCH,
          lastSyncedAt: new Date(),
          lastKnownRank: crawled?.rank ?? undefined,
          isAffiliate: crawled?.isAffiliate ?? false,
        });
        newLink.markNeedsReview(
          `Discord guild ${discordMatch.matchedVia} match: "${handle}" ↔ Discord user ${user.username ?? discordMatch.discordUserId}`
        );

        await this.userLinkRepo.save(newLink);
        links.push(newLink);
        linkedHandles.add(handle.toLowerCase());
        alreadyLinkedUserIds.add(user.id);

        logger.info(
          `Tentative link via Discord guild: RSI member ${handle} ↔ platform user ${user.id} (${discordMatch.matchedVia} match)`,
          { organizationId, discordUserId: discordMatch.discordUserId }
        );
      }
    } catch (error: unknown) {
      // Non-fatal — Discord matching is best-effort
      logger.debug('Discord guild name matching skipped', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getActiveFlagCountsByUser(organizationId: string): Promise<Map<string, number>> {
    const counts = await this.flagRepo
      .createQueryBuilder('flag')
      .select('flag.userId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('flag.organizationId = :organizationId', { organizationId })
      .andWhere('flag.status = :status', { status: FlagStatus.OPEN })
      .groupBy('flag.userId')
      .getRawMany<{ userId: string; count: string }>();

    return new Map(counts.map(c => [c.userId, parseInt(c.count, 10)]));
  }

  private async getDiscordStatus(
    organizationId: string,
    discordUserId: string | undefined,
    rsiRank: string | undefined,
    roleMappings: RsiRoleMapping[]
  ): Promise<MemberIntelCard['discordStatus']> {
    const status: MemberIntelCard['discordStatus'] = {
      isInGuild: false,
      discordUserId,
      discordRoles: [],
      expectedDiscordRoleId: undefined,
      expectedDiscordRoleName: undefined,
      hasCorrectRole: false,
    };

    // Find expected Discord role from mappings
    if (rsiRank) {
      const mapping = roleMappings.find(m => m.rsiRank === rsiRank);
      status.expectedDiscordRoleId = mapping?.discordRoleId;
    }
    // If no expected role is defined, the check is considered passing
    if (!status.expectedDiscordRoleId) {
      status.hasCorrectRole = true;
    }

    if (!discordUserId || !isDiscordServiceInitialized()) {
      // If DiscordService is not initialized, try BotClientManager as fallback
      if (discordUserId && !isDiscordServiceInitialized()) {
        const guildId = await this.resolveGuildId(organizationId);
        if (guildId) {
          try {
            const { BotClientManager } = await import('../../bot/BotClientManager');
            const botManager = BotClientManager.getInstance();
            if (botManager.isReady()) {
              const client = botManager.getClient();
              const guild = client.guilds.cache.get(guildId);
              if (guild) {
                const member = await guild.members.fetch(discordUserId).catch(() => null);
                if (member) {
                  status.isInGuild = true;
                  status.discordRoles = member.roles.cache
                    .filter(r => r.id !== guild.id)
                    .map(r => ({ id: r.id, name: r.name }));
                  if (status.expectedDiscordRoleId) {
                    status.hasCorrectRole = status.discordRoles.some(
                      r => r.id === status.expectedDiscordRoleId
                    );
                    // Resolve expected role name from guild roles
                    const expectedRole =
                      member.roles.cache.get(status.expectedDiscordRoleId) ??
                      guild.roles.cache.get(status.expectedDiscordRoleId);
                    status.expectedDiscordRoleName = expectedRole?.name;
                  }
                }
              }
            }
          } catch {
            // BotClientManager not available either — return default status
          }
        }
      }
      return status;
    }

    const guildId = await this.resolveGuildId(organizationId);
    if (!guildId) {
      return status;
    }

    try {
      const discordService = getDiscordService();
      const roles = await discordService.getUserRoles(guildId, discordUserId);
      status.isInGuild = true; // If getUserRoles succeeds, user is in guild
      status.discordRoles = roles;
      if (status.expectedDiscordRoleId) {
        status.hasCorrectRole = roles.some(r => r.id === status.expectedDiscordRoleId);
        // Resolve expected role name from fetched roles or guild
        const matchedRole = roles.find(r => r.id === status.expectedDiscordRoleId);
        if (matchedRole) {
          status.expectedDiscordRoleName = matchedRole.name;
        } else {
          // Try to resolve from guild roles
          try {
            const allGuildRoles = await discordService.getGuildRoles(guildId);
            const guildRole = allGuildRoles.find(
              (r: { id: string; name: string }) => r.id === status.expectedDiscordRoleId
            );
            status.expectedDiscordRoleName = guildRole?.name;
          } catch {
            // Non-fatal — keep ID only
          }
        }
      }
    } catch {
      // User not in guild or API error
      status.isInGuild = false;
    }

    return status;
  }

  private validateMemberRoleMapping(
    rsiRank: string | undefined,
    roleMappings: RsiRoleMapping[],
    discordStatus: MemberIntelCard['discordStatus'],
    membership: OrganizationMembership | null
  ): MemberIntelCard['roleMappingStatus'] {
    const status: MemberIntelCard['roleMappingStatus'] = {
      isRankMatchingMapping: false,
      isDiscordRoleCorrect: false,
      isInternalRoleCorrect: false,
      mismatches: [],
    };

    if (!rsiRank) {
      return status;
    }

    const mapping = roleMappings.find(m => m.rsiRank === rsiRank);
    if (!mapping) {
      status.mismatches.push(`No role mapping defined for RSI rank "${rsiRank}"`);
      return status;
    }

    status.expectedMapping = {
      rsiRank: mapping.rsiRank,
      discordRoleId: mapping.discordRoleId,
      internalRoleId: mapping.internalRoleId,
    };
    status.isRankMatchingMapping = true;

    // Discord role check
    if (mapping.discordRoleId) {
      status.isDiscordRoleCorrect = discordStatus.hasCorrectRole;
      if (!status.isDiscordRoleCorrect) {
        const expectedLabel = discordStatus.expectedDiscordRoleName
          ? `"${discordStatus.expectedDiscordRoleName}"`
          : mapping.discordRoleId;
        if (!discordStatus.isInGuild) {
          status.mismatches.push(
            `Expected Discord role ${expectedLabel} but user is not in Discord guild`
          );
        } else if (discordStatus.discordRoles.length > 0) {
          const actualNames = discordStatus.discordRoles.map(r => r.name).join(', ');
          status.mismatches.push(
            `Expected Discord role ${expectedLabel} but user has: ${actualNames}`
          );
        } else {
          status.mismatches.push(
            `Expected Discord role ${expectedLabel} but user has no Discord roles`
          );
        }
      }
    } else {
      status.isDiscordRoleCorrect = true; // No Discord role mapped
    }

    // Internal role check
    if (mapping.internalRoleId) {
      status.isInternalRoleCorrect = membership?.roleId === mapping.internalRoleId;
      if (!status.isInternalRoleCorrect) {
        status.mismatches.push(
          `Expected internal role ${mapping.internalRoleId} but user has ${membership?.roleId ?? 'no role'}`
        );
      }
    } else {
      status.isInternalRoleCorrect = true; // No internal role mapped
    }

    return status;
  }

  // ==================== MANUAL LINK / UNLINK ====================

  /**
   * Suggest platform users who could be linked to a given RSI handle.
   * Returns active org members, indicating if they already have a link.
   * Optionally filter by a search query (matches username).
   */
  async suggestLinkCandidates(organizationId: string, query?: string): Promise<LinkCandidate[]> {
    const qb = this.membershipRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.organizationId = :organizationId', { organizationId })
      .andWhere('m.isActive = true');

    if (query && query.trim().length > 0) {
      qb.andWhere('user.username ILIKE :q', { q: `%${query.trim()}%` });
    }

    qb.orderBy('user.username', 'ASC').take(20);

    const memberships = await qb.getMany();

    // Check existing links for these users
    const userIds = memberships.map(m => m.userId);
    const existingLinks =
      userIds.length > 0
        ? await this.userLinkRepo
            .createQueryBuilder('link')
            .where('link.organizationId = :organizationId', { organizationId })
            .andWhere('link.userId IN (:...userIds)', { userIds })
            .getMany()
        : [];

    const linkByUserId = new Map(existingLinks.map(l => [l.userId, l]));

    return memberships.map(m => {
      const link = linkByUserId.get(m.userId);
      const user = (m as unknown as { user?: User }).user;
      return {
        userId: m.userId,
        username: user?.username ?? m.userId,
        discordId: user?.discordId,
        isAlreadyLinked: !!link,
        existingRsiHandle: link?.rsiHandle,
      };
    });
  }

  /**
   * Manually link an RSI member to a platform user (admin action).
   * Creates an RsiUserLink with MANUAL verification, auto-verified.
   */
  async manualLink(
    organizationId: string,
    rsiHandle: string,
    input: ManualLinkInput,
    performedBy: string
  ): Promise<ManualLinkResult> {
    // Verify the RSI handle exists in crawled members
    const orgSid = await this.resolveOrgSid(organizationId);
    if (orgSid) {
      const crawled = await this.crawledMemberRepo.findOne({
        where: { organizationSid: orgSid, handle: rsiHandle },
      });
      if (!crawled) {
        throw new NotFoundError(`RSI member "${rsiHandle}" not found in crawled org data`);
      }
    }

    // Verify target user is an active member of this org
    const membership = await this.membershipRepo.findOne({
      where: { userId: input.userId, organizationId, isActive: true },
    });
    if (!membership) {
      throw new ValidationError('Target user is not an active member of this organization');
    }

    // Check if user already has a link in this org
    const existingUserLink = await this.userLinkRepo.findOne({
      where: { userId: input.userId, organizationId },
    });
    if (existingUserLink) {
      throw new ValidationError(
        `User already linked to RSI handle "${existingUserLink.rsiHandle}" in this organization`
      );
    }

    // Check if this RSI handle is already linked to another user in this org
    const existingHandleLink = await this.userLinkRepo.findOne({
      where: { rsiHandle, organizationId },
    });
    if (existingHandleLink) {
      throw new ValidationError(
        `RSI handle "${rsiHandle}" is already linked to another user in this organization`
      );
    }

    // Resolve Discord ID: use provided or fall back to user's Discord ID
    const user = await this.userRepo.findOne({
      where: { id: input.userId },
      select: ['id', 'discordId'],
    });
    const discordUserId = input.discordUserId ?? user?.discordId;

    // Create verified link
    const link = this.userLinkRepo.create({
      userId: input.userId,
      organizationId,
      rsiHandle,
      verificationMethod: VerificationMethod.MANUAL,
      discordUserId: discordUserId ?? undefined,
      syncStatus: SyncStatus.SYNCED,
      verifiedAt: new Date(),
      lastSyncedAt: new Date(),
    });

    const saved = await this.userLinkRepo.save(link);

    logger.info('Manual RSI link created', {
      linkId: saved.id,
      rsiHandle,
      userId: input.userId,
      organizationId,
      performedBy,
    });

    return {
      success: true,
      linkId: saved.id,
      rsiHandle,
      userId: input.userId,
    };
  }

  /**
   * Remove the link between an RSI member and a platform user (admin action).
   */
  async unlinkMember(
    organizationId: string,
    rsiHandle: string,
    performedBy: string
  ): Promise<{ success: boolean }> {
    const link = await this.userLinkRepo.findOne({
      where: { organizationId, rsiHandle },
    });

    if (!link) {
      throw new NotFoundError(`No link found for RSI handle "${rsiHandle}" in this organization`);
    }

    await this.userLinkRepo.remove(link);

    logger.info('Manual RSI unlink performed', {
      rsiHandle,
      userId: link.userId,
      organizationId,
      performedBy,
    });

    return { success: true };
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Clear all cached RSI data for an organization.
   * Removes crawled members, citizen org affiliations, and member cache entries.
   * Does NOT remove user links or audit logs.
   */
  async clearCache(organizationId: string, performedBy: string): Promise<ClearCacheResult> {
    const orgSid = await this.resolveOrgSid(organizationId);

    let crawledDeleted = 0;
    let citizenOrgsDeleted = 0;
    let memberCacheDeleted = 0;

    // 1. Delete crawled members for this org
    if (orgSid) {
      const crawledResult = await this.crawledMemberRepo.delete({
        organizationSid: orgSid,
      });
      crawledDeleted = crawledResult.affected ?? 0;

      // 2. Delete citizen org affiliations for members of this org
      // Get all handles from user links to scope deletion
      const links = await this.userLinkRepo.find({
        where: { organizationId },
        select: ['rsiHandle'],
      });
      if (links.length > 0) {
        const handles = links.map(l => l.rsiHandle);
        for (const handle of handles) {
          const result = await this.citizenOrgRepo.delete({ citizenHandle: handle });
          citizenOrgsDeleted += result.affected ?? 0;
        }
      }
    }

    // 3. Delete member cache entries
    const cacheResult = await this.memberCacheRepo.delete({ organizationId });
    memberCacheDeleted = cacheResult.affected ?? 0;

    logger.info('RSI cache cleared for organization', {
      organizationId,
      performedBy,
      crawledMembers: crawledDeleted,
      citizenOrgs: citizenOrgsDeleted,
      memberCache: memberCacheDeleted,
    });

    return {
      crawledMembers: crawledDeleted,
      citizenOrgs: citizenOrgsDeleted,
      memberCache: memberCacheDeleted,
    };
  }
}

// Singleton
export const rsiMemberIntelService = new RsiMemberIntelService();

