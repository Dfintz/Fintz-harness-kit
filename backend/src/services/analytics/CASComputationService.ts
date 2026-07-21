/**
 * CASComputationService — Computes Composite Activity Score for an organization.
 *
 * Five components weighted to produce a 0-100 score:
 * - Online Presence (30%): Discord members currently online
 * - Engagement (20%): Daily messages + reactions per capita
 * - Consistency (25%): Members active 3+ days in last 7
 * - Voice Activity (15%): Weekly voice minutes per capita
 * - Site Activity (10%): Members who visited the site in 24h
 *
 * All SQL queries use JOINs/subqueries — no IN-clause bombs (AP-2).
 * Uses getManyAndCount or raw aggregates — no load-all (AP-1).
 *
 * @see docs/CAS_ARCHITECTURE_BRIEF.md
 */

import type { CASBreakdown, CASConfig } from '@sc-fleet-manager/shared-types';

import { AppDataSource } from '../../data-source';
import { GuildOrganization } from '../../models/GuildOrganization';
import { MemberEngagement } from '../../models/MemberEngagement';
import { OrgActivityHeatmap } from '../../models/OrgActivityHeatmap';
import { OrgActivityScore } from '../../models/OrgActivityScore';
import { Organization } from '../../models/Organization';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';
import { domainEvents } from '../shared/DomainEventBus';

import { loadCASConfig, scoreToCasTier } from './CASConfig';

const CAS_CACHE_TTL = 20 * 60; // 20 minutes

export class CASComputationService {
  private readonly scoreRepo = AppDataSource.getRepository(OrgActivityScore);
  private readonly heatmapRepo = AppDataSource.getRepository(OrgActivityHeatmap);
  private readonly engagementRepo = AppDataSource.getRepository(MemberEngagement);
  private readonly guildOrgRepo = AppDataSource.getRepository(GuildOrganization);
  private readonly orgRepo = AppDataSource.getRepository(Organization);

  /**
   * Compute and persist CAS score for a single organization.
   */
  async computeScore(organizationId: string): Promise<OrgActivityScore> {
    const config = await loadCASConfig(organizationId);

    // Get member count
    const org = await this.orgRepo.findOne({
      where: { id: organizationId },
      select: ['id', 'totalMembers'],
    });
    const memberCount = org?.totalMembers ?? 0;
    if (memberCount === 0) {
      logger.warn('[CAS] Zero members for organization', {
        organizationId,
        orgExists: !!org,
      });
      return this.persistScore(
        organizationId,
        0,
        {
          onlinePresence: 0,
          engagement: 0,
          consistency: 0,
          voiceActivity: 0,
          siteActivity: 0,
        },
        0
      );
    }

    // Get all guild IDs for this org
    const guilds = await this.guildOrgRepo.find({
      where: { organizationId, isActive: true },
      select: ['guildId'],
    });
    const guildIds = guilds.map(g => g.guildId);

    // Compute 5 components
    const op = await this.computeOnlinePresence(guildIds, memberCount, config);
    const eng = await this.computeEngagement(organizationId, guildIds, memberCount, config);
    const cons = await this.computeConsistency(organizationId, guildIds, memberCount, config);
    const voice = await this.computeVoiceActivity(guildIds, memberCount, config, organizationId);
    const site = await this.computeSiteActivity(organizationId, memberCount, config);

    // Weighted sum
    const { weights } = config;
    const score =
      Math.round(
        (weights.onlinePresence * op +
          weights.engagement * eng +
          weights.consistency * cons +
          weights.voice * voice +
          weights.site * site) *
          10
      ) / 10; // Round to 1 decimal

    const clampedScore = Math.max(0, Math.min(100, score));
    const breakdown: CASBreakdown = {
      onlinePresence: Math.round(op * 10) / 10,
      engagement: Math.round(eng * 10) / 10,
      consistency: Math.round(cons * 10) / 10,
      voiceActivity: Math.round(voice * 10) / 10,
      siteActivity: Math.round(site * 10) / 10,
    };

    // Persist + cache + emit
    const snapshot = await this.persistScore(organizationId, clampedScore, breakdown, memberCount);

    // Sample heatmap for current hour
    await this.sampleHeatmap(organizationId, guildIds, memberCount).catch(err => {
      logger.warn('Heatmap sample failed (non-fatal)', { organizationId, error: String(err) });
    });

    return snapshot;
  }

