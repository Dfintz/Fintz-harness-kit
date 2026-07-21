import { NextFunction, Request, Response, Router } from 'express';

import { CommandAnalytics } from '../../bot/utils/commandAnalytics';
import { AppDataSource } from '../../data-source';
import { authenticate } from '../../middleware/auth';
import { generalRateLimiter } from '../../middleware/rateLimiting';
import { Mission, MissionStatus } from '../../models/Mission';
import { Ticket, TicketCategory, TicketStatus } from '../../models/Ticket';
import { CrossSystemAnalyticsService } from '../../services/analytics/CrossSystemAnalyticsService';
import { TicketService } from '../../services/communication/tickets/TicketService';
import { PresenceTrackingService } from '../../services/discord/PresenceTrackingService';
import { logger } from '../../utils/logger';

const router = Router();

// Lazy init
let crossSystemService: CrossSystemAnalyticsService;
const getCrossSystemService = () => {
  if (!crossSystemService) {
    crossSystemService = new CrossSystemAnalyticsService();
  }
  return crossSystemService;
};

type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';
type AnalyticsAuthRequest = Request & {
  user?: {
    currentOrganizationId?: string;
  };
};

const VALID_PERIODS = new Set<AnalyticsPeriod>(['daily', 'weekly', 'monthly']);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ANALYTICS_LOOKBACK_DAYS = 90;
const MAX_ANALYTICS_RANGE_DAYS = 366;

const parsePeriod = (rawPeriod: string = 'weekly'): AnalyticsPeriod | null =>
  VALID_PERIODS.has(rawPeriod as AnalyticsPeriod) ? (rawPeriod as AnalyticsPeriod) : null;

const readStringQueryParam = (rawValue: unknown): string | undefined =>
  typeof rawValue === 'string' ? rawValue : undefined;

const readBoundedIntegerQueryParam = (
  rawValue: unknown,
  defaultValue: number,
  minValue: number,
  maxValue: number
): number => {
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

const readPathParam = (req: Request, paramName: string): string | null => {
  const params = req.params as Record<string, unknown>;
  const rawValue = params[paramName];
  return typeof rawValue === 'string' && rawValue.trim().length > 0 ? rawValue : null;
};

type AsyncRouteHandler = (req: Request, res: Response) => Promise<void>;
type PromiseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | void;

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const logRouteError = (message: string, error: unknown): void => {
  logger.error(message, { error: toError(error) });
};

const wrapAsyncRouteHandler =
  (handler: AsyncRouteHandler) =>
  (req: Request, res: Response): void => {
    void handler(req, res);
  };

const wrapPromiseMiddleware =
  (middleware: PromiseMiddleware) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(middleware(req, res, next)).catch(next);
  };

const safeAuthenticate = wrapPromiseMiddleware(authenticate);
const safeGeneralRateLimiter = wrapPromiseMiddleware(generalRateLimiter);

