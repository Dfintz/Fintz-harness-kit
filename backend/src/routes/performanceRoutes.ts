import { Request, Response, Router } from 'express';

import { requireAdmin } from '../middleware/adminAuth';
import { authenticate } from '../middleware/auth';
import { createCustomRateLimiter } from '../middleware/rateLimiting';
import {
  enhancedCacheService,
  performanceMonitoringService,
  queryAnalyzerService,
} from '../services/infrastructure';
import { logger } from '../utils/logger';

const router = Router();

// Rate limiting for performance endpoints - admin operations limited to prevent abuse
const performanceRateLimiter = createCustomRateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 requests per minute
  message: 'Too many performance API requests, please try again later.',
});

/**
 * @swagger
 * /api/performance:
 *   get:
 *     summary: Get performance overview
 *     description: Returns a quick summary of current system performance
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance summary retrieved successfully
 */
router.get('/', performanceRateLimiter, authenticate, async (_req: Request, res: Response) => {
  try {
    const summary = await performanceMonitoringService.getQuickSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Failed to get performance summary', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance summary',
    });
  }
});

/**
 * @swagger
 * /api/performance/report:
 *   get:
 *     summary: Get comprehensive performance report
 *     description: Returns a detailed performance report including database, cache, and memory metrics
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance report retrieved successfully
 */
