"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const commandAnalytics_1 = require("../../bot/utils/commandAnalytics");
const data_source_1 = require("../../data-source");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const Mission_1 = require("../../models/Mission");
const Ticket_1 = require("../../models/Ticket");
const CrossSystemAnalyticsService_1 = require("../../services/analytics/CrossSystemAnalyticsService");
const TicketService_1 = require("../../services/communication/tickets/TicketService");
const PresenceTrackingService_1 = require("../../services/discord/PresenceTrackingService");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
let crossSystemService;
const getCrossSystemService = () => {
    if (!crossSystemService) {
        crossSystemService = new CrossSystemAnalyticsService_1.CrossSystemAnalyticsService();
    }
    return crossSystemService;
};
const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly']);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ANALYTICS_LOOKBACK_DAYS = 90;
const MAX_ANALYTICS_RANGE_DAYS = 366;
const parsePeriod = (rawPeriod = 'weekly') => VALID_PERIODS.has(rawPeriod) ? rawPeriod : null;
const readStringQueryParam = (rawValue) => typeof rawValue === 'string' ? rawValue : undefined;
const readBoundedIntegerQueryParam = (rawValue, defaultValue, minValue, maxValue) => {
    const stringValue = readStringQueryParam(rawValue);
    if (!stringValue) {
        return defaultValue;
    }
    const parsedValue = Number.parseInt(stringValue, 10);
    if (Number.isNaN(parsedValue)) {
        return defaultValue;
    }
    return Math.min(Math.max(parsedValue, minValue), maxValue);
};
const readPathParam = (req, paramName) => {
    const params = req.params;
    const rawValue = params[paramName];
    return typeof rawValue === 'string' && rawValue.trim().length > 0 ? rawValue : null;
};
const toError = (error) => error instanceof Error ? error : new Error(String(error));
const logRouteError = (message, error) => {
    logger_1.logger.error(message, { error: toError(error) });
};
const wrapAsyncRouteHandler = (handler) => (req, res) => {
    void handler(req, res);
};
const wrapPromiseMiddleware = (middleware) => (req, res, next) => {
    void Promise.resolve(middleware(req, res, next)).catch(next);
};
const safeAuthenticate = wrapPromiseMiddleware(auth_1.authenticate);
const safeGeneralRateLimiter = wrapPromiseMiddleware(rateLimiting_1.generalRateLimiter);
const parseDateQueryValue = (rawValue) => {
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
        return null;
    }
    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const resolveDateRange = (req, res) => {
    const hasStartDate = req.query.startDate !== undefined;
    const hasEndDate = req.query.endDate !== undefined;
    const startDate = parseDateQueryValue(req.query.startDate);
    if (hasStartDate && !startDate) {
        res.status(400).json({ error: 'Invalid startDate. Must be an ISO-8601 date string.' });
        return null;
    }
    const endDate = parseDateQueryValue(req.query.endDate);
    if (hasEndDate && !endDate) {
        res.status(400).json({ error: 'Invalid endDate. Must be an ISO-8601 date string.' });
        return null;
    }
    const effectiveStartDate = startDate ?? new Date(Date.now() - DEFAULT_ANALYTICS_LOOKBACK_DAYS * MILLISECONDS_PER_DAY);
    const effectiveEndDate = endDate ?? new Date();
    if (effectiveStartDate.getTime() > effectiveEndDate.getTime()) {
        res.status(400).json({ error: 'startDate must be before or equal to endDate.' });
        return null;
    }
    const rangeDays = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / MILLISECONDS_PER_DAY;
    if (rangeDays > MAX_ANALYTICS_RANGE_DAYS) {
        res.status(400).json({
            error: `Date range too large. Maximum supported range is ${MAX_ANALYTICS_RANGE_DAYS} days.`,
        });
        return null;
    }
    return {
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
    };
};
const resolveAuthorizedOrganizationId = (req, res) => {
    const currentOrganizationId = req.user?.currentOrganizationId;
    const requestedOrganizationId = readStringQueryParam(req.query.orgId);
    if (!currentOrganizationId && !requestedOrganizationId) {
        res.status(400).json({ error: 'Organization context required' });
        return null;
    }
    if (requestedOrganizationId &&
        currentOrganizationId &&
        requestedOrganizationId !== currentOrganizationId) {
        res.status(403).json({ error: 'Not authorized for this organization' });
        return null;
    }
    return requestedOrganizationId ?? currentOrganizationId ?? null;
};
router.get('/executive-overview', safeAuthenticate, safeGeneralRateLimiter, wrapAsyncRouteHandler(async (req, res) => {
    try {
        const organizationId = resolveAuthorizedOrganizationId(req, res);
        if (!organizationId) {
            return;
        }
        const period = parsePeriod(readStringQueryParam(req.query.period));
        if (!period) {
            res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
            return;
        }
        const missionRepo = data_source_1.AppDataSource.getRepository(Mission_1.Mission);
        const ticketRepo = data_source_1.AppDataSource.getRepository(Ticket_1.Ticket);
        const ticketService = TicketService_1.TicketService.getInstance();
        const missionStatusRows = await missionRepo
            .createQueryBuilder('mission')
            .select('mission.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('mission.organizationId = :organizationId', { organizationId })
            .andWhere('mission.deletedAt IS NULL')
            .groupBy('mission.status')
            .getRawMany();
        const missionBreakdown = {
            draft: 0,
            planned: 0,
            briefed: 0,
            inProgress: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
        };
        for (const row of missionStatusRows) {
            const count = Number.parseInt(row.count, 10);
            if (row.status === Mission_1.MissionStatus.DRAFT) {
                missionBreakdown.draft = count;
            }
            else if (row.status === Mission_1.MissionStatus.PLANNED) {
                missionBreakdown.planned = count;
            }
            else if (row.status === Mission_1.MissionStatus.BRIEFED) {
                missionBreakdown.briefed = count;
            }
            else if (row.status === Mission_1.MissionStatus.IN_PROGRESS) {
                missionBreakdown.inProgress = count;
            }
            else if (row.status === Mission_1.MissionStatus.COMPLETED) {
                missionBreakdown.completed = count;
            }
            else if (row.status === Mission_1.MissionStatus.FAILED) {
                missionBreakdown.failed = count;
            }
            else if (row.status === Mission_1.MissionStatus.CANCELLED) {
                missionBreakdown.cancelled = count;
            }
        }
        const disputesOpen = await ticketRepo
            .createQueryBuilder('ticket')
            .where('ticket.organizationId = :organizationId', { organizationId })
            .andWhere('ticket.category = :category', { category: Ticket_1.TicketCategory.SUPPORT })
            .andWhere('ticket.tags LIKE :disputeTag', { disputeTag: '%trade-dispute%' })
            .andWhere('ticket.status IN (:...openStatuses)', {
            openStatuses: [
                Ticket_1.TicketStatus.OPEN,
                Ticket_1.TicketStatus.IN_PROGRESS,
                Ticket_1.TicketStatus.AWAITING_RESPONSE,
            ],
        })
            .getCount();
        const disputesClosed = await ticketRepo
            .createQueryBuilder('ticket')
            .where('ticket.organizationId = :organizationId', { organizationId })
            .andWhere('ticket.category = :category', { category: Ticket_1.TicketCategory.SUPPORT })
            .andWhere('ticket.tags LIKE :disputeTag', { disputeTag: '%trade-dispute%' })
            .andWhere('ticket.status IN (:...closedStatuses)', {
            closedStatuses: [Ticket_1.TicketStatus.RESOLVED, Ticket_1.TicketStatus.CLOSED],
        })
            .getCount();
        const [ticketStats, crossSystem] = await Promise.all([
            ticketService.getTicketStats(organizationId),
            getCrossSystemService().getAnalytics(period, organizationId),
        ]);
        res.success({
            organizationId,
            period,
            generatedAt: new Date().toISOString(),
            operations: {
                missions: missionBreakdown,
                activeMissionCount: missionBreakdown.planned + missionBreakdown.briefed + missionBreakdown.inProgress,
            },
            support: {
                tickets: ticketStats,
                disputes: {
                    open: disputesOpen,
                    closed: disputesClosed,
                    total: disputesOpen + disputesClosed,
                },
            },
            trade: {
                topReputation: [],
            },
            participation: crossSystem,
        });
    }
    catch (error) {
        logRouteError('Failed to get executive overview analytics', error);
        res.status(500).json({ error: 'Failed to get executive overview analytics' });
    }
}));
router.get('/cross-system', safeAuthenticate, safeGeneralRateLimiter, wrapAsyncRouteHandler(async (req, res) => {
    try {
        const period = parsePeriod(readStringQueryParam(req.query.period));
        if (!period) {
            res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
            return;
        }
        const orgId = resolveAuthorizedOrganizationId(req, res);
        if (!orgId) {
            return;
        }
        const dateRange = resolveDateRange(req, res);
        if (!dateRange) {
            return;
        }
        const { startDate, endDate } = dateRange;
        const analytics = await getCrossSystemService().getAnalytics(period, orgId, startDate, endDate);
        res.success(analytics);
    }
    catch (error) {
        logRouteError('Failed to get cross-system analytics', error);
        res.status(500).json({ error: 'Failed to get cross-system analytics' });
    }
}));
router.get('/cross-system/crew-formation', safeAuthenticate, safeGeneralRateLimiter, wrapAsyncRouteHandler(async (req, res) => {
    try {
        const period = parsePeriod(readStringQueryParam(req.query.period));
        if (!period) {
            res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
            return;
        }
        const orgId = resolveAuthorizedOrganizationId(req, res);
        if (!orgId) {
            return;
        }
        const dateRange = resolveDateRange(req, res);
        if (!dateRange) {
            return;
        }
        const { startDate, endDate } = dateRange;
        const data = await getCrossSystemService().getCrewFormationTrends(period, orgId, startDate, endDate);
        res.success(data);
    }
    catch (error) {
        logRouteError('Failed to get crew formation trends', error);
        res.status(500).json({ error: 'Failed to get crew formation trends' });
    }
}));
router.get('/cross-system/formation-speed', safeAuthenticate, safeGeneralRateLimiter, wrapAsyncRouteHandler(async (req, res) => {
    try {
        const orgId = resolveAuthorizedOrganizationId(req, res);
        if (!orgId) {
            return;
        }
        const dateRange = resolveDateRange(req, res);
        if (!dateRange) {
            return;
        }
        const { startDate, endDate } = dateRange;
        const data = await getCrossSystemService().getFormationSpeedStats(orgId, startDate, endDate);
        res.success(data);
    }
    catch (error) {
        logRouteError('Failed to get formation speed stats', error);
        res.status(500).json({ error: 'Failed to get formation speed stats' });
    }
}));
router.get('/cross-system/job-placement', safeAuthenticate, safeGeneralRateLimiter, wrapAsyncRouteHandler(async (req, res) => {
    try {
        const period = parsePeriod(readStringQueryParam(req.query.period));
        if (!period) {
            res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
            return;
        }
        const orgId = resolveAuthorizedOrganizationId(req, res);
        if (!orgId) {
            return;
        }
        const dateRange = resolveDateRange(req, res);
        if (!dateRange) {
            return;
        }
        const { startDate, endDate } = dateRange;
        const data = await getCrossSystemService().getJobPlacementMetrics(orgId, startDate, endDate, period);
        res.success(data);
    }
    catch (error) {
        logRouteError('Failed to get job placement metrics', error);
        res.status(500).json({ error: 'Failed to get job placement metrics' });
    }
}));
router.get('/cross-system/lfg-conversion', safeAuthenticate, safeGeneralRateLimiter, wrapAsyncRouteHandler(async (req, res) => {
    try {
        const period = parsePeriod(readStringQueryParam(req.query.period));
        if (!period) {
            res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
            return;
        }
        const orgId = resolveAuthorizedOrganizationId(req, res);
        if (!orgId) {
            return;
        }
        const dateRange = resolveDateRange(req, res);
        if (!dateRange) {
            return;
        }
        const { startDate, endDate } = dateRange;
        const data = await getCrossSystemService().getLfgConversionMetrics(orgId, startDate, endDate, period);
        res.success(data);
    }
    catch (error) {
        logRouteError('Failed to get LFG conversion metrics', error);
        res.status(500).json({ error: 'Failed to get LFG conversion metrics' });
    }
}));
router.get('/bot-stats/commands', safeAuthenticate, safeGeneralRateLimiter, (req, res) => {
    try {
        const guildId = readStringQueryParam(req.query.guildId);
        const analytics = commandAnalytics_1.CommandAnalytics.getInstance();
        if (guildId) {
            const guildStats = analytics.getGuildStats(guildId);
            res.success(guildStats);
        }
        else {
            const systemStats = analytics.getSystemStats();
            res.success(systemStats);
        }
    }
    catch (error) {
        logRouteError('Failed to get bot command stats', error);
        res.status(500).json({ error: 'Failed to get bot command stats' });
    }
});
router.get('/bot-stats/commands/all', safeAuthenticate, safeGeneralRateLimiter, (req, res) => {
    try {
        const analytics = commandAnalytics_1.CommandAnalytics.getInstance();
        const allStats = analytics.getAllCommandStats();
        res.success(allStats);
    }
    catch (error) {
        logRouteError('Failed to get all command stats', error);
        res.status(500).json({ error: 'Failed to get all command stats' });
    }
});
router.get('/bot-stats/presence/:guildId', safeAuthenticate, safeGeneralRateLimiter, (req, res) => {
    try {
        const guildId = readPathParam(req, 'guildId');
        if (!guildId) {
            res.status(400).json({ error: 'Invalid guildId parameter' });
            return;
        }
        const presenceService = PresenceTrackingService_1.PresenceTrackingService.getInstance();
        const gameStats = presenceService.getCurrentGameStats(guildId);
        res.success(gameStats);
    }
    catch (error) {
        logRouteError('Failed to get presence stats', error);
        res.status(500).json({ error: 'Failed to get presence stats' });
    }
});
router.get('/bot-stats/heatmap/:guildId', safeAuthenticate, safeGeneralRateLimiter, (req, res) => {
    try {
        const guildId = readPathParam(req, 'guildId');
        if (!guildId) {
            res.status(400).json({ error: 'Invalid guildId parameter' });
            return;
        }
        const days = readBoundedIntegerQueryParam(req.query.days, 7, 1, 30);
        const presenceService = PresenceTrackingService_1.PresenceTrackingService.getInstance();
        const heatmap = presenceService.getActivityHeatmap(guildId, days);
        res.success(heatmap);
    }
    catch (error) {
        logRouteError('Failed to get activity heatmap', error);
        res.status(500).json({ error: 'Failed to get activity heatmap' });
    }
});
router.get('/bot-stats/games/:guildId', safeAuthenticate, safeGeneralRateLimiter, (req, res) => {
    try {
        const guildId = readPathParam(req, 'guildId');
        if (!guildId) {
            res.status(400).json({ error: 'Invalid guildId parameter' });
            return;
        }
        const days = readBoundedIntegerQueryParam(req.query.days, 7, 1, 30);
        const presenceService = PresenceTrackingService_1.PresenceTrackingService.getInstance();
        const games = presenceService.getGamePresenceHistory(guildId, days);
        res.success(games);
    }
    catch (error) {
        logRouteError('Failed to get game presence history', error);
        res.status(500).json({ error: 'Failed to get game presence history' });
    }
});
//# sourceMappingURL=analytics.js.map