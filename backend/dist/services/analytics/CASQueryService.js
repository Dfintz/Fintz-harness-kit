"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASQueryService = void 0;
const data_source_1 = require("../../data-source");
const OrgActivityHeatmap_1 = require("../../models/OrgActivityHeatmap");
const OrgActivityScore_1 = require("../../models/OrgActivityScore");
const redis_1 = require("../../utils/redis");
const CAS_CACHE_TTL = 20 * 60;
class CASQueryService {
    scoreRepo = data_source_1.AppDataSource.getRepository(OrgActivityScore_1.OrgActivityScore);
    heatmapRepo = data_source_1.AppDataSource.getRepository(OrgActivityHeatmap_1.OrgActivityHeatmap);
    async getCurrentScore(organizationId) {
        const cached = await redis_1.cache
            .get(`org:${organizationId}:cas:latest`)
            .catch(() => null);
        if (cached) {
            return cached;
        }
        const latest = await this.scoreRepo.findOne({
            where: { organizationId },
            order: { computedAt: 'DESC' },
        });
        if (!latest) {
            return null;
        }
        const result = {
            organizationId,
            score: Number(latest.score),
            tier: latest.tier,
            breakdown: latest.breakdown,
            memberCount: latest.memberCount,
            computedAt: latest.computedAt.toISOString(),
        };
        await redis_1.cache.set(`org:${organizationId}:cas:latest`, result, CAS_CACHE_TTL).catch(() => { });
        return result;
    }
    async getScoreHistory(organizationId, days = 30) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        if (days <= 7) {
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
        const rows = await data_source_1.AppDataSource.query(`
      SELECT DISTINCT ON (DATE("computedAt"))
        score, tier, "computedAt"
      FROM org_activity_scores
      WHERE "organizationId" = $1
        AND "computedAt" >= $2
      ORDER BY DATE("computedAt"), "computedAt" DESC
    `, [organizationId, since]);
        return rows.map(r => ({
            score: Number(r.score),
            tier: r.tier,
            computedAt: new Date(r.computedAt).toISOString(),
        }));
    }
    async getScoreBreakdown(organizationId) {
        const score = await this.getCurrentScore(organizationId);
        return score?.breakdown ?? null;
    }
    async getOrgRanking(limit = 20) {
        const safeLimit = Math.max(1, Math.min(100, limit));
        const rows = await data_source_1.AppDataSource.query(`
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
    `, [safeLimit]);
        return rows.map(r => ({
            organizationId: r.organizationId,
            organizationName: r.organizationName,
            score: Number(r.score),
            tier: r.tier,
            memberCount: Number(r.memberCount),
        }));
    }
    async getHeatmap(organizationId, days = 7, logScale = true) {
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
        const cellMap = new Map();
        for (const row of rows) {
            cellMap.set(`${row.dayOfWeek}-${row.hour}`, {
                avgPresence: Number(row.avgPresence ?? 0),
                avgSiteActive: Number(row.avgSiteActive ?? 0),
                avgMembers: Number(row.avgMembers ?? 1),
            });
        }
        const rawCells = [];
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
        let processedValues = rawCells.map(c => c.rawPerCapita);
        if (logScale) {
            processedValues = processedValues.map(v => Math.log(1 + v));
        }
        const minVal = Math.min(...processedValues);
        const maxVal = Math.max(...processedValues);
        const range = maxVal - minVal + 0.001;
        const cells = rawCells.map((c, i) => ({
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
exports.CASQueryService = CASQueryService;
//# sourceMappingURL=CASQueryService.js.map