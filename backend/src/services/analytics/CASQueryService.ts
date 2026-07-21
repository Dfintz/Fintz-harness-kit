/**
 * CASQueryService — Read path for CAS scores with Redis caching.
 *
 * Provides: getCurrentScore, getScoreHistory, getScoreBreakdown,
 * getOrgRanking, getHeatmap.
 */

import type {
    CASBreakdown,
    CASHeatmapCell,
    CASHeatmapResponse,
    CASHistoryPoint,
    CASRankingEntry,
    CASScoreResult,
} from '@sc-fleet-manager/shared-types';

import { AppDataSource } from '../../data-source';
import { OrgActivityHeatmap } from '../../models/OrgActivityHeatmap';
import { OrgActivityScore } from '../../models/OrgActivityScore';
import { cache } from '../../utils/redis';

const CAS_CACHE_TTL = 20 * 60; // 20 minutes

export class CASQueryService {
  private readonly scoreRepo = AppDataSource.getRepository(OrgActivityScore);
  private readonly heatmapRepo = AppDataSource.getRepository(OrgActivityHeatmap);

  /**
   * Get current CAS score. Redis first, DB fallback.
   */
  async getCurrentScore(organizationId: string): Promise<CASScoreResult | null> {
    // Try cache
    const cached = await cache
      .get<CASScoreResult>(`org:${organizationId}:cas:latest`)
      .catch(() => null);
    if (cached) {
      return cached;
    }

    // DB fallback — latest snapshot
    const latest = await this.scoreRepo.findOne({
      where: { organizationId },
      order: { computedAt: 'DESC' },
    });

    if (!latest) {
      return null;
    }

    const result: CASScoreResult = {
      organizationId,
      score: Number(latest.score),
      tier: latest.tier,
      breakdown: latest.breakdown,
      memberCount: latest.memberCount,
      computedAt: latest.computedAt.toISOString(),
    };

    // Warm cache
    await cache.set(`org:${organizationId}:cas:latest`, result, CAS_CACHE_TTL).catch(() => {});

    return result;
  }

  /**
   * Get CAS score history for trend charts.
   * Supports downsampling: hourly for <7d, daily for >7d.
   */
  async getScoreHistory(organizationId: string, days: number = 30): Promise<CASHistoryPoint[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (days <= 7) {
      // Hourly resolution — return all snapshots
      const scores = await this.scoreRepo
        .createQueryBuilder('s')
        .select(['s.score', 's.tier', 's.computedAt'])
        .where('s."organizationId" = :organizationId', { organizationId })
        .andWhere('s."computedAt" >= :since', { since })
        .orderBy('s."computedAt"', 'ASC')
        .getMany();

      return scores.map(s => ({
        score: Number(s.score),
        tier: s.tier,
        computedAt: s.computedAt.toISOString(),
      }));
    }

    // Daily resolution — one point per day (latest per day)
    const rows = await AppDataSource.query(
      `
      SELECT DISTINCT ON (DATE("computedAt"))
        score, tier, "computedAt"
      FROM org_activity_scores
      WHERE "organizationId" = $1
        AND "computedAt" >= $2
      ORDER BY DATE("computedAt"), "computedAt" DESC
    `,
      [organizationId, since]
    );

    return (rows as Array<{ score: number; tier: string; computedAt: Date }>).map(r => ({
      score: Number(r.score),
      tier: r.tier as CASHistoryPoint['tier'],
      computedAt: new Date(r.computedAt).toISOString(),
    }));
  }

  /**
   * Get detailed CAS breakdown for current score.
   */
  async getScoreBreakdown(organizationId: string): Promise<CASBreakdown | null> {
    const score = await this.getCurrentScore(organizationId);
    return score?.breakdown ?? null;
  }

