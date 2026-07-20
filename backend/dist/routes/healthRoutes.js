"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setHealthRoutes = void 0;
const healthController_1 = require("../controllers/healthController");
const IntegrationStatusService_1 = require("../services/monitoring/IntegrationStatusService");
let healthController;
const getHealthController = () => {
    if (!healthController) {
        healthController = new healthController_1.HealthController();
    }
    return healthController;
};
const setHealthRoutes = (app) => {
    app.get('/health', getHealthController().getHealth.bind(healthController));
    app.get('/ready', getHealthController().getReadiness.bind(healthController));
    app.get('/health/services', getHealthController().getServiceHealth.bind(healthController));
    app.get('/health/cache', getHealthController().getCacheStats.bind(healthController));
    app.get('/health/realtime', (req, res, next) => {
        const authHeader = req.headers.authorization;
        const isInternal = req.ip === '127.0.0.1' || req.ip === '::1';
        if (!isInternal && !authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Authentication required for realtime diagnostics' });
            return;
        }
        next();
    }, getHealthController().getRealtimeDiagnostics.bind(healthController));
    app.get('/health/realtime/ipc', getHealthController().getIpcHealth.bind(healthController));
    app.get('/health/system', (req, res, next) => {
        const authHeader = req.headers.authorization;
        const isInternal = req.ip === '127.0.0.1' || req.ip === '::1';
        if (!isInternal && !authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Authentication required for system health' });
            return;
        }
        next();
    }, getHealthController().getSystemHealthV2.bind(healthController));
    app.get('/health/component/:name', getHealthController().getComponentHealth.bind(healthController));
    app.get('/health/integrations', async (_req, res) => {
        try {
            const healthSummary = await IntegrationStatusService_1.integrationStatusService.getSystemHealth();
            res.status(200).json(healthSummary);
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to get integration status',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    app.post('/health/integrations/refresh', async (_req, res) => {
        try {
            const healthSummary = await IntegrationStatusService_1.integrationStatusService.refreshHealth();
            res.status(200).json({
                message: 'Integration health refreshed',
                ...healthSummary,
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to refresh integration status',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
};
exports.setHealthRoutes = setHealthRoutes;
//# sourceMappingURL=healthRoutes.js.map