  // ── Component calculations ─────────────────────────────────────

  private async computeOnlinePresence(
    guildIds: string[],
    memberCount: number,
    config: CASConfig
  ): Promise<number> {
    if (guildIds.length === 0) {
      return 0;
    }

    // PresenceTracking is in-memory, per-guild — import dynamically to avoid circular deps
    let totalOnline = 0;
    try {
      const { PresenceTrackingService } = await import('../discord/PresenceTrackingService');
      const presenceService = PresenceTrackingService.getInstance();
      for (const gid of guildIds) {
        const counts = presenceService.getStatusCounts(gid);
        totalOnline += (counts?.online ?? 0) + (counts?.idle ?? 0) + (counts?.dnd ?? 0);
      }
    } catch {
      // Presence service unavailable (bot not connected) — OP=0
      return 0;
    }

    const ratio = totalOnline / (config.onlinePresenceTarget * memberCount);
    return 100 * Math.min(1, ratio);
  }

  private async computeEngagement(
    organizationId: string,
    guildIds: string[],
    memberCount: number,
    config: CASConfig
  ): Promise<number> {
    if (guildIds.length === 0) {
      return 0;
    }

    const result = await this.engagementRepo
      .createQueryBuilder('me')
      .select('COALESCE(SUM(me."messageCount"), 0)', 'totalMessages')
      .addSelect('COALESCE(SUM(me."reactionsGiven"), 0)', 'totalReactions')
      .innerJoin(GuildOrganization, 'go', 'me."guildId" = go."guildId"')
      .where('go."organizationId" = :organizationId', { organizationId })
      .andWhere('me."guildId" IN (:...guildIds)', { guildIds })
      .andWhere('me.date = CURRENT_DATE')
      .getRawOne();

    const totalInteractions =
      Number(result?.totalMessages ?? 0) + Number(result?.totalReactions ?? 0);
    const perCapita = totalInteractions / memberCount;
    return 100 * Math.min(1, perCapita / config.engagementTarget);
  }

  private async computeConsistency(
    organizationId: string,
    guildIds: string[],
    memberCount: number,
    config: CASConfig
  ): Promise<number> {
    if (guildIds.length === 0) {
      return 0;
    }

    // Count users by activity days in last 7 days
    const rows = await AppDataSource.query(
      `
      SELECT activity_days, COUNT(*)::int as user_count
      FROM (
        SELECT me."userId", COUNT(DISTINCT me.date) as activity_days
        FROM member_engagements me
        INNER JOIN guild_organizations go ON me."guildId" = go."guildId"
        WHERE go."organizationId" = $1
          AND me.date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY me."userId"
      ) sub
      GROUP BY activity_days
    `,
      [organizationId]
    );

    let coreActive = 0; // 3+ days
    let returning = 0; // 1-2 days
    for (const row of rows as Array<{ activity_days: number; user_count: number }>) {
      const days = Number(row.activity_days);
      const count = Number(row.user_count);
      if (days >= 3) {
        coreActive += count;
      } else {
        returning += count;
      }
    }

    const consistencyPerCapita = (0.6 * coreActive + 0.3 * returning) / memberCount;
    return 100 * Math.min(1, consistencyPerCapita / config.consistencyTarget);
  }

  private async computeVoiceActivity(
    guildIds: string[],
    memberCount: number,
    config: CASConfig,
    organizationId?: string
  ): Promise<number> {
    let totalVoice = 0;

    // Discord voice minutes
    if (guildIds.length > 0) {
      const result = await this.engagementRepo
        .createQueryBuilder('me')
        .select('COALESCE(SUM(me."voiceMinutes"), 0)', 'totalVoice')
        .innerJoin(GuildOrganization, 'go', 'me."guildId" = go."guildId"')
        .where('me."guildId" IN (:...guildIds)', { guildIds })
        .andWhere("me.date >= CURRENT_DATE - INTERVAL '7 days'")
        .getRawOne();

      totalVoice = Number(result?.totalVoice ?? 0);
    }

    // Add Mumble/external voice server minutes (if configured with CAS integration)
    if (organizationId) {
      try {
        const { VoiceServerService } = await import('../communication/voice/VoiceServerService');
        const mumbleMinutes =
          await VoiceServerService.getInstance().getMumbleVoiceMinutes(organizationId);
        totalVoice += mumbleMinutes;
      } catch {
        // VoiceServerService unavailable — skip Mumble contribution
      }
    }

    const perCapita = totalVoice / memberCount;
    return 100 * Math.min(1, perCapita / config.voiceTarget);
  }

