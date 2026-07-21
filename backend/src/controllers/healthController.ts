import { Request, Response } from 'express';

import { AppDataSource } from '../data-source';
import { ActivityService } from '../services/activity/ActivityService';
import { FleetService } from '../services/fleet/FleetService';
import { healthMonitor, HealthStatus as NewHealthStatus } from '../services/health';
import { SecretsManagerService } from '../services/infrastructure';
import { realtimeResilienceDiagnosticsService } from '../services/monitoring/RealtimeResilienceDiagnosticsService';
import { ShipService } from '../services/ship/ShipService';
import { TeamService } from '../services/team/TeamService';
import { HealthStatus, SystemHealthCheck } from '../types/health';
import { getValidationErrors } from '../utils/validationState';
import { getWebSocketTransportReadinessSnapshot } from '../websocket/websocketServer';

import { BaseController } from './BaseController';

/**
 * Health Controller
 * Provides system health status endpoints
 * Extends BaseController for consistent error handling
 */
export class HealthController extends BaseController {
  // Service instances for health checks (lazy initialized)
  private fleetService?: FleetService;
  private activityService?: ActivityService;
  private teamService?: TeamService;
  private shipService?: ShipService;

  private getFleetService(): FleetService {
    if (!this.fleetService) {
      this.fleetService = new FleetService();
    }
    return this.fleetService;
  }

  private getActivityService(): ActivityService {
    if (!this.activityService) {
      this.activityService = new ActivityService();
    }
    return this.activityService;
  }

  private getTeamService(): TeamService {
    if (!this.teamService) {
      this.teamService = new TeamService();
    }
    return this.teamService;
  }

  private getShipService(): ShipService {
    if (!this.shipService) {
      this.shipService = new ShipService();
    }
    return this.shipService;
  }

  /**
   * Get system health status
   * GET /api/health
   */
  public getHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const health = await this.checkSystemHealth();
      const statusCode = health.status === 'OK' ? 200 : 503;

      // Return with appropriate status code
      res.status(statusCode).json(health);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  /**
   * Get detailed service health checks including cache metrics
   * GET /api/health/services
   */
  public getServiceHealth = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const healthChecks = await Promise.all([
        this.getFleetService().healthCheck(),
        this.getActivityService().healthCheck(),
        this.getTeamService().healthCheck(),
        this.getShipService().healthCheck(),
      ]);

      // Calculate summary statistics
      const summary = {
        total: healthChecks.length,
        healthy: healthChecks.filter(hc => hc.status === HealthStatus.HEALTHY).length,
        degraded: healthChecks.filter(hc => hc.status === HealthStatus.DEGRADED).length,
        unhealthy: healthChecks.filter(hc => hc.status === HealthStatus.UNHEALTHY).length,
      };

      // Determine overall system status
      let overallStatus = HealthStatus.HEALTHY;
      if (summary.unhealthy > 0) {
        overallStatus = HealthStatus.UNHEALTHY;
      } else if (summary.degraded > 0) {
        overallStatus = HealthStatus.DEGRADED;
      }

      const response: SystemHealthCheck = {
        status: overallStatus,
        timestamp: new Date(),
        services: healthChecks,
        summary,
      };

      const statusCode =
        overallStatus === HealthStatus.HEALTHY
          ? 200
          : overallStatus === HealthStatus.DEGRADED
            ? 200
            : 503;
      res.status(statusCode);

