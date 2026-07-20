"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middleware/adminAuth");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const IntegrationStatusService_1 = require("../../services/monitoring/IntegrationStatusService");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
router.get('/health', auth_1.authenticateToken, rateLimiting_1.adminReadRateLimiter, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const integrationStatusService = IntegrationStatusService_1.IntegrationStatusService.getInstance();
        const systemHealth = await integrationStatusService.getSystemHealth();
        const integrations = systemHealth.integrations.map(health => ({
            name: health.name,
            status: health.status.toLowerCase(),
            latency: health.responseTime,
            lastChecked: health.lastCheck,
            details: health.metrics,
            message: health.errorMessage,
        }));
        const summary = {
            total: integrations.length,
            healthy: integrations.filter(i => i.status === 'healthy').length,
            degraded: integrations.filter(i => i.status === 'degraded').length,
            unhealthy: integrations.filter(i => i.status === 'unhealthy').length,
        };
        let overall = 'healthy';
        if (summary.unhealthy > 0) {
            overall = 'unhealthy';
        }
        else if (summary.degraded > 0) {
            overall = 'degraded';
        }
        const dashboard = {
            overall,
            timestamp: new Date(),
            integrations,
            summary,
        };
        logger_1.logger.info('Integration health dashboard requested', { overall, summary });
        res.json({
            success: true,
            data: dashboard,
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting integration health dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get integration health dashboard',
        });
    }
});
router.get('/health/:integration', auth_1.authenticateToken, rateLimiting_1.adminReadRateLimiter, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const { integration } = req.params;
        const integrationStatusService = IntegrationStatusService_1.IntegrationStatusService.getInstance();
        const systemHealth = await integrationStatusService.getSystemHealth();
        const integrationsMap = {
            rsi: 'RSI API',
            sentry: 'RSI API',
            redis: 'Redis Cache',
            database: 'Database',
            memory: 'Memory',
            discord: 'Discord',
            azure: 'Azure Services',
            azureservices: 'Azure Services',
            uif: 'UIF Trading API',
        };
        const searchName = integrationsMap[integration.toLowerCase()] || integration;
        const health = systemHealth.integrations.find(h => h.name.toLowerCase().includes(searchName.toLowerCase()));
        if (!health) {
            res.status(404).json({
                success: false,
                error: `Integration not found: ${integration}`,
            });
            return;
        }
        const result = {
            name: health.name,
            status: health.status.toLowerCase(),
            latency: health.responseTime,
            lastChecked: health.lastCheck,
            details: health.metrics,
            message: health.errorMessage,
        };
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting integration health:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get integration health',
        });
    }
});
//# sourceMappingURL=integrationHealthRoutes.js.map