import { Request, Response, Router } from 'express';

import { requireAdmin } from '../../middleware/adminAuth';
import { authenticateToken } from '../../middleware/auth';
import { adminReadRateLimiter } from '../../middleware/rateLimiting';
import { IntegrationStatusService } from '../../services/monitoring/IntegrationStatusService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Integration status interface
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface IntegrationStatus {
  name: string;
  status: HealthStatus | 'unknown';
  latency?: number;
  lastChecked: Date;
  details?: Record<string, unknown>;
  message?: string;
}

/**
 * Integration health dashboard response
 */
interface IntegrationHealthDashboard {
  overall: HealthStatus;
  timestamp: Date;
  integrations: IntegrationStatus[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

// Health checks delegated to IntegrationStatusService
// Individual service checks are implemented there with proper circuit breaker integration

/**
 * GET /api/admin/integrations/health
 * Get integration health dashboard
 */
router.get(
  '/health',
  authenticateToken,
  adminReadRateLimiter,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      // Get system health from IntegrationStatusService
      const integrationStatusService = IntegrationStatusService.getInstance();
      const systemHealth = await integrationStatusService.getSystemHealth();

      // Convert IntegrationHealth[] to IntegrationStatus[] format for response
      const integrations = systemHealth.integrations.map(health => ({
        name: health.name,
        status: health.status.toLowerCase() as HealthStatus | 'unknown',
        latency: health.responseTime,
        lastChecked: health.lastCheck,
        details: health.metrics,
        message: health.errorMessage,
      }));

      // Calculate summary
      const summary = {
        total: integrations.length,
        healthy: integrations.filter(i => i.status === 'healthy').length,
        degraded: integrations.filter(i => i.status === 'degraded').length,
        unhealthy: integrations.filter(i => i.status === 'unhealthy').length,
      };

      // Determine overall status
      let overall: HealthStatus = 'healthy';
      if (summary.unhealthy > 0) {
        overall = 'unhealthy';
      } else if (summary.degraded > 0) {
        overall = 'degraded';
      }

      const dashboard: IntegrationHealthDashboard = {
        overall,
        timestamp: new Date(),
        integrations,
        summary,
      };

      logger.info('Integration health dashboard requested', { overall, summary });

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Error getting integration health dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get integration health dashboard',
      });
    }
  }
);

/**
 * GET /api/admin/integrations/health/:integration
 * Get specific integration health
 */
router.get(
  '/health/:integration',
  authenticateToken,
  adminReadRateLimiter,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { integration } = req.params;

      // Get system health from IntegrationStatusService
      const integrationStatusService = IntegrationStatusService.getInstance();
      const systemHealth = await integrationStatusService.getSystemHealth();

      // Find specific integration by name
      const integrationsMap: Record<string, string> = {
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
      const health = systemHealth.integrations.find(h =>
        h.name.toLowerCase().includes(searchName.toLowerCase())
      );

      if (!health) {
        res.status(404).json({
          success: false,
          error: `Integration not found: ${integration}`,
        });
        return;
      }

      const result: IntegrationStatus = {
        name: health.name,
        status: health.status.toLowerCase() as HealthStatus | 'unknown',
        latency: health.responseTime,
        lastChecked: health.lastCheck,
        details: health.metrics,
        message: health.errorMessage,
      };

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error getting integration health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get integration health',
      });
    }
  }
);