router.get(
  '/report',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const report = await performanceMonitoringService.generateReport();
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to generate performance report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate performance report',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/history:
 *   get:
 *     summary: Get performance report history
 *     description: Returns historical performance reports for trend analysis
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance history retrieved successfully
 */
router.get(
  '/history',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const history = performanceMonitoringService.getReportHistory();
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Failed to get performance history', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance history',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/database:
 *   get:
 *     summary: Get database performance metrics
 *     description: Returns database query statistics and slow query analysis
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database metrics retrieved successfully
 */
router.get(
  '/database',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const queryStats = queryAnalyzerService.getQueryStats();
      const slowQueries = queryAnalyzerService.analyzeSlowQueries();
      const indexRecommendations = queryAnalyzerService.getIndexRecommendations();
      const recentQueries = queryAnalyzerService.getRecentQueries(20);

      res.json({
        success: true,
        data: {
          queryStats,
          slowQueries: slowQueries.slice(0, 10),
          indexRecommendations: indexRecommendations.slice(0, 5),
          recentQueries,
        },
      });
    } catch (error) {
      logger.error('Failed to get database performance', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve database performance metrics',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/database/indices:
 *   get:
 *     summary: Get database index information
 *     description: Returns existing indices and recommendations for new ones
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: table
 *         schema:
 *           type: string
 *         description: Optional table name to filter indices
 *     responses:
 *       200:
 *         description: Index information retrieved successfully
 */
router.get(
  '/database/indices',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const tableName = req.query.table as string | undefined;
      const existingIndices = await queryAnalyzerService.getExistingIndices(tableName);
      const recommendations = queryAnalyzerService.getIndexRecommendations();

      res.json({
        success: true,
        data: {
          existingIndices,
          recommendations,
        },
      });
    } catch (error) {
      logger.error('Failed to get index information', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve index information',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/database/tables:
 *   get:
 *     summary: Get table statistics
 *     description: Returns table row counts and vacuum information
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Table statistics retrieved successfully
 */
router.get(
  '/database/tables',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const tableStats = await queryAnalyzerService.getTableStats();
      res.json({
        success: true,
        data: tableStats,
      });
    } catch (error) {
      logger.error('Failed to get table statistics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve table statistics',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/cache:
 *   get:
 *     summary: Get cache performance metrics
 *     description: Returns cache hit rates, metrics, and key information
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache metrics retrieved successfully
 */
router.get(
  '/cache',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const metrics = enhancedCacheService.getMetrics();
      const tags = enhancedCacheService.getTags();
      const keyCount = enhancedCacheService.keys().length;
      const history = enhancedCacheService.getMetricsHistory();

      res.json({
        success: true,
        data: {
          metrics,
          tags,
          keyCount,
          history: history.slice(-10), // Last 10 snapshots
        },
      });
    } catch (error) {
      logger.error('Failed to get cache performance', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cache performance metrics',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/cache/keys:
 *   get:
 *     summary: Get cache keys information
 *     description: Returns list of cache keys with their metadata
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pattern
 *         schema:
 *           type: string
 *         description: Optional pattern to filter keys
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Optional tag to filter keys
 *     responses:
 *       200:
 *         description: Cache keys retrieved successfully
 */
router.get(
  '/cache/keys',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const pattern = req.query.pattern as string | undefined;
      const tag = req.query.tag as string | undefined;

      let keys: string[];

      if (tag) {
        keys = enhancedCacheService.getKeysByTag(tag);
      } else {
        keys = enhancedCacheService.keys();

        if (pattern) {
          // NOSONAR: Improper Type Validation FP — pattern is from req.query (string),
          // used only for internal cache key filtering, not DB queries.
          // Convert glob pattern to regex safely:
          // 1. First, temporarily replace * with a unique marker to preserve glob wildcards
          // Use a simple timestamp-based marker that's extremely unlikely to appear in cache keys
          const GLOB_WILDCARD_MARKER = `__GLOB_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
          const validatedPattern = typeof pattern === 'string' ? pattern : '';
          const withPlaceholder = validatedPattern.replace(/\*/g, GLOB_WILDCARD_MARKER);
          // 2. Escape all regex metacharacters (now * is safe as placeholder)
          const escaped = withPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // 3. Replace placeholder with regex wildcard pattern
          const safePattern = escaped.replace(new RegExp(GLOB_WILDCARD_MARKER, 'g'), '.*');
          const regex = new RegExp(safePattern); // NOSONAR
          keys = keys.filter(key => regex.test(key));
        }
      }

      const keyInfos = keys.slice(0, 100).map(key => ({
        key,
        ...enhancedCacheService.getKeyInfo(key),
      }));

      res.json({
        success: true,
        data: {
          total: keys.length,
          keys: keyInfos,
        },
      });
    } catch (error) {
      logger.error('Failed to get cache keys', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cache keys',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/cache/warm:
 *   post:
 *     summary: Warm cache for a specific key
 *     description: Triggers cache warming for a registered key
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cache warmed successfully
 *       400:
 *         description: Invalid key or warming configuration not found
 */
router.post(
  '/cache/warm',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { key } = req.body;

      if (!key) {
        return res.status(400).json({
          success: false,
          error: 'Key is required',
        });
      }

      const result = await enhancedCacheService.warmKey(key);

      if (result) {
        res.json({
          success: true,
          message: `Cache warmed successfully for key: ${key}`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Warming configuration not found for key',
        });
      }
    } catch (error) {
      logger.error('Failed to warm cache', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to warm cache',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/cache/invalidate:
 *   post:
 *     summary: Invalidate cache entries
 *     description: Invalidates cache entries by key, pattern, or tag
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               pattern:
 *                 type: string
 *               tag:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cache invalidated successfully
 */
router.post(
  '/cache/invalidate',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { key, pattern, tag } = req.body;
      let deleted = 0;

      if (key) {
        deleted = enhancedCacheService.del(key);
      } else if (pattern) {
        deleted = enhancedCacheService.delByPattern(pattern);
      } else if (tag) {
        deleted = enhancedCacheService.delByTag(tag);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Key, pattern, or tag is required',
        });
      }

      res.json({
        success: true,
        data: { deleted },
      });
    } catch (error) {
      logger.error('Failed to invalidate cache', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate cache',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/thresholds:
 *   get:
 *     summary: Get performance thresholds
 *     description: Returns current performance monitoring thresholds
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thresholds retrieved successfully
 */
router.get(
  '/thresholds',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const thresholds = performanceMonitoringService.getThresholds();
      res.json({
        success: true,
        data: thresholds,
      });
    } catch (error) {
      logger.error('Failed to get thresholds', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve thresholds',
      });
    }
  }
);

/**
 * @swagger
 * /api/performance/thresholds:
 *   put:
 *     summary: Update performance thresholds
 *     description: Updates performance monitoring thresholds
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               queryP95ThresholdMs:
 *                 type: number
 *               slowQueryThresholdMs:
 *                 type: number
 *               cacheHitRateThreshold:
 *                 type: number
 *               memoryUsageThreshold:
 *                 type: number
 *     responses:
 *       200:
 *         description: Thresholds updated successfully
 */
router.put(
  '/thresholds',
  performanceRateLimiter,
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const thresholds = req.body;
      performanceMonitoringService.updateThresholds(thresholds);

      res.json({
        success: true,
        data: performanceMonitoringService.getThresholds(),
      });
    } catch (error) {
      logger.error('Failed to update thresholds', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update thresholds',
      });
    }
  }
);

export { router };
