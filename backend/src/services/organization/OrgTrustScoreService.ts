import { Repository } from 'typeorm';


import { AppDataSource } from '../../data-source';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  OrganizationRelationship,
  RelationshipStatus,
} from '../../models/OrganizationRelationship';
import { RsiUserLink } from '../../models/RsiUserLink';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

/**
 * Breakdown of an organization's computed trust score
 */
export interface OrgTrustScoreBreakdown {
  /** RSI-verified member percentage (0-100) */
  verifiedMemberRate: number;
  /** Count of RSI-verified members */
  verifiedMemberCount: number;
  /** Total members considered */
  totalMembers: number;
  /** Average member LFG reputation score (0-100) */
  avgMemberReputation: number;
  /** Average category ratings across members */
  categoryAverages: {
    communication: number;
    teamwork: number;
    skill: number;
    reliability: number;
    leadership: number;
  };
  /** Whether the organization is RSI-verified */
  orgRsiVerified: boolean;
  /** Average org-to-org relationship trust (0-100) */
  avgRelationshipTrust: number;
  /** Number of active org relationships */
  activeRelationships: number;
}

/**
 * Full trust score result for an organization
 */
export interface OrgTrustScore {
  organizationId: string;
  /** Composite score (0-100) */
  score: number;
  /** Human-readable tier label */
  tier: string;
  /** Component breakdown */
  breakdown: OrgTrustScoreBreakdown;
  /** Timestamp of computation */
  computedAt: string;
}

// Weights for composite score
const WEIGHT_VERIFIED_MEMBERS = 0.2;
const WEIGHT_MEMBER_REPUTATION = 0.25;
const WEIGHT_ORG_VERIFIED = 0.2;
const WEIGHT_RELATIONSHIP_TRUST = 0.2;
const WEIGHT_CATEGORY_RATINGS = 0.15;

// In-memory cache (5-min TTL matching other services)
const CACHE_TTL_MS = 5 * 60 * 1000;

function getTierLabel(score: number): string {
  if (score >= 90) {
    return 'Platinum';
  }
  if (score >= 75) {
    return 'Gold';
  }
  if (score >= 60) {
    return 'Silver';
  }
  if (score >= 40) {
    return 'Bronze';
  }
  return 'Unranked';
}

/**
 * Service that computes a composite trust score for an organization.
 *
 * Components:
 *  1. Verified member rate (RSI-verified members / total members)
 *  2. Average member LFG reputation
 *  3. Organization RSI verification status
 *  4. Average org-to-org relationship trust
 *  5. Average member category ratings (communication, teamwork, etc.)
 */
export class OrgTrustScoreService {
  private membershipRepo: Repository<OrganizationMembership>;
  private rsiLinkRepo: Repository<RsiUserLink>;
  private reputationRepo: Repository<LFGUserReputation>;
  private relationshipRepo: Repository<OrganizationRelationship>;
  private orgRepo: Repository<Organization>;
  private scoreCache = new Map<string, { data: OrgTrustScore; expiresAt: number }>();

  constructor() {
    this.membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    this.rsiLinkRepo = AppDataSource.getRepository(RsiUserLink);
    this.reputationRepo = AppDataSource.getRepository(LFGUserReputation);
    this.relationshipRepo = AppDataSource.getRepository(OrganizationRelationship);
    this.orgRepo = AppDataSource.getRepository(Organization);
  }