  /**
   * Get organization ranking by CAS score.
   */
  async getOrgRanking(limit: number = 20): Promise<CASRankingEntry[]> {
    const safeLimit = Math.max(1, Math.min(100, limit));

    // Get latest score per org and order in SQL for better scalability.
    const rows = await AppDataSource.query(
      `
      WITH latest_scores AS (
        SELECT
          s."organizationId",
          s.score,
          s.tier,
          s."memberCount",
          ROW_NUMBER() OVER (
            PARTITION BY s."organizationId"
            ORDER BY s."computedAt" DESC
          ) AS rn
        FROM org_activity_scores s
        WHERE s."computedAt" >= NOW() - INTERVAL '1 hour'
      )
      SELECT
        ls."organizationId",
        ls.score,
        ls.tier,
        ls."memberCount",
        o.name AS "organizationName"
      FROM latest_scores ls
      INNER JOIN organizations o ON ls."organizationId" = o.id
      WHERE ls.rn = 1
      ORDER BY ls.score DESC
      LIMIT $1
    `,
      [safeLimit]
    );

    return (rows as Array<Record<string, unknown>>).map(r => ({
      organizationId: r.organizationId as string,
      organizationName: r.organizationName as string,
      score: Number(r.score),
      tier: r.tier as CASRankingEntry['tier'],
      memberCount: Number(r.memberCount),
    }));
  }

  /**
   * Get 7x24 activity heatmap averaged over N days.
   */
  async getHeatmap(
    organizationId: string,
    days: number = 7,
    logScale: boolean = true
  ): Promise<CASHeatmapResponse> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await this.heatmapRepo
      .createQueryBuilder('h')
      .select('h."dayOfWeek"', 'dayOfWeek')
      .addSelect('h.hour', 'hour')
      .addSelect('AVG(h."presenceCount")', 'avgPresence')
      .addSelect('AVG(h."siteActiveCount")', 'avgSiteActive')
      .addSelect('AVG(h."memberCount")', 'avgMembers')
      .where('h."organizationId" = :organizationId', { organizationId })
      .andWhere('h."sampledAt" >= :since', { since })
      .groupBy('h."dayOfWeek"')
      .addGroupBy('h.hour')
      .orderBy('h."dayOfWeek"')
      .addOrderBy('h.hour')
      .getRawMany();

    // Build 168-cell grid
    const cellMap = new Map<
      string,
      { avgPresence: number; avgSiteActive: number; avgMembers: number }
    >();
    for (const row of rows) {
      cellMap.set(`${row.dayOfWeek}-${row.hour}`, {
        avgPresence: Number(row.avgPresence ?? 0),
        avgSiteActive: Number(row.avgSiteActive ?? 0),
        avgMembers: Number(row.avgMembers ?? 1),
      });
    }

    // Compute raw per-capita scores
    const rawCells: Array<{
      dayOfWeek: number;
      hour: number;
      rawPerCapita: number;
      avgPresence: number;
      avgSiteActive: number;
    }> = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const data = cellMap.get(`${d}-${h}`);
        const avgPresence = data?.avgPresence ?? 0;
        const avgSiteActive = data?.avgSiteActive ?? 0;
        const members = data?.avgMembers ?? 1;
        const rawScore = avgPresence + 2 * avgSiteActive;
        const rawPerCapita = (rawScore / members) * 100;
        rawCells.push({ dayOfWeek: d, hour: h, rawPerCapita, avgPresence, avgSiteActive });
      }
    }

    // Apply log scaling if enabled
    let processedValues = rawCells.map(c => c.rawPerCapita);
    if (logScale) {
      processedValues = processedValues.map(v => Math.log(1 + v));
    }

    // Normalize to [0, 1]
    const minVal = Math.min(...processedValues);
    const maxVal = Math.max(...processedValues);
    const range = maxVal - minVal + 0.001;

    const cells: CASHeatmapCell[] = rawCells.map((c, i) => ({
      dayOfWeek: c.dayOfWeek,
      hour: c.hour,
      intensity: (processedValues[i] - minVal) / range,
      rawPerCapita: Math.round(c.rawPerCapita * 100) / 100,
      avgPresence: Math.round(c.avgPresence * 10) / 10,
      avgSiteActive: Math.round(c.avgSiteActive * 10) / 10,
    }));

    const maxRawPerCapita = Math.max(...rawCells.map(c => c.rawPerCapita), 0);
    const latestScore = await this.scoreRepo.findOne({
      where: { organizationId },
      select: ['memberCount'],
      order: { computedAt: 'DESC' },
    });

    return {
      organizationId,
      memberCount: latestScore?.memberCount ?? 0,
      cells,
      logScale,
      days,
      maxRawPerCapita: Math.round(maxRawPerCapita * 100) / 100,
      generatedAt: new Date().toISOString(),
    };
  }
}