  private async computeSiteActivity(
    organizationId: string,
    memberCount: number,
    config: CASConfig
  ): Promise<number> {
    const result = await AppDataSource.query(
      `
      SELECT COUNT(*)::int as active_users
      FROM users u
      INNER JOIN organization_memberships om ON u.id = om."userId"
      WHERE om."organizationId" = $1
        AND om."isActive" = true
        AND u."lastActiveAt" >= NOW() - INTERVAL '24 hours'
    `,
      [organizationId]
    );

    const activeUsers = Number(result?.[0]?.active_users ?? 0);
    const perCapita = activeUsers / memberCount;
    return 100 * Math.min(1, perCapita / config.siteActivityTarget);
  }

  // ── Persistence + cache ────────────────────────────────────────

  private async persistScore(
    organizationId: string,
    score: number,
    breakdown: CASBreakdown,
    memberCount: number
  ): Promise<OrgActivityScore> {
    const tier = scoreToCasTier(score);
    const now = new Date();

    const snapshot = this.scoreRepo.create({
      organizationId,
      score,
      tier,
      breakdown,
      memberCount,
      computedAt: now,
    });
    await this.scoreRepo.save(snapshot);

    // Cache latest score
    const cachePayload = {
      organizationId,
      score,
      tier,
      breakdown,
      memberCount,
      computedAt: now.toISOString(),
    };
    await cache
      .set(`org:${organizationId}:cas:latest`, cachePayload, CAS_CACHE_TTL)
      .catch(() => {});

    // Emit domain event (only on meaningful change)
    const previousCache = await cache.get<{ score: number; tier: string }>(
      `org:${organizationId}:cas:previous`
    );
    const isFirstComputation = !previousCache;
    const previousScore = previousCache?.score ?? score;
    const previousTier = previousCache?.tier ?? tier;

    if (isFirstComputation || Math.abs(score - previousScore) >= 1 || tier !== previousTier) {
      domainEvents.emit('analytics:cas_updated', {
        organizationId,
        score,
        previousScore,
        tier,
        previousTier,
        breakdown: { ...breakdown },
        computedAt: now.toISOString(),
      });
    }
    await cache
      .set(`org:${organizationId}:cas:previous`, { score, tier }, CAS_CACHE_TTL * 2)
      .catch(() => {});

    logger.debug('CAS score computed', { organizationId, score, tier });
    return snapshot;
  }

  // ── Heatmap sampling ───────────────────────────────────────────

  async sampleHeatmap(
    organizationId: string,
    guildIds: string[],
    memberCount: number
  ): Promise<void> {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const hour = now.getUTCHours();

    // Presence count from Discord
    let presenceCount = 0;
    try {
      const { PresenceTrackingService } = await import('../discord/PresenceTrackingService');
      const presenceService = PresenceTrackingService.getInstance();
      for (const gid of guildIds) {
        const counts = presenceService.getStatusCounts(gid);
        presenceCount += (counts?.online ?? 0) + (counts?.idle ?? 0) + (counts?.dnd ?? 0);
      }
    } catch {
      // Bot not connected — presence = 0
    }

    // Site active count for current hour (last 7 days, same day+hour)
    const siteResult = await AppDataSource.query(
      `
      SELECT COUNT(DISTINCT u.id)::int as site_active
      FROM users u
      INNER JOIN organization_memberships om ON u.id = om."userId"
      WHERE om."organizationId" = $1
        AND om."isActive" = true
        AND u."lastActiveAt" >= NOW() - INTERVAL '1 hour'
    `,
      [organizationId]
    );
    const siteActiveCount = Number(siteResult?.[0]?.site_active ?? 0);

    const rawScore = presenceCount + 2 * siteActiveCount;

    const sample = this.heatmapRepo.create({
      organizationId,
      dayOfWeek,
      hour,
      presenceCount,
      siteActiveCount,
      rawScore,
      memberCount,
      sampledAt: now,
    });
    await this.heatmapRepo.save(sample);
  }
}

