import type {
  OrgSCStatsAnalytics,
  SCStatsCareerHours,
  SkillDistribution,
} from '@sc-fleet-manager/shared-types';
import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { SCStatsCsvImport } from '../../models/SCStatsCsvImport';
import { UserGameplayPreferences } from '../../models/UserGameplayPreferences';
import { logger } from '../../utils/logger';

// Re-export for existing consumers
export type { OrgSCStatsAnalytics } from '@sc-fleet-manager/shared-types';

/**
 * SCStatsOrgAnalyticsService
 *
 * Wave 2.5 — Phase 3: Enhanced Analytics
 *
 * Provides organization-level SCStats analytics for admin dashboards,
 * including member verification rates, skill distributions, and top performers.
 */
export class SCStatsOrgAnalyticsService {
  private readonly preferencesRepo: Repository<UserGameplayPreferences>;
  private readonly membershipRepo: Repository<OrganizationMembership>;

  constructor() {
    this.preferencesRepo = AppDataSource.getRepository(UserGameplayPreferences);
    this.membershipRepo = AppDataSource.getRepository(OrganizationMembership);
  }

  /**
   * Get SCStats analytics for an organization
   */
  async getOrgAnalytics(organizationId: string): Promise<OrgSCStatsAnalytics> {
    // Count members via SQL (avoids loading all 25K members)
    const memberCount = await this.membershipRepo.count({
      where: { organizationId, isActive: true },
    });

    if (memberCount === 0) {
      return this.emptyAnalytics();
    }

    // SQL aggregation for verified preferences — use proper TypeORM subquery binding
    // NOTE: Column names must use actual DB names (snake_case), not TypeScript property names,
    // because these appear inside raw SQL expressions that TypeORM does not resolve.
    const aggregates = await this.preferencesRepo
      .createQueryBuilder('p')
      .select('COUNT(*)::int', 'verifiedCount')
      .addSelect('COALESCE(AVG(p."scstats_kd_ratio"), 0)', 'averageKD')
      .addSelect('COALESCE(AVG(p."scstats_total_hours"), 0)', 'averageTotalHours')
      .addSelect('COALESCE(AVG(p."scstats_missions_completed"), 0)', 'averageMissionsCompleted')
      .where(qb => {
        const subQuery = qb
          .subQuery()
          .select('m.userId')
          .from(OrganizationMembership, 'm')
          .where('m.organizationId = :orgId')
          .andWhere('m.isActive = true')
          .getQuery();
        return `p."userId" IN ${subQuery}`;
      })
      .andWhere('p."scstats_verified" = true')
      .setParameter('orgId', organizationId)
      .getRawOne<{
        verifiedCount: number;
        averageKD: string;
        averageTotalHours: string;
        averageMissionsCompleted: string;
      }>();

    const verifiedCount = aggregates?.verifiedCount ?? 0;
    const verificationRate = memberCount > 0 ? (verifiedCount / memberCount) * 100 : 0;

    // Top 10 performers by K/D — SQL ORDER BY + LIMIT instead of loading all + sorting in JS
    const topPerformers = await this.preferencesRepo
      .createQueryBuilder('p')
      .select('p."userId"', 'userId')
      .addSelect('p."scstats_kd_ratio"', 'kdRatio')
      .addSelect('p."scstats_total_hours"', 'totalHours')
      .where(qb => {
        const subQuery = qb
          .subQuery()
          .select('m2.userId')
          .from(OrganizationMembership, 'm2')
          .where('m2.organizationId = :orgId')
          .andWhere('m2.isActive = true')
          .getQuery();
        return `p."userId" IN ${subQuery}`;
      })
      .andWhere('p."scstats_verified" = true')
      .andWhere('p."scstats_kd_ratio" IS NOT NULL')
      .setParameter('orgId', organizationId)
      .orderBy('p."scstats_kd_ratio"', 'DESC')
      .limit(10)
      .getRawMany<{ userId: string; kdRatio: string; totalHours: string }>();

    // Career breakdown — still needs entity-level JSON processing (memberIds required)
    const memberIds = await this.membershipRepo
      .createQueryBuilder('m')
      .select('m.userId', 'userId')
      .where('m.organizationId = :orgId', { orgId: organizationId })
      .andWhere('m.isActive = true')
      .getRawMany<{ userId: string }>()
      .then(rows => rows.map(r => r.userId));

    const { careerBreakdown, skillDistribution } = await this.calculateCareerAnalytics(memberIds);

    logger.info('Org SCStats analytics generated', {
      organizationId,
      memberCount,
      verifiedCount,
    });

    return {
      memberCount,
      verifiedCount,
      verificationRate,
      averageKD: Number(aggregates?.averageKD ?? 0),
      averageTotalHours: Number(aggregates?.averageTotalHours ?? 0),
      averageMissionsCompleted: Number(aggregates?.averageMissionsCompleted ?? 0),
      topPerformers: topPerformers.map(p => ({
        userId: p.userId,
        kdRatio: Number(p.kdRatio ?? 0),
        totalHours: Number(p.totalHours ?? 0),
      })),
      skillDistribution,
      careerBreakdown,
    };
  }

