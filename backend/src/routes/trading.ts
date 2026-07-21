import { Response, Router } from 'express';

import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { RouteStatus, RouteVisibility } from '../models/TradingRoute';
import { paramSchemas, querySchemas, tradingRouteQuerySchemas, tradingSchemas } from '../schemas';
import { tradingService } from '../services/trade/trading/TradingService';
import { logger } from '../utils/logger';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

const router = Router();

/** Extract and validate the user's current org ID, returning 400 if absent */
function requireOrgId(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.currentOrganizationId;
  if (!orgId) {
    res.status(400).json({ error: 'No active organization selected' });
    return null;
  }
  return orgId;
}

/**
 * POST /api/trading/routes
 * Create a new trading route
 */
router.post(
  '/routes',
  authenticateToken,
  validateSchema(tradingSchemas.createRoute, 'body'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const dto = {
        ...sanitizeObject(req.body as Record<string, unknown>),
        creatorId: req.user.id,
      } as Record<string, unknown>;

      const route = await tradingService.createRoute(dto as never);
      return res.status(201).json(route);
    } catch (error) {
      logger.error('Error creating trading route:', error);
      return res.status(500).json({ error: 'Failed to create trading route' });
    }
  }
);

/**
 * GET /api/trading/routes
 * Get all trading routes with optional filters
 */
router.get(
  '/routes',
  authenticateToken,
  validateSchema(tradingRouteQuerySchemas.listQuery, 'query'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      if (!req.user.currentOrganizationId) {
        return res.status(400).json({ error: 'No organization selected' });
      }
      const filters: {
        creatorId?: string;
        organizationId: string;
        status?: RouteStatus;
        visibility?: RouteVisibility;
        tags?: string[];
        includeShared?: boolean;
      } = {
        organizationId: req.user.currentOrganizationId,
        creatorId: req.user.id,
      };

      if (req.query.status && typeof req.query.status === 'string') {
        const validStatuses = Object.values(RouteStatus) as string[];
        if (validStatuses.includes(req.query.status)) {
          filters.status = req.query.status as RouteStatus;
        }
      }

      if (req.query.tags && typeof req.query.tags === 'string') {
        filters.tags = req.query.tags.split(',').map(t => t.trim());
      }

      const routes = await tradingService.getRoutes(filters);
      return res.json(routes);
    } catch (error) {
      logger.error('Error getting trading routes:', error);
      return res.status(500).json({ error: 'Failed to get trading routes' });
    }
  }
);

/**
 * GET /api/trading/routes/:id
 * Get a specific trading route
 */
router.get(
  '/routes/:id',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const orgId = requireOrgId(req, res);
      if (!orgId) {
        return;
      }
      const route = await tradingService.getRouteById(req.params.id, orgId);

      if (!route) {
        return res.status(404).json({ error: 'Trading route not found' });
      }

      // Check authorization
      if (route.creatorId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json(route);
    } catch (error) {
      logger.error('Error getting trading route:', error);
      return res.status(500).json({ error: 'Failed to get trading route' });
    }
  }
);

/**
 * PUT /api/trading/routes/:id
 * Update a trading route
 */
router.put(
  '/routes/:id',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(tradingSchemas.updateRoute, 'body'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const orgId = requireOrgId(req, res);
      if (!orgId) {
        return;
      }
      const route = await tradingService.getRouteById(req.params.id, orgId);

      if (!route) {
        return res.status(404).json({ error: 'Trading route not found' });
      }

      if (route.creatorId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedRoute = await tradingService.updateRoute(
        req.params.id,
        req.body,
        route.organizationId!
      );
      return res.json(updatedRoute);
    } catch (error) {
      logger.error('Error updating trading route:', error);
      return res.status(500).json({ error: 'Failed to update trading route' });
    }
  }
);

/**
 * DELETE /api/trading/routes/:id
 * Delete a trading route
 */
router.delete(
  '/routes/:id',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const orgId = requireOrgId(req, res);
      if (!orgId) {
        return;
      }
      const route = await tradingService.getRouteById(req.params.id, orgId);

      if (!route) {
        return res.status(404).json({ error: 'Trading route not found' });
      }

      if (route.creatorId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await tradingService.deleteRoute(req.params.id, route.organizationId!);
      return res.status(204).send();
    } catch (error) {
      logger.error('Error deleting trading route:', error);
      return res.status(500).json({ error: 'Failed to delete trading route' });
    }
  }
);

/**
 * POST /api/trading/routes/:id/runs
 * Record a completed route run
 */
router.post(
  '/routes/:id/runs',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(tradingSchemas.recordCompletion, 'body'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const orgId = requireOrgId(req, res);
      if (!orgId) {
        return;
      }
      const route = await tradingService.getRouteById(req.params.id, orgId);

      if (!route) {
        return res.status(404).json({ error: 'Trading route not found' });
      }

      if (route.creatorId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedRoute = await tradingService.recordRouteRun(
        req.params.id,
        req.body.profit,
        req.body.duration,
        route.organizationId!
      );

      return res.json(updatedRoute);
    } catch (error) {
      logger.error('Error recording route run:', error);
      return res.status(500).json({ error: 'Failed to record route run' });
    }
  }
);

/**
 * GET /api/trading/opportunities
 * Find best trade opportunities from a location
 */
router.get(
  '/opportunities',
  authenticateToken,
  validateSchema(querySchemas.search, 'query'),
  async (req: AuthRequest, res: Response) => {
    try {
      const startLocation = req.query.startLocation as string;
      const minProfitMargin = Number.parseFloat(req.query.minProfitMargin as string) || 10;
      const limit = Number.parseInt(req.query.limit as string, 10) || 10;

      const opportunities = await tradingService.findTradeOpportunities(
        startLocation,
        minProfitMargin,
        limit
      );

      return res.json(opportunities);
    } catch (error) {
      logger.error('Error finding trade opportunities:', error);
      return res.status(500).json({ error: 'Failed to find trade opportunities' });
    }
  }
);

/**
 * POST /api/trading/routes/optimize
 * Generate an optimized trading route
 */
router.post(
  '/routes/optimize',
  authenticateToken,
  validateSchema(tradingSchemas.generateRoute, 'body'),
  async (req: AuthRequest, res: Response) => {
    try {
      const stops = await tradingService.optimizeRoute(req.body);
      return res.json({ stops });
    } catch (error) {
      logger.error('Error optimizing route:', error);
      return res.status(500).json({ error: 'Failed to optimize route' });
    }
  }
);

/**
 * GET /api/trading/routes/:id/analysis
 * Get profitability analysis for a route
 */
router.get(
  '/routes/:id/analysis',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) {
        return;
      }
      const route = await tradingService.getRouteById(req.params.id, orgId);

      if (!route) {
        return res.status(404).json({ error: 'Trading route not found' });
      }

      if (route.creatorId !== req.user?.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const analysis = await tradingService.analyzeRouteProfitability(req.params.id, orgId);
      return res.json(analysis);
    } catch (error) {
      logger.error('Error analyzing route:', error);
      return res.status(500).json({ error: 'Failed to analyze route' });
    }
  }
);

/**
 * POST /api/trading/routes/refresh
 * Refresh all route profits from current market data
 */
router.post('/routes/refresh', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await tradingService.refreshAllRouteProfits();
    return res.json(result);
  } catch (error) {
    logger.error('Error refreshing route profits:', error);
    return res.status(500).json({ error: 'Failed to refresh route profits' });
  }
});

export { router };
