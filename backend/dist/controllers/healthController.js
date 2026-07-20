"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const data_source_1 = require("../data-source");
const ActivityService_1 = require("../services/activity/ActivityService");
const FleetService_1 = require("../services/fleet/FleetService");
const health_1 = require("../services/health");
const infrastructure_1 = require("../services/infrastructure");
const RealtimeResilienceDiagnosticsService_1 = require("../services/monitoring/RealtimeResilienceDiagnosticsService");
const ShipService_1 = require("../services/ship/ShipService");
const TeamService_1 = require("../services/team/TeamService");
const health_2 = require("../types/health");
const validationState_1 = require("../utils/validationState");
const websocketServer_1 = require("../websocket/websocketServer");
const BaseController_1 = require("./BaseController");
class HealthController extends BaseController_1.BaseController {
    fleetService;
    activityService;
    teamService;
    shipService;
    getFleetService() {
        if (!this.fleetService) {
            this.fleetService = new FleetService_1.FleetService();
        }
        return this.fleetService;
    }
    getActivityService() {
        if (!this.activityService) {
            this.activityService = new ActivityService_1.ActivityService();
        }
        return this.activityService;
    }
    getTeamService() {
        if (!this.teamService) {
            this.teamService = new TeamService_1.TeamService();
        }
        return this.teamService;
    }
    getShipService() {
        if (!this.shipService) {
            this.shipService = new ShipService_1.ShipService();
        }
        return this.shipService;
    }
    getHealth = async (req, res) => {
        try {
            const health = await this.checkSystemHealth();
            const statusCode = health.status === 'OK' ? 200 : 503;
            res.status(statusCode).json(health);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getServiceHealth = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const healthChecks = await Promise.all([
                this.getFleetService().healthCheck(),
                this.getActivityService().healthCheck(),
                this.getTeamService().healthCheck(),
                this.getShipService().healthCheck(),
            ]);
            const summary = {
                total: healthChecks.length,
                healthy: healthChecks.filter(hc => hc.status === health_2.HealthStatus.HEALTHY).length,
                degraded: healthChecks.filter(hc => hc.status === health_2.HealthStatus.DEGRADED).length,
                unhealthy: healthChecks.filter(hc => hc.status === health_2.HealthStatus.UNHEALTHY).length,
            };
            let overallStatus = health_2.HealthStatus.HEALTHY;
            if (summary.unhealthy > 0) {
                overallStatus = health_2.HealthStatus.UNHEALTHY;
            }
            else if (summary.degraded > 0) {
                overallStatus = health_2.HealthStatus.DEGRADED;
            }
            const response = {
                status: overallStatus,
                timestamp: new Date(),
                services: healthChecks,
                summary,
            };
            const statusCode = overallStatus === health_2.HealthStatus.HEALTHY
                ? 200
                : overallStatus === health_2.HealthStatus.DEGRADED
                    ? 200
                    : 503;
            res.status(statusCode);
            return response;
        });
    };
    getCacheStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const cacheStats = [
                {
                    service: 'FleetService',
                    stats: this.getFleetService().getCacheStats(),
                },
                {
                    service: 'ActivityService',
                    stats: this.getActivityService().getCacheStats(),
                },
                {
                    service: 'TeamService',
                    stats: this.getTeamService().getCacheStats(),
                },
                {
                    service: 'ShipService',
                    stats: this.getShipService().getCacheStats(),
                },
            ].filter(s => s.stats !== null);
            return {
                timestamp: new Date(),
                services: cacheStats,
                summary: {
                    totalServices: cacheStats.length,
                    totalHits: cacheStats.reduce((sum, s) => sum + (s.stats?.hits || 0), 0),
                    totalMisses: cacheStats.reduce((sum, s) => sum + (s.stats?.misses || 0), 0),
                    totalKeys: cacheStats.reduce((sum, s) => sum + (s.stats?.keys || 0), 0),
                    avgHitRate: cacheStats.length > 0
                        ? Math.round((cacheStats.reduce((sum, s) => {
                            const hits = s.stats?.hits || 0;
                            const misses = s.stats?.misses || 0;
                            return sum + (hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0);
                        }, 0) /
                            cacheStats.length) *
                            100) / 100
                        : 0,
                },
            };
        });
    };
    getRealtimeDiagnostics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.getDiagnostics());
    };
    getIpcHealth = async (req, res) => {
        try {
            const snapshot = RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.getIpcHealthSnapshot();
            res.status(snapshot.status === 'unhealthy' ? 503 : 200).json({
                timestamp: new Date().toISOString(),
                ...snapshot,
            });
        }
        catch {
            res.status(503).json({
                status: 'unhealthy',
                reasons: ['health_evaluation_failed'],
                timestamp: new Date().toISOString(),
            });
        }
    };
    getReadiness = async (req, res) => {
        try {
            const databaseReady = await this.isDatabaseReady();
            const transport = (0, websocketServer_1.getWebSocketTransportReadinessSnapshot)();
            const transportReady = transport !== null && transport.mode !== 'unknown' && transport.timedOut === false;
            const status = databaseReady && transportReady ? 'ready' : 'not_ready';
            const payload = {
                status,
                timestamp: new Date().toISOString(),
                checks: {
                    database: databaseReady ? 'ready' : 'not_ready',
                    transport: {
                        status: transportReady ? 'ready' : 'not_ready',
                        mode: transport?.mode ?? 'unknown',
                        reason: transport?.reason ?? 'not_initialized',
                        timedOut: transport?.timedOut ?? false,
                        latencyMs: transport?.latencyMs ?? null,
                    },
                },
            };
            res.status(status === 'ready' ? 200 : 503).json(payload);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    async checkSystemHealth() {
        const validationErrors = (0, validationState_1.getValidationErrors)();
        const health = {
            status: validationErrors.length > 0 ? 'DEGRADED' : 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            database: 'unknown',
            discordBot: 'unknown',
            secretsManager: 'unknown',
            keyVault: 'unknown',
            ...(validationErrors.length > 0 && { validationErrors }),
        };
        try {
            if (data_source_1.AppDataSource.isInitialized) {
                await data_source_1.AppDataSource.query('SELECT 1');
                health.database = 'connected';
            }
            else {
                health.database = 'not initialized';
                health.status = 'DEGRADED';
            }
        }
        catch (_error) {
            health.database = 'error';
            health.status = 'DEGRADED';
        }
        try {
            if (process.env.DISCORD_BOT_TOKEN) {
                health.discordBot = 'configured';
            }
            else {
                health.discordBot = 'not configured';
            }
        }
        catch (_error) {
            health.discordBot = 'error';
        }
        try {
            const secretsManager = infrastructure_1.SecretsManagerService.getInstance();
            const status = secretsManager.getStatus();
            if (status.initialized) {
                health.secretsManager = 'initialized';
                health.keyVault = status.keyVaultConfigured ? 'configured' : 'not configured';
            }
            else {
                health.secretsManager = 'not initialized';
                health.keyVault = 'not configured';
            }
        }
        catch (_error) {
            health.secretsManager = 'error';
            health.keyVault = 'error';
        }
        return health;
    }
    async isDatabaseReady() {
        if (!data_source_1.AppDataSource.isInitialized) {
            return false;
        }
        try {
            await data_source_1.AppDataSource.query('SELECT 1');
            return true;
        }
        catch {
            return false;
        }
    }
    getSystemHealthV2 = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const health = await health_1.healthMonitor.getSystemHealth();
            const statusCode = health.status === health_1.HealthStatus.HEALTHY
                ? 200
                : health.status === health_1.HealthStatus.DEGRADED
                    ? 200
                    : 503;
            res.status(statusCode);
            return health;
        });
    };
    getComponentHealth = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const componentName = req.params.name;
            const health = await health_1.healthMonitor.getComponentHealth(componentName);
            if (!health) {
                res.status(404);
                return { error: 'Component not found' };
            }
            const statusCode = health.status === health_1.HealthStatus.HEALTHY
                ? 200
                : health.status === health_1.HealthStatus.DEGRADED
                    ? 200
                    : 503;
            res.status(statusCode);
            return health;
        });
    };
}
exports.HealthController = HealthController;
//# sourceMappingURL=healthController.js.map