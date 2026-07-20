"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlacklistAnalyticsService = exports.REPEAT_OFFENDER_THRESHOLDS = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const MirrorAction_1 = require("../../models/MirrorAction");
const ModerationIncident_1 = require("../../models/ModerationIncident");
const logger_1 = require("../../utils/logger");
const TenantService_1 = require("../base/TenantService");
exports.REPEAT_OFFENDER_THRESHOLDS = {
    minIncidents: Number(process.env.REPEAT_OFFENDER_MIN_INCIDENTS ?? 3),
    windowDays: Number(process.env.REPEAT_OFFENDER_WINDOW_DAYS ?? 90),
    minSeverity: Number(process.env.REPEAT_OFFENDER_MIN_SEVERITY ?? ModerationIncident_1.IncidentSeverity.TIMEOUT),
    highRiskThreshold: Number(process.env.REPEAT_OFFENDER_HIGH_RISK_THRESHOLD ?? 70),
};
class BlacklistAnalyticsService extends TenantService_1.TenantService {
    static instance = null;
    _mirrorRepository;
    get mirrorRepository() {
        this._mirrorRepository ??= data_source_1.AppDataSource.getRepository(MirrorAction_1.MirrorAction);
        return this._mirrorRepository;
    }
    constructor() {
        super(data_source_1.AppDataSource.getRepository(ModerationIncident_1.ModerationIncident), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
    }
    static getInstance() {
        BlacklistAnalyticsService.instance ??= new BlacklistAnalyticsService();
        return BlacklistAnalyticsService.instance;
    }
    async getAnalytics(organizationId) {
        try {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            const incidents = await this.findAll(organizationId);
            const activeIncidents = incidents.filter(i => i.status === ModerationIncident_1.IncidentStatus.ACTIVE);
            const resolvedIncidents = incidents.filter(i => i.status === ModerationIncident_1.IncidentStatus.REVOKED || i.status === ModerationIncident_1.IncidentStatus.EXPIRED);
            const sharedIncidents = incidents.filter(i => i.isShared);
            const autoDetectedIncidents = incidents.filter(i => i.isAutoDetected);
            const incidentsLast24Hours = incidents.filter(i => i.createdAt >= oneDayAgo).length;
            const incidentsLast7Days = incidents.filter(i => i.createdAt >= sevenDaysAgo).length;
            const incidentsLast30Days = incidents.filter(i => i.createdAt >= thirtyDaysAgo).length;
            const byType = this.initializeByType();
            const bySeverity = this.initializeBySeverity();
            const byStatus = this.initializeByStatus();
            const uniqueTargets = new Set();
            const uniqueModerators = new Set();
            let totalSeverity = 0;
            for (const incident of incidents) {
                byType[incident.incidentType]++;
                bySeverity[incident.severity]++;
                byStatus[incident.status]++;
                uniqueTargets.add(incident.targetDiscordId);
                uniqueModerators.add(incident.moderatorId);
                totalSeverity += incident.severity;
            }
            const dailyTrend = await this.calculateDailyTrend(organizationId, sevenDaysAgo);
            const weeklyTrend = await this.calculateWeeklyTrend(organizationId, thirtyDaysAgo);
            const monthlyTrend = await this.calculateMonthlyTrend(organizationId, ninetyDaysAgo);
            const repeatOffenders = await this.getRepeatOffenders(organizationId);
            const mirrorStats = await this.getMirrorStatistics(organizationId);
            logger_1.logger.info(`Analytics generated for org: ${organizationId}`, {
                totalIncidents: incidents.length,
                activeIncidents: activeIncidents.length,
                repeatOffenderCount: repeatOffenders.length,
            });
            return {
                totalIncidents: incidents.length,
                activeIncidents: activeIncidents.length,
                resolvedIncidents: resolvedIncidents.length,
                sharedIncidents: sharedIncidents.length,
                autoDetectedIncidents: autoDetectedIncidents.length,
                byType,
                bySeverity,
                byStatus,
                dailyTrend,
                weeklyTrend,
                monthlyTrend,
                uniqueTargets: uniqueTargets.size,
                uniqueModerators: uniqueModerators.size,
                averageSeverity: incidents.length > 0 ? totalSeverity / incidents.length : 0,
                repeatOffenders,
                repeatOffenderCount: repeatOffenders.length,
                mirrorStats,
                incidentsLast24Hours,
                incidentsLast7Days,
                incidentsLast30Days,
                generatedAt: now,
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to generate moderation analytics, returning empty analytics', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return this.emptyAnalytics();
        }
    }
    emptyAnalytics() {
        return {
            totalIncidents: 0,
            activeIncidents: 0,
            resolvedIncidents: 0,
            sharedIncidents: 0,
            autoDetectedIncidents: 0,
            byType: this.initializeByType(),
            bySeverity: this.initializeBySeverity(),
            byStatus: this.initializeByStatus(),
            dailyTrend: [],
            weeklyTrend: [],
            monthlyTrend: [],
            uniqueTargets: 0,
            uniqueModerators: 0,
            averageSeverity: 0,
            repeatOffenders: [],
            repeatOffenderCount: 0,
            mirrorStats: {
                totalMirrors: 0,
                confirmedMirrors: 0,
                pendingMirrors: 0,
                cancelledMirrors: 0,
                failedMirrors: 0,
            },
            incidentsLast24Hours: 0,
            incidentsLast7Days: 0,
            incidentsLast30Days: 0,
            generatedAt: new Date(),
        };
    }
    analyzeTargetIncidents(targetDiscordId, targetIncidents) {
        const byType = this.initializeByType();
        let highestSeverity = ModerationIncident_1.IncidentSeverity.WARNING;
        let activeCount = 0;
        for (const incident of targetIncidents) {
            byType[incident.incidentType]++;
            if (incident.severity > highestSeverity) {
                highestSeverity = incident.severity;
            }
            if (incident.status === ModerationIncident_1.IncidentStatus.ACTIVE) {
                activeCount++;
            }
        }
        const riskScore = this.calculateRiskScore(targetIncidents, highestSeverity);
        return {
            targetDiscordId,
            targetUsername: targetIncidents[0].targetUsername,
            totalIncidents: targetIncidents.length,
            activeIncidents: activeCount,
            highestSeverity,
            firstIncident: targetIncidents.at(-1)?.createdAt ?? targetIncidents[0].createdAt,
            lastIncident: targetIncidents[0].createdAt,
            incidentsByType: byType,
            riskScore,
            isHighRisk: riskScore >= exports.REPEAT_OFFENDER_THRESHOLDS.highRiskThreshold,
        };
    }
    async getRepeatOffenders(organizationId) {
        try {
            const windowStart = new Date(Date.now() - exports.REPEAT_OFFENDER_THRESHOLDS.windowDays * 24 * 60 * 60 * 1000);
            const incidents = await this.repository.find({
                where: {
                    organizationId,
                    createdAt: (0, typeorm_1.MoreThan)(windowStart),
                    severity: (0, typeorm_1.MoreThan)(exports.REPEAT_OFFENDER_THRESHOLDS.minSeverity - 1),
                },
                order: { createdAt: 'DESC' },
            });
            const incidentsByTarget = new Map();
            for (const incident of incidents) {
                const existing = incidentsByTarget.get(incident.targetDiscordId) ?? [];
                existing.push(incident);
                incidentsByTarget.set(incident.targetDiscordId, existing);
            }
            const repeatOffenders = [];
            for (const [targetDiscordId, targetIncidents] of incidentsByTarget) {
                if (targetIncidents.length >= exports.REPEAT_OFFENDER_THRESHOLDS.minIncidents) {
                    repeatOffenders.push(this.analyzeTargetIncidents(targetDiscordId, targetIncidents));
                }
            }
            repeatOffenders.sort((a, b) => b.riskScore - a.riskScore);
            return repeatOffenders;
        }
        catch (error) {
            logger_1.logger.warn('Failed to load repeat offenders, returning empty list', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async isRepeatOffender(organizationId, targetDiscordId) {
        const repeatOffenders = await this.getRepeatOffenders(organizationId);
        const found = repeatOffenders.find(ro => ro.targetDiscordId === targetDiscordId);
        return {
            isRepeatOffender: !!found,
            details: found,
        };
    }
    calculateRiskScore(incidents, highestSeverity) {
        let score = 0;
        const countScore = Math.min(incidents.length * 5, 30);
        score += countScore;
        score += highestSeverity * 6;
        const now = new Date();
        const recentIncidents = incidents.filter(i => {
            const daysSince = (now.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return daysSince <= 7;
        });
        score += Math.min(recentIncidents.length * 5, 20);
        const activeIncidents = incidents.filter(i => i.status === ModerationIncident_1.IncidentStatus.ACTIVE);
        score += Math.min(activeIncidents.length * 5, 20);
        return Math.min(score, 100);
    }
    async calculateDailyTrend(organizationId, startDate) {
        const incidents = await this.repository.find({
            where: {
                organizationId,
                createdAt: (0, typeorm_1.MoreThan)(startDate),
            },
            order: { createdAt: 'ASC' },
        });
        const trendMap = new Map();
        const now = new Date();
        for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            trendMap.set(dateStr, 0);
        }
        for (const incident of incidents) {
            const dateStr = incident.createdAt.toISOString().split('T')[0];
            trendMap.set(dateStr, (trendMap.get(dateStr) ?? 0) + 1);
        }
        return Array.from(trendMap.entries()).map(([date, count]) => ({
            date,
            count,
            label: new Date(date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            }),
        }));
    }
    async calculateWeeklyTrend(organizationId, startDate) {
        const incidents = await this.repository.find({
            where: {
                organizationId,
                createdAt: (0, typeorm_1.MoreThan)(startDate),
            },
            order: { createdAt: 'ASC' },
        });
        const trendMap = new Map();
        for (const incident of incidents) {
            const weekStart = this.getWeekStart(incident.createdAt);
            const weekStr = weekStart.toISOString().split('T')[0];
            trendMap.set(weekStr, (trendMap.get(weekStr) ?? 0) + 1);
        }
        return Array.from(trendMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({
            date,
            count,
            label: `Week of ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        }));
    }
    async calculateMonthlyTrend(organizationId, startDate) {
        const incidents = await this.repository.find({
            where: {
                organizationId,
                createdAt: (0, typeorm_1.MoreThan)(startDate),
            },
            order: { createdAt: 'ASC' },
        });
        const trendMap = new Map();
        for (const incident of incidents) {
            const monthStr = `${incident.createdAt.getFullYear()}-${String(incident.createdAt.getMonth() + 1).padStart(2, '0')}`;
            trendMap.set(monthStr, (trendMap.get(monthStr) ?? 0) + 1);
        }
        return Array.from(trendMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => {
            const [year, month] = date.split('-');
            return {
                date,
                count,
                label: new Date(Number.parseInt(year), Number.parseInt(month) - 1).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                }),
            };
        });
    }
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    async getMirrorStatistics(organizationId) {
        const mirrors = await this.mirrorRepository.find({
            where: { organizationId },
        });
        return {
            totalMirrors: mirrors.length,
            confirmedMirrors: mirrors.filter(m => m.status === MirrorAction_1.MirrorActionStatus.CONFIRMED).length,
            pendingMirrors: mirrors.filter(m => m.status === MirrorAction_1.MirrorActionStatus.PENDING).length,
            cancelledMirrors: mirrors.filter(m => m.status === MirrorAction_1.MirrorActionStatus.CANCELLED).length,
            failedMirrors: mirrors.filter(m => m.status === MirrorAction_1.MirrorActionStatus.FAILED).length,
        };
    }
    initializeByType() {
        return {
            [ModerationIncident_1.IncidentType.WARNING]: 0,
            [ModerationIncident_1.IncidentType.TIMEOUT]: 0,
            [ModerationIncident_1.IncidentType.LONG_TIMEOUT]: 0,
            [ModerationIncident_1.IncidentType.KICK]: 0,
            [ModerationIncident_1.IncidentType.BAN]: 0,
        };
    }
    initializeBySeverity() {
        return {
            [ModerationIncident_1.IncidentSeverity.WARNING]: 0,
            [ModerationIncident_1.IncidentSeverity.TIMEOUT]: 0,
            [ModerationIncident_1.IncidentSeverity.LONG_TIMEOUT]: 0,
            [ModerationIncident_1.IncidentSeverity.KICK]: 0,
            [ModerationIncident_1.IncidentSeverity.BAN]: 0,
        };
    }
    initializeByStatus() {
        return {
            [ModerationIncident_1.IncidentStatus.ACTIVE]: 0,
            [ModerationIncident_1.IncidentStatus.EXPIRED]: 0,
            [ModerationIncident_1.IncidentStatus.REVOKED]: 0,
        };
    }
}
exports.BlacklistAnalyticsService = BlacklistAnalyticsService;
//# sourceMappingURL=BlacklistAnalyticsService.js.map