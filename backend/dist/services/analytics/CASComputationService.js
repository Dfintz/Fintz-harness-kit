"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASComputationService = void 0;
const data_source_1 = require("../../data-source");
const GuildOrganization_1 = require("../../models/GuildOrganization");
const MemberEngagement_1 = require("../../models/MemberEngagement");
const OrgActivityHeatmap_1 = require("../../models/OrgActivityHeatmap");
const OrgActivityScore_1 = require("../../models/OrgActivityScore");
const Organization_1 = require("../../models/Organization");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const CASConfig_1 = require("./CASConfig");
const CAS_CACHE_TTL = 20 * 60;
class CASComputationService {
    scoreRepo = data_source_1.AppDataSource.getRepository(OrgActivityScore_1.OrgActivityScore);
    heatmapRepo = data_source_1.AppDataSource.getRepository(OrgActivityHeatmap_1.OrgActivityHeatmap);
    engagementRepo = data_source_1.AppDataSource.getRepository(MemberEngagement_1.MemberEngagement);
    guildOrgRepo = data_source_1.AppDataSource.getRepository(GuildOrganization_1.GuildOrganization);
    orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    async computeScore(organizationId) {
        const config = await (0, CASConfig_1.loadCASConfig)(organizationId);
        const org = await this.orgRepo.findOne({
            where: { id: organizationId },
            select: ['id', 'totalMembers'],
        });
        const memberCount = org?.totalMembers ?? 0;
        if (memberCount === 0) {
            logger_1.logger.warn('[CAS] Zero members for organization', {
                organizationId,
                orgExists: !!org,
            });
            return this.persistScore(organizationId, 0, {
                onlinePresence: 0,
                engagement: 0,
                consistency: 0,
                voiceActivity: 0,
                siteActivity: 0,
            }, 0);
        }
        const guilds = await this.guildOrgRepo.find({
            where: { organizationId, isActive: true },
            select: ['guildId'],
        });
        const guildIds = guilds.map(g => g.guildId);
        const op = await this.computeOnlinePresence(guildIds, memberCount, config);
        const eng = await this.computeEngagement(organizationId, guildIds, memberCount, config);
        const cons = await this.computeConsistency(organizationId, guildIds, memberCount, config);
        const voice = await this.computeVoiceActivity(guildIds, memberCount, config, organizationId);
        const site = await this.computeSiteActivity(organizationId, memberCount, config);
        const { weights } = config;
        const score = Math.round((weights.onlinePresence * op +
            weights.engagement * eng +
            weights.consistency * cons +
            weights.voice * voice +
            weights.site * site) *
            10) / 10;
        const clampedScore = Math.max(0, Math.min(100, score));
        const breakdown = {
            onlinePresence: Math.round(op * 10) / 10,
            engagement: Math.round(eng * 10) / 10,
            consistency: Math.round(cons * 10) / 10,
            voiceActivity: Math.round(voice * 10) / 10,
            siteActivity: Math.round(site * 10) / 10,
        };
        const snapshot = await this.persistScore(organizationId, clampedScore, breakdown, memberCount);
        await this.sampleHeatmap(organizationId, guildIds, memberCount).catch(err => {
            logger_1.logger.warn('Heatmap sample failed (non-fatal)', { organizationId, error: String(err) });
        });
        return snapshot;
    }
    async computeOnlinePresence(guildIds, memberCount, config) {
        if (guildIds.length === 0) {
            return 0;
        }
        let totalOnline = 0;
        try {
            const { PresenceTrackingService } = await Promise.resolve().then(() => __importStar(require('../discord/PresenceTrackingService')));
            const presenceService = PresenceTrackingService.getInstance();
            for (const gid of guildIds) {
                const counts = presenceService.getStatusCounts(gid);
                totalOnline += (counts?.online ?? 0) + (counts?.idle ?? 0) + (counts?.dnd ?? 0);
            }
        }
        catch {
            return 0;
        }
        const ratio = totalOnline / (config.onlinePresenceTarget * memberCount);
        return 100 * Math.min(1, ratio);
    }
    async computeEngagement(organizationId, guildIds, memberCount, config) {
        if (guildIds.length === 0) {
            return 0;
        }
        const result = await this.engagementRepo
            .createQueryBuilder('me')
            .select('COALESCE(SUM(me."messageCount"), 0)', 'totalMessages')
            .addSelect('COALESCE(SUM(me."reactionsGiven"), 0)', 'totalReactions')
            .innerJoin(GuildOrganization_1.GuildOrganization, 'go', 'me."guildId" = go."guildId"')
            .where('go."organizationId" = :organizationId', { organizationId })
            .andWhere('me."guildId" IN (:...guildIds)', { guildIds })
            .andWhere('me.date = CURRENT_DATE')
            .getRawOne();
        const totalInteractions = Number(result?.totalMessages ?? 0) + Number(result?.totalReactions ?? 0);
        const perCapita = totalInteractions / memberCount;
        return 100 * Math.min(1, perCapita / config.engagementTarget);
    }
    async computeConsistency(organizationId, guildIds, memberCount, config) {
        if (guildIds.length === 0) {
            return 0;
        }
        const rows = await data_source_1.AppDataSource.query(`
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
    `, [organizationId]);
        let coreActive = 0;
        let returning = 0;
        for (const row of rows) {
            const days = Number(row.activity_days);
            const count = Number(row.user_count);
            if (days >= 3) {
                coreActive += count;
            }
            else {
                returning += count;
            }
        }
        const consistencyPerCapita = (0.6 * coreActive + 0.3 * returning) / memberCount;
        return 100 * Math.min(1, consistencyPerCapita / config.consistencyTarget);
    }
    async computeVoiceActivity(guildIds, memberCount, config, organizationId) {
        let totalVoice = 0;
        if (guildIds.length > 0) {
            const result = await this.engagementRepo
                .createQueryBuilder('me')
                .select('COALESCE(SUM(me."voiceMinutes"), 0)', 'totalVoice')
                .innerJoin(GuildOrganization_1.GuildOrganization, 'go', 'me."guildId" = go."guildId"')
                .where('me."guildId" IN (:...guildIds)', { guildIds })
                .andWhere("me.date >= CURRENT_DATE - INTERVAL '7 days'")
                .getRawOne();
            totalVoice = Number(result?.totalVoice ?? 0);
        }
        if (organizationId) {
            try {
                const { VoiceServerService } = await Promise.resolve().then(() => __importStar(require('../communication/voice/VoiceServerService')));
                const mumbleMinutes = await VoiceServerService.getInstance().getMumbleVoiceMinutes(organizationId);
                totalVoice += mumbleMinutes;
            }
            catch {
            }
        }
        const perCapita = totalVoice / memberCount;
        return 100 * Math.min(1, perCapita / config.voiceTarget);
    }
    async computeSiteActivity(organizationId, memberCount, config) {
        const result = await data_source_1.AppDataSource.query(`
      SELECT COUNT(*)::int as active_users
      FROM users u
      INNER JOIN organization_memberships om ON u.id = om."userId"
      WHERE om."organizationId" = $1
        AND om."isActive" = true
        AND u."lastActiveAt" >= NOW() - INTERVAL '24 hours'
    `, [organizationId]);
        const activeUsers = Number(result?.[0]?.active_users ?? 0);
        const perCapita = activeUsers / memberCount;
        return 100 * Math.min(1, perCapita / config.siteActivityTarget);
    }
    async persistScore(organizationId, score, breakdown, memberCount) {
        const tier = (0, CASConfig_1.scoreToCasTier)(score);
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
        const cachePayload = {
            organizationId,
            score,
            tier,
            breakdown,
            memberCount,
            computedAt: now.toISOString(),
        };
        await redis_1.cache
            .set(`org:${organizationId}:cas:latest`, cachePayload, CAS_CACHE_TTL)
            .catch(() => { });
        const previousCache = await redis_1.cache.get(`org:${organizationId}:cas:previous`);
        const isFirstComputation = !previousCache;
        const previousScore = previousCache?.score ?? score;
        const previousTier = previousCache?.tier ?? tier;
        if (isFirstComputation || Math.abs(score - previousScore) >= 1 || tier !== previousTier) {
            DomainEventBus_1.domainEvents.emit('analytics:cas_updated', {
                organizationId,
                score,
                previousScore,
                tier,
                previousTier,
                breakdown: { ...breakdown },
                computedAt: now.toISOString(),
            });
        }
        await redis_1.cache
            .set(`org:${organizationId}:cas:previous`, { score, tier }, CAS_CACHE_TTL * 2)
            .catch(() => { });
        logger_1.logger.debug('CAS score computed', { organizationId, score, tier });
        return snapshot;
    }
    async sampleHeatmap(organizationId, guildIds, memberCount) {
        const now = new Date();
        const dayOfWeek = now.getUTCDay();
        const hour = now.getUTCHours();
        let presenceCount = 0;
        try {
            const { PresenceTrackingService } = await Promise.resolve().then(() => __importStar(require('../discord/PresenceTrackingService')));
            const presenceService = PresenceTrackingService.getInstance();
            for (const gid of guildIds) {
                const counts = presenceService.getStatusCounts(gid);
                presenceCount += (counts?.online ?? 0) + (counts?.idle ?? 0) + (counts?.dnd ?? 0);
            }
        }
        catch {
        }
        const siteResult = await data_source_1.AppDataSource.query(`
      SELECT COUNT(DISTINCT u.id)::int as site_active
      FROM users u
      INNER JOIN organization_memberships om ON u.id = om."userId"
      WHERE om."organizationId" = $1
        AND om."isActive" = true
        AND u."lastActiveAt" >= NOW() - INTERVAL '1 hour'
    `, [organizationId]);
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
exports.CASComputationService = CASComputationService;
//# sourceMappingURL=CASComputationService.js.map