  /**
   * Calculate career breakdown and skill distribution from SCStats CSV import data.
   *
   * Uses the `hoursByCareer` stored in each member's CSV import summary.
   * Returns both the aggregated career breakdown (total hours + ship count per career)
   * and the skill distribution (members bucketed by experience per career).
   */
  private async calculateCareerAnalytics(memberIds: string[]): Promise<{
    careerBreakdown: SCStatsCareerHours[];
    skillDistribution: Record<string, SkillDistribution>;
  }> {
    if (memberIds.length === 0) {
      return { careerBreakdown: [], skillDistribution: {} };
    }

    const csvImportRepo = AppDataSource.getRepository(SCStatsCsvImport);

    // Fetch CSV imports that have summary data with hoursByCareer
    const imports = await csvImportRepo.find({
      where: { userId: In(memberIds) },
      select: ['userId', 'summary'],
    });

    // Aggregate totals per career and per-user hours for skill distribution
    const careerTotals = new Map<string, { hours: number; shipCount: number }>();
    const distribution: Record<string, SkillDistribution> = {};

    for (const csvImport of imports) {
      const summary = csvImport.summary;
      if (!summary) {
        continue;
      }

      const hoursByCareer = summary.hoursByCareer as
        | Array<{ career: string; hours: number; shipCount: number }>
        | undefined;
      if (!Array.isArray(hoursByCareer) || hoursByCareer.length === 0) {
        continue;
      }

      this.aggregateCareerEntries(hoursByCareer, careerTotals, distribution);
    }

    // Build sorted career breakdown array
    const careerBreakdown: SCStatsCareerHours[] = [...careerTotals.entries()]
      .map(([career, { hours, shipCount }]) => ({
        career,
        hours: Math.round(hours * 100) / 100,
        shipCount,
      }))
      .sort((a, b) => b.hours - a.hours);

    return { careerBreakdown, skillDistribution: distribution };
  }

  /**
   * Process a single member's hoursByCareer entries into running totals and distribution.
   */
  private aggregateCareerEntries(
    entries: Array<{ career: string; hours: number; shipCount: number }>,
    careerTotals: Map<string, { hours: number; shipCount: number }>,
    distribution: Record<string, SkillDistribution>
  ): void {
    for (const entry of entries) {
      const hours = Number(entry.hours) || 0;
      if (hours <= 0) {
        continue;
      }

      const career = String(entry.career ?? '');
      // Reject prototype pollution keys
      if (!career || career === '__proto__' || career === 'constructor' || career === 'prototype') {
        continue;
      }
      const shipCount = Number(entry.shipCount) || 0;

      const existing = careerTotals.get(career);
      if (existing) {
        existing.hours += hours;
        existing.shipCount += shipCount;
      } else {
        careerTotals.set(career, { hours, shipCount });
      }

      if (!distribution[career]) {
        distribution[career] = { low: 0, medium: 0, high: 0, expert: 0 };
      }
      distribution[career][this.bucketFlightHours(hours)]++;
    }
  }

  /**
   * Bucket flight hours into a tier label.
   */
  private bucketFlightHours(hours: number): 'low' | 'medium' | 'high' | 'expert' {
    if (hours < 50) {
      return 'low';
    }
    if (hours < 200) {
      return 'medium';
    }
    if (hours < 500) {
      return 'high';
    }
    return 'expert';
  }

  /**
   * Return empty analytics for orgs with no members
   */
  private emptyAnalytics(): OrgSCStatsAnalytics {
    return {
      memberCount: 0,
      verifiedCount: 0,
      verificationRate: 0,
      averageKD: 0,
      averageTotalHours: 0,
      averageMissionsCompleted: 0,
      topPerformers: [],
      skillDistribution: {},
      careerBreakdown: [],
    };
  }
}