  /**
   * Get the composite trust score for an organization (cached 5 min).
   */
  async getTrustScore(organizationId: string): Promise<OrgTrustScore> {
    // Redis cache: 15 min TTL (Phase 5.5) — replaces in-memory Map for multi-instance support
    const cacheKey = `org:${organizationId}:trust:score`;
    const redisCached = await cache.get<OrgTrustScore>(cacheKey);
    if (redisCached) {
      return redisCached;
    }

    // Fallback to in-memory cache (faster if Redis is down)
    const cached = this.scoreCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const result = await this.computeTrustScore(organizationId);

    // Dual cache: Redis for cross-instance sharing + in-memory for speed
    await cache.set(cacheKey, result, 900); // 15 min
    this.scoreCache.set(organizationId, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
  }

  private async computeTrustScore(organizationId: string): Promise<OrgTrustScore> {
    // Count members + fetch org + relationships in parallel (avoids loading all 25K members)
    const [totalMembers, org, relationships] = await Promise.all([
      this.membershipRepo.count({ where: { organizationId } }),
      this.orgRepo.findOne({ where: { id: organizationId } }),
      this.relationshipRepo.find({
        where: [
          { organizationId, status: RelationshipStatus.ACTIVE },
          { targetOrganizationId: organizationId, status: RelationshipStatus.ACTIVE },
        ],
      }),
    ]);

    // RSI links don't need member IDs — they reference organizationId directly
    const rsiLinks =
      totalMembers > 0
        ? await this.rsiLinkRepo.find({ where: { organizationId } })
        : [];

    // Reputation averages via SQL aggregation + subquery (avoids 25K IN clause)
    const memberSubquery = this.membershipRepo
      .createQueryBuilder('m')
      .select('m.userId')
      .where('m.organizationId = :orgId')
      .getQuery();

    const repAgg =
      totalMembers > 0
        ? await this.reputationRepo
            .createQueryBuilder('r')
            .select('AVG(r."overallScore")', 'avgScore')
            .where(`r."userId" IN (${memberSubquery})`)
            .setParameter('orgId', organizationId)
            .getRawOne<{ avgScore: string | null }>()
        : null;

    // Category averages need loaded entities (JSON column processing)
    const reputations =
      totalMembers > 0
        ? await this.reputationRepo
            .createQueryBuilder('r')
            .where(`r."userId" IN (${memberSubquery})`)
            .setParameter('orgId', organizationId)
            .getMany()
        : [];

    // 1. Verified member rate
    const verifiedLinks = rsiLinks.filter(link => link.isVerified());
    const verifiedMemberCount = verifiedLinks.length;
    const verifiedMemberRate = totalMembers > 0 ? (verifiedMemberCount / totalMembers) * 100 : 0;

    // 2. Average member reputation (from SQL aggregation)
    const avgMemberReputation = repAgg?.avgScore ? Number(repAgg.avgScore) : 50;

    // 3. Org RSI verified
    const orgRsiVerified = org?.rsiVerified ?? false;

    // 4. Average relationship trust
    const activeRelationships = relationships.length;
    const avgRelationshipTrust =
      activeRelationships > 0
        ? relationships.reduce((sum, r) => sum + Number(r.trustScore), 0) / activeRelationships
        : 50; // neutral default

    // 5. Category averages across members
    const categoryAverages = this.computeCategoryAverages(reputations);

    // Composite score
    // Category ratings are on 1-5 scale; normalize to 0-100 for weighting
    const categoryAvg = this.averageOfCategories(categoryAverages) * 20;
    const orgVerifiedScore = orgRsiVerified ? 100 : 0;

    const compositeScore = Math.round(
      verifiedMemberRate * WEIGHT_VERIFIED_MEMBERS +
        avgMemberReputation * WEIGHT_MEMBER_REPUTATION +
        orgVerifiedScore * WEIGHT_ORG_VERIFIED +
        avgRelationshipTrust * WEIGHT_RELATIONSHIP_TRUST +
        categoryAvg * WEIGHT_CATEGORY_RATINGS
    );

    const score = Math.min(100, Math.max(0, compositeScore));

    const result: OrgTrustScore = {
      organizationId,
      score,
      tier: getTierLabel(score),
      breakdown: {
        verifiedMemberRate: Math.round(verifiedMemberRate * 100) / 100,
        verifiedMemberCount,
        totalMembers,
        avgMemberReputation: Math.round(avgMemberReputation * 100) / 100,
        categoryAverages,
        orgRsiVerified,
        avgRelationshipTrust: Math.round(avgRelationshipTrust * 100) / 100,
        activeRelationships,
      },
      computedAt: new Date().toISOString(),
    };

    logger.debug(`Computed trust score for org ${organizationId}: ${score} (${result.tier})`);

    return result;
  }

  private computeCategoryAverages(
    reputations: LFGUserReputation[]
  ): OrgTrustScoreBreakdown['categoryAverages'] {
    const defaults = { communication: 0, teamwork: 0, skill: 0, reliability: 0, leadership: 0 };
    if (reputations.length === 0) {
      return defaults;
    }

    const sums = { ...defaults };
    let count = 0;

    for (const rep of reputations) {
      if (rep.categoryAverages) {
        sums.communication += rep.categoryAverages.communication ?? 0;
        sums.teamwork += rep.categoryAverages.teamwork ?? 0;
        sums.skill += rep.categoryAverages.skill ?? 0;
        sums.reliability += rep.categoryAverages.reliability ?? 0;
        sums.leadership += rep.categoryAverages.leadership ?? 0;
        count++;
      }
    }

    if (count === 0) {
      return defaults;
    }

    return {
      communication: Math.round((sums.communication / count) * 100) / 100,
      teamwork: Math.round((sums.teamwork / count) * 100) / 100,
      skill: Math.round((sums.skill / count) * 100) / 100,
      reliability: Math.round((sums.reliability / count) * 100) / 100,
      leadership: Math.round((sums.leadership / count) * 100) / 100,
    };
  }

  private averageOfCategories(cats: OrgTrustScoreBreakdown['categoryAverages']): number {
    const values = [
      cats.communication,
      cats.teamwork,
      cats.skill,
      cats.reliability,
      cats.leadership,
    ];
    const nonZero = values.filter(v => v > 0);
    if (nonZero.length === 0) {
      return 50;
    } // neutral default
    return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  }
}