      return response;
    });
  };

  /**
   * Get cache statistics for all services
   * GET /api/health/cache
   */
  public getCacheStats = async (req: Request, res: Response): Promise<void> => {
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
          avgHitRate:
            cacheStats.length > 0
              ? Math.round(
                  (cacheStats.reduce((sum, s) => {
                    const hits = s.stats?.hits || 0;
                    const misses = s.stats?.misses || 0;
                    return sum + (hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0);
                  }, 0) /
                    cacheStats.length) *
                    100
                ) / 100
              : 0,
        },
      };
    });
  };

  /**
   * Get realtime IPC/WebSocket resilience diagnostics.
   * GET /api/health/realtime
   */
  public getRealtimeDiagnostics = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      realtimeResilienceDiagnosticsService.getDiagnostics()
    );
  };

  /**
   * Compact IPC health signal for operators and probes (ARCH-05).
   * GET /health/realtime/ipc — returns the coarse IPC health verdict with a
   * probe-friendly status code: 200 for healthy/degraded, 503 for unhealthy.
   */
  public getIpcHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const snapshot = realtimeResilienceDiagnosticsService.getIpcHealthSnapshot();
      res.status(snapshot.status === 'unhealthy' ? 503 : 200).json({
        timestamp: new Date().toISOString(),
        ...snapshot,
      });
    } catch {
      res.status(503).json({
        status: 'unhealthy',
        reasons: ['health_evaluation_failed'],
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Compact deployment readiness endpoint for probes/operators.
   * GET /ready
   */
  public getReadiness = async (req: Request, res: Response): Promise<void> => {
    try {
      const databaseReady = await this.isDatabaseReady();
      const transport = getWebSocketTransportReadinessSnapshot();

      const transportReady =
        transport !== null && transport.mode !== 'unknown' && transport.timedOut === false;

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
    } catch (error) {
      this.handleError(res, error);
    }
  };

  /**
   * Check all system components
   */
  private async checkSystemHealth(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    environment: string;
    database: string;
    discordBot: string;
    secretsManager: string;
    keyVault: string;
    validationErrors?: string[];
  }> {
    // Get validation errors from state
    const validationErrors = getValidationErrors();

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

    // Check database connection
    try {
      if (AppDataSource.isInitialized) {
        await AppDataSource.query('SELECT 1');
        health.database = 'connected';
      } else {
        health.database = 'not initialized';
        health.status = 'DEGRADED';
      }
    } catch (_error) {
      health.database = 'error';
      health.status = 'DEGRADED';
    }

    // Check Discord bot status
    try {
      if (process.env.DISCORD_BOT_TOKEN) {
        health.discordBot = 'configured';
      } else {
        health.discordBot = 'not configured';
      }
    } catch (_error) {
      health.discordBot = 'error';
    }

    // Check Secrets Manager status
    try {
      const secretsManager = SecretsManagerService.getInstance();
      const status = secretsManager.getStatus();

      if (status.initialized) {
        health.secretsManager = 'initialized';
        health.keyVault = status.keyVaultConfigured ? 'configured' : 'not configured';
      } else {
        health.secretsManager = 'not initialized';
        health.keyVault = 'not configured';
      }
    } catch (_error) {
      health.secretsManager = 'error';
      health.keyVault = 'error';
    }

    return health;
  }

  private async isDatabaseReady(): Promise<boolean> {
    if (!AppDataSource.isInitialized) {
      return false;
    }

    try {
      await AppDataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Phase 4 comprehensive system health
   * GET /api/health/system
   */
  public getSystemHealthV2 = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const health = await healthMonitor.getSystemHealth();

      const statusCode =
        health.status === NewHealthStatus.HEALTHY
          ? 200
          : health.status === NewHealthStatus.DEGRADED
            ? 200
            : 503;
      res.status(statusCode);

      return health;
    });
  };

  /**
   * Get health for specific component
   * GET /api/health/component/:name
   */
  public getComponentHealth = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const componentName = req.params.name;
      const health = await healthMonitor.getComponentHealth(componentName);

      if (!health) {
        res.status(404);
        return { error: 'Component not found' };
      }

      const statusCode =
        health.status === NewHealthStatus.HEALTHY
          ? 200
          : health.status === NewHealthStatus.DEGRADED
            ? 200
            : 503;
      res.status(statusCode);

      return health;
    });
  };
}