const parseDateQueryValue = (rawValue: unknown): Date | null => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return null;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveDateRange = (
  req: Request,
  res: Response
): { startDate?: Date; endDate?: Date } | null => {
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

  const effectiveStartDate =
    startDate ?? new Date(Date.now() - DEFAULT_ANALYTICS_LOOKBACK_DAYS * MILLISECONDS_PER_DAY);
  const effectiveEndDate = endDate ?? new Date();

  if (effectiveStartDate.getTime() > effectiveEndDate.getTime()) {
    res.status(400).json({ error: 'startDate must be before or equal to endDate.' });
    return null;
  }

  const rangeDays =
    (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / MILLISECONDS_PER_DAY;
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

const resolveAuthorizedOrganizationId = (
  req: AnalyticsAuthRequest,
  res: Response
): string | null => {
  const currentOrganizationId = req.user?.currentOrganizationId;
  const requestedOrganizationId = readStringQueryParam(req.query.orgId);

  if (!currentOrganizationId && !requestedOrganizationId) {
    res.status(400).json({ error: 'Organization context required' });
    return null;
  }

  if (
    requestedOrganizationId &&
    currentOrganizationId &&
    requestedOrganizationId !== currentOrganizationId
  ) {
    res.status(403).json({ error: 'Not authorized for this organization' });
    return null;
  }

  return requestedOrganizationId ?? currentOrganizationId ?? null;
};

// ==================== GENERAL ANALYTICS ====================
// General analytics (dashboard, user-activity, fleet-stats, org-metrics,
// engagement, retention, revenue, export, reports) are NOT yet implemented.
//
// Current data surfaces:
//   - Dashboard data:    GET /api/v2/dashboard/summary (DashboardAggregatorService)
//   - Fleet analytics:   GET /api/v2/fleets/:id/stats  (FleetService)
//   - Org analytics:     GET /api/v2/organizations/:id/analytics (OrganizationAnalyticsService)
//
// Cross-system analytics and bot statistics are fully implemented below.
// ================================================================

/**
 * GET /api/v2/analytics/executive-overview
 * Aggregated analytics snapshot for operations, trust, and participation
 */
router.get(
  '/executive-overview',
  safeAuthenticate,
  safeGeneralRateLimiter,
  wrapAsyncRouteHandler(async (req: Request, res: Response) => {
    try {
      const organizationId = resolveAuthorizedOrganizationId(req as AnalyticsAuthRequest, res);
      if (!organizationId) {
        return;
      }

      const period = parsePeriod(readStringQueryParam(req.query.period));
      if (!period) {
        res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
        return;
      }

      const missionRepo = AppDataSource.getRepository(Mission);
      const ticketRepo = AppDataSource.getRepository(Ticket);
      const ticketService = TicketService.getInstance();

      const missionStatusRows = await missionRepo
        .createQueryBuilder('mission')
        .select('mission.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('mission.organizationId = :organizationId', { organizationId })
        .andWhere('mission.deletedAt IS NULL')
        .groupBy('mission.status')
        .getRawMany<{ status: MissionStatus; count: string }>();

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
        if (row.status === MissionStatus.DRAFT) {
          missionBreakdown.draft = count;
        } else if (row.status === MissionStatus.PLANNED) {
          missionBreakdown.planned = count;
        } else if (row.status === MissionStatus.BRIEFED) {
          missionBreakdown.briefed = count;
        } else if (row.status === MissionStatus.IN_PROGRESS) {
          missionBreakdown.inProgress = count;
        } else if (row.status === MissionStatus.COMPLETED) {
          missionBreakdown.completed = count;
        } else if (row.status === MissionStatus.FAILED) {
          missionBreakdown.failed = count;
        } else if (row.status === MissionStatus.CANCELLED) {
          missionBreakdown.cancelled = count;
        }
      }

      const disputesOpen = await ticketRepo
        .createQueryBuilder('ticket')
        .where('ticket.organizationId = :organizationId', { organizationId })
        .andWhere('ticket.category = :category', { category: TicketCategory.SUPPORT })
        .andWhere('ticket.tags LIKE :disputeTag', { disputeTag: '%trade-dispute%' })
        .andWhere('ticket.status IN (:...openStatuses)', {
          openStatuses: [
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.AWAITING_RESPONSE,
          ],
        })
        .getCount();

      const disputesClosed = await ticketRepo
        .createQueryBuilder('ticket')
        .where('ticket.organizationId = :organizationId', { organizationId })
        .andWhere('ticket.category = :category', { category: TicketCategory.SUPPORT })
        .andWhere('ticket.tags LIKE :disputeTag', { disputeTag: '%trade-dispute%' })
        .andWhere('ticket.status IN (:...closedStatuses)', {
          closedStatuses: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
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
          activeMissionCount:
            missionBreakdown.planned + missionBreakdown.briefed + missionBreakdown.inProgress,
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
    } catch (error: unknown) {
      logRouteError('Failed to get executive overview analytics', error);
      res.status(500).json({ error: 'Failed to get executive overview analytics' });
    }
  })
);

// ==================== CROSS-SYSTEM ANALYTICS (Sprint 23-F) ====================

/**
 * GET /api/v2/analytics/cross-system
 * Get cross-system participation analytics (crew formation, job placement, LFG conversion)
 * Query: period (daily|weekly|monthly), orgId, startDate, endDate
 */
router.get(
  '/cross-system',
  safeAuthenticate,
  safeGeneralRateLimiter,
  wrapAsyncRouteHandler(async (req: Request, res: Response) => {
    try {
      const period = parsePeriod(readStringQueryParam(req.query.period));
      if (!period) {
        res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
        return;
      }

      const orgId = resolveAuthorizedOrganizationId(req as AnalyticsAuthRequest, res);
      if (!orgId) {
        return;
      }

      const dateRange = resolveDateRange(req, res);
      if (!dateRange) {
        return;
      }

      const { startDate, endDate } = dateRange;

      const analytics = await getCrossSystemService().getAnalytics(
        period,
        orgId,
        startDate,
        endDate
      );
      res.success(analytics);
    } catch (error: unknown) {
      logRouteError('Failed to get cross-system analytics', error);
      res.status(500).json({ error: 'Failed to get cross-system analytics' });
    }
  })
);

/**
 * GET /api/v2/analytics/cross-system/crew-formation
 * Get crew formation trends
 */
router.get(
  '/cross-system/crew-formation',
  safeAuthenticate,
  safeGeneralRateLimiter,
  wrapAsyncRouteHandler(async (req: Request, res: Response) => {
    try {
      const period = parsePeriod(readStringQueryParam(req.query.period));
      if (!period) {
        res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
        return;
      }

      const orgId = resolveAuthorizedOrganizationId(req as AnalyticsAuthRequest, res);
      if (!orgId) {
        return;
      }

      const dateRange = resolveDateRange(req, res);
      if (!dateRange) {
        return;
      }

      const { startDate, endDate } = dateRange;

      const data = await getCrossSystemService().getCrewFormationTrends(
        period,
        orgId,
        startDate,
        endDate
      );
      res.success(data);
    } catch (error: unknown) {
      logRouteError('Failed to get crew formation trends', error);
      res.status(500).json({ error: 'Failed to get crew formation trends' });
    }
  })
);

/**
 * GET /api/v2/analytics/cross-system/formation-speed
 * Get team formation speed statistics
 */
router.get(
  '/cross-system/formation-speed',
  safeAuthenticate,
  safeGeneralRateLimiter,
  wrapAsyncRouteHandler(async (req: Request, res: Response) => {
    try {
      const orgId = resolveAuthorizedOrganizationId(req as AnalyticsAuthRequest, res);
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
    } catch (error: unknown) {
      logRouteError('Failed to get formation speed stats', error);
      res.status(500).json({ error: 'Failed to get formation speed stats' });
    }
  })
);

/**
 * GET /api/v2/analytics/cross-system/job-placement
 * Get job placement rate metrics
 */
router.get(
  '/cross-system/job-placement',
  safeAuthenticate,
  safeGeneralRateLimiter,
  wrapAsyncRouteHandler(async (req: Request, res: Response) => {
    try {
      const period = parsePeriod(readStringQueryParam(req.query.period));
      if (!period) {
        res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
        return;
      }

      const orgId = resolveAuthorizedOrganizationId(req as AnalyticsAuthRequest, res);
      if (!orgId) {
        return;
      }

      const dateRange = resolveDateRange(req, res);
      if (!dateRange) {
        return;
      }

      const { startDate, endDate } = dateRange;

      const data = await getCrossSystemService().getJobPlacementMetrics(
        orgId,
        startDate,
        endDate,
        period
      );
      res.success(data);
    } catch (error: unknown) {
      logRouteError('Failed to get job placement metrics', error);
      res.status(500).json({ error: 'Failed to get job placement metrics' });
    }
  })
);

/**
 * GET /api/v2/analytics/cross-system/lfg-conversion
 * Get LFG to team conversion metrics
 */
router.get(
  '/cross-system/lfg-conversion',
  safeAuthenticate,
  safeGeneralRateLimiter,
  wrapAsyncRouteHandler(async (req: Request, res: Response) => {
    try {
      const period = parsePeriod(readStringQueryParam(req.query.period));
      if (!period) {
        res.status(400).json({ error: 'Invalid period. Must be daily, weekly, or monthly.' });
        return;
      }

      const orgId = resolveAuthorizedOrganizationId(req as AnalyticsAuthRequest, res);
      if (!orgId) {
        return;
      }

      const dateRange = resolveDateRange(req, res);
      if (!dateRange) {
        return;
      }

      const { startDate, endDate } = dateRange;

      const data = await getCrossSystemService().getLfgConversionMetrics(
        orgId,
        startDate,
        endDate,
        period
      );
      res.success(data);
    } catch (error: unknown) {
      logRouteError('Failed to get LFG conversion metrics', error);
      res.status(500).json({ error: 'Failed to get LFG conversion metrics' });
    }
  })
);

// ==================== BOT STATISTICS (Sprint 26 — Gap Analysis) ====================

/**
 * GET /api/v2/analytics/bot-stats/commands
 * Get command usage analytics (all commands or filtered by guildId)
 * Query: guildId
 */
router.get(
  '/bot-stats/commands',
  safeAuthenticate,
  safeGeneralRateLimiter,
  (req: Request, res: Response) => {
    try {
      const guildId = readStringQueryParam(req.query.guildId);
      const analytics = CommandAnalytics.getInstance();

      if (guildId) {
        const guildStats = analytics.getGuildStats(guildId);
        res.success(guildStats);
      } else {
        const systemStats = analytics.getSystemStats();
        res.success(systemStats);
      }
    } catch (error: unknown) {
      logRouteError('Failed to get bot command stats', error);
      res.status(500).json({ error: 'Failed to get bot command stats' });
    }
  }
);

/**
 * GET /api/v2/analytics/bot-stats/commands/all
 * Get per-command breakdown
 */
router.get(
  '/bot-stats/commands/all',
  safeAuthenticate,
  safeGeneralRateLimiter,
  (req: Request, res: Response) => {
    try {
      const analytics = CommandAnalytics.getInstance();
      const allStats = analytics.getAllCommandStats();
      res.success(allStats);
    } catch (error: unknown) {
      logRouteError('Failed to get all command stats', error);
      res.status(500).json({ error: 'Failed to get all command stats' });
    }
  }
);

/**
 * GET /api/v2/analytics/bot-stats/presence/:guildId
 * Get current game/activity presence data for a guild
 */
router.get(
  '/bot-stats/presence/:guildId',
  safeAuthenticate,
  safeGeneralRateLimiter,
  (req: Request, res: Response) => {
    try {
      const guildId = readPathParam(req, 'guildId');
      if (!guildId) {
        res.status(400).json({ error: 'Invalid guildId parameter' });
        return;
      }

      const presenceService = PresenceTrackingService.getInstance();
      const gameStats = presenceService.getCurrentGameStats(guildId);
      res.success(gameStats);
    } catch (error: unknown) {
      logRouteError('Failed to get presence stats', error);
      res.status(500).json({ error: 'Failed to get presence stats' });
    }
  }
);

/**
 * GET /api/v2/analytics/bot-stats/heatmap/:guildId
 * Get activity heatmap data (hourly, by day of week)
 * Query: days (default 7)
 */
router.get(
  '/bot-stats/heatmap/:guildId',
  safeAuthenticate,
  safeGeneralRateLimiter,
  (req: Request, res: Response) => {
    try {
      const guildId = readPathParam(req, 'guildId');
      if (!guildId) {
        res.status(400).json({ error: 'Invalid guildId parameter' });
        return;
      }

      const days = readBoundedIntegerQueryParam(req.query.days, 7, 1, 30);
      const presenceService = PresenceTrackingService.getInstance();
      const heatmap = presenceService.getActivityHeatmap(guildId, days);
      res.success(heatmap);
    } catch (error: unknown) {
      logRouteError('Failed to get activity heatmap', error);
      res.status(500).json({ error: 'Failed to get activity heatmap' });
    }
  }
);

/**
 * GET /api/v2/analytics/bot-stats/games/:guildId
 * Get game presence history (top games, session counts)
 * Query: days (default 7)
 */
router.get(
  '/bot-stats/games/:guildId',
  safeAuthenticate,
  safeGeneralRateLimiter,
  (req: Request, res: Response) => {
    try {
      const guildId = readPathParam(req, 'guildId');
      if (!guildId) {
        res.status(400).json({ error: 'Invalid guildId parameter' });
        return;
      }

      const days = readBoundedIntegerQueryParam(req.query.days, 7, 1, 30);
      const presenceService = PresenceTrackingService.getInstance();
      const games = presenceService.getGamePresenceHistory(guildId, days);
      res.success(games);
    } catch (error: unknown) {
      logRouteError('Failed to get game presence history', error);
      res.status(500).json({ error: 'Failed to get game presence history' });
    }
  }
);

export { router };
