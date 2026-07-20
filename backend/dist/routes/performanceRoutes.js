"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const auth_1 = require("../middleware/auth");
const rateLimiting_1 = require("../middleware/rateLimiting");
const infrastructure_1 = require("../services/infrastructure");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
const performanceRateLimiter = (0, rateLimiting_1.createCustomRateLimiter)({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many performance API requests, please try again later.',
});
router.get('/', performanceRateLimiter, auth_1.authenticate, async (_req, res) => {
    try {
        const summary = await infrastructure_1.performanceMonitoringService.getQuickSummary();
        res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get performance summary', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve performance summary',
        });
    }
});
router.get('/report', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (_req, res) => {
    try {
        const report = await infrastructure_1.performanceMonitoringService.generateReport();
        res.json({
            success: true,
            data: report,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to generate performance report', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to generate performance report',
        });
    }
});
router.get('/history', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (_req, res) => {
    try {
        const history = infrastructure_1.performanceMonitoringService.getReportHistory();
        res.json({
            success: true,
            data: history,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get performance history', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve performance history',
        });
    }
});
router.get('/database', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (_req, res) => {
    try {
        const queryStats = infrastructure_1.queryAnalyzerService.getQueryStats();
        const slowQueries = infrastructure_1.queryAnalyzerService.analyzeSlowQueries();
        const indexRecommendations = infrastructure_1.queryAnalyzerService.getIndexRecommendations();
        const recentQueries = infrastructure_1.queryAnalyzerService.getRecentQueries(20);
        res.json({
            success: true,
            data: {
                queryStats,
                slowQueries: slowQueries.slice(0, 10),
                indexRecommendations: indexRecommendations.slice(0, 5),
                recentQueries,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get database performance', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve database performance metrics',
        });
    }
});
router.get('/database/indices', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const tableName = req.query.table;
        const existingIndices = await infrastructure_1.queryAnalyzerService.getExistingIndices(tableName);
        const recommendations = infrastructure_1.queryAnalyzerService.getIndexRecommendations();
        res.json({
            success: true,
            data: {
                existingIndices,
                recommendations,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get index information', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve index information',
        });
    }
});
router.get('/database/tables', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (_req, res) => {
    try {
        const tableStats = await infrastructure_1.queryAnalyzerService.getTableStats();
        res.json({
            success: true,
            data: tableStats,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get table statistics', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve table statistics',
        });
    }
});
router.get('/cache', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (_req, res) => {
    try {
        const metrics = infrastructure_1.enhancedCacheService.getMetrics();
        const tags = infrastructure_1.enhancedCacheService.getTags();
        const keyCount = infrastructure_1.enhancedCacheService.keys().length;
        const history = infrastructure_1.enhancedCacheService.getMetricsHistory();
        res.json({
            success: true,
            data: {
                metrics,
                tags,
                keyCount,
                history: history.slice(-10),
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get cache performance', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve cache performance metrics',
        });
    }
});
router.get('/cache/keys', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const pattern = req.query.pattern;
        const tag = req.query.tag;
        let keys;
        if (tag) {
            keys = infrastructure_1.enhancedCacheService.getKeysByTag(tag);
        }
        else {
            keys = infrastructure_1.enhancedCacheService.keys();
            if (pattern) {
                const GLOB_WILDCARD_MARKER = `__GLOB_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
                const validatedPattern = typeof pattern === 'string' ? pattern : '';
                const withPlaceholder = validatedPattern.replace(/\*/g, GLOB_WILDCARD_MARKER);
                const escaped = withPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const safePattern = escaped.replace(new RegExp(GLOB_WILDCARD_MARKER, 'g'), '.*');
                const regex = new RegExp(safePattern);
                keys = keys.filter(key => regex.test(key));
            }
        }
        const keyInfos = keys.slice(0, 100).map(key => ({
            key,
            ...infrastructure_1.enhancedCacheService.getKeyInfo(key),
        }));
        res.json({
            success: true,
            data: {
                total: keys.length,
                keys: keyInfos,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get cache keys', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve cache keys',
        });
    }
});
router.post('/cache/warm', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) {
            return res.status(400).json({
                success: false,
                error: 'Key is required',
            });
        }
        const result = await infrastructure_1.enhancedCacheService.warmKey(key);
        if (result) {
            res.json({
                success: true,
                message: `Cache warmed successfully for key: ${key}`,
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Warming configuration not found for key',
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to warm cache', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to warm cache',
        });
    }
});
router.post('/cache/invalidate', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const { key, pattern, tag } = req.body;
        let deleted = 0;
        if (key) {
            deleted = infrastructure_1.enhancedCacheService.del(key);
        }
        else if (pattern) {
            deleted = infrastructure_1.enhancedCacheService.delByPattern(pattern);
        }
        else if (tag) {
            deleted = infrastructure_1.enhancedCacheService.delByTag(tag);
        }
        else {
            return res.status(400).json({
                success: false,
                error: 'Key, pattern, or tag is required',
            });
        }
        res.json({
            success: true,
            data: { deleted },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to invalidate cache', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to invalidate cache',
        });
    }
});
router.get('/thresholds', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (_req, res) => {
    try {
        const thresholds = infrastructure_1.performanceMonitoringService.getThresholds();
        res.json({
            success: true,
            data: thresholds,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get thresholds', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve thresholds',
        });
    }
});
router.put('/thresholds', performanceRateLimiter, auth_1.authenticate, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const thresholds = req.body;
        infrastructure_1.performanceMonitoringService.updateThresholds(thresholds);
        res.json({
            success: true,
            data: infrastructure_1.performanceMonitoringService.getThresholds(),
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update thresholds', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update thresholds',
        });
    }
});
//# sourceMappingURL=performanceRoutes.js.map