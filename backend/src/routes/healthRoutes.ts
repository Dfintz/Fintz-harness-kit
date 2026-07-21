import { Application } from 'express';

import { HealthController } from '../controllers/healthController';
import { integrationStatusService } from '../services/monitoring/IntegrationStatusService';

// Lazy initialization to prevent "No metadata" errors
let healthController: HealthController;
const getHealthController = (): HealthController => {
  if (!healthController) {
    healthController = new HealthController();
  }
  return healthController;
};

export const setHealthRoutes = (app: Application): void => {
  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check endpoint
   *     description: Returns the health status of the service including database and Discord bot connectivity
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: OK
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 uptime:
   *                   type: number
   *                   description: Process uptime in seconds
   *                 database:
   *                   type: string
   *                   example: connected
   *                 discordBot:
   *                   type: string
   *                   example: configured
   *       503:
   *         description: Service is degraded or unhealthy
   */
  app.get('/health', getHealthController().getHealth.bind(healthController));

  /**
   * @swagger
   * /ready:
   *   get:
   *     summary: Deployment readiness endpoint
   *     description: Compact readiness contract for probes/operators with database and websocket transport readiness
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is ready to receive traffic
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   enum: [ready, not_ready]
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 checks:
   *                   type: object
   *       503:
   *         description: Service is not ready to receive traffic
   */
  app.get('/ready', getHealthController().getReadiness.bind(healthController));

  /**
   * @swagger
   * /health/services:
   *   get:
   *     summary: Detailed service health checks
   *     description: Returns health status for all cached services including cache metrics
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service health checks completed successfully
   */
  app.get('/health/services', getHealthController().getServiceHealth.bind(healthController));

  /**
   * @swagger
   * /health/cache:
   *   get:
   *     summary: Cache statistics
   *     description: Returns detailed cache performance metrics for all services
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Cache statistics retrieved successfully
   */
  app.get('/health/cache', getHealthController().getCacheStats.bind(healthController));

  /**
   * @swagger
   * /health/realtime:
   *   get:
   *     summary: Realtime IPC/WebSocket resilience diagnostics
   *     description: Returns in-memory diagnostics counters for bot IPC and websocket coalescing/adapter behavior
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Realtime diagnostics retrieved successfully
   *       401:
   *         description: Authentication required for realtime diagnostics
   */
  app.get(
    '/health/realtime',
    (req, res, next) => {
      // Restrict realtime diagnostics to admin users or internal requests
      const authHeader = req.headers.authorization;
      const isInternal = req.ip === '127.0.0.1' || req.ip === '::1';
      if (!isInternal && !authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required for realtime diagnostics' });
        return;
      }
      next();
    },
    getHealthController().getRealtimeDiagnostics.bind(healthController)
  );

  /**
   * @swagger
   * /health/realtime/ipc:
   *   get:
   *     summary: Compact bot IPC health signal
   *     description: >
   *       Coarse IPC health verdict (healthy / degraded / unhealthy) for operators
   *       and probes, derived from the realtime resilience counters. Returns HTTP
   *       200 for healthy/degraded and 503 for unhealthy so monitors can alert on
   *       the status code. Exposes only the verdict, machine-readable reasons, and
   *       aggregate signals (no request payloads or error detail).
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: IPC is healthy or degraded
   *       503:
   *         description: IPC is unhealthy
   */
  app.get('/health/realtime/ipc', getHealthController().getIpcHealth.bind(healthController));

  /**
   * @swagger
   * /health/system:
   *   get:
   *     summary: Comprehensive system health (Phase 4)
   *     description: Returns comprehensive health status using the new Phase 4 health monitoring system
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: System health retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   enum: [healthy, degraded, unhealthy, unknown]
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 uptime:
   *                   type: number
   *                 version:
   *                   type: string
   *                 components:
   *                   type: array
   *                 summary:
   *                   type: object
   *       503:
   *         description: System is unhealthy
   */
  app.get(
    '/health/system',
    (req, res, next) => {
      // Restrict system health to admin users or internal requests
      const authHeader = req.headers.authorization;
      const isInternal = req.ip === '127.0.0.1' || req.ip === '::1';
      if (!isInternal && !authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required for system health' });
        return;
      }
      next();
    },
    getHealthController().getSystemHealthV2.bind(healthController)
  );

  /**
   * @swagger
   * /health/component/{name}:
   *   get:
   *     summary: Get health for specific component
   *     description: Returns health status for a specific component (database, memory, disk, or registered service)
   *     tags: [Health]
   *     parameters:
   *       - in: path
   *         name: name
   *         required: true
   *         schema:
   *           type: string
   *         description: Component name (database, memory, disk, or service name)
   *     responses:
   *       200:
   *         description: Component health retrieved successfully
   *       404:
   *         description: Component not found
   *       503:
   *         description: Component is unhealthy
   */
  app.get(
    '/health/component/:name',
    getHealthController().getComponentHealth.bind(healthController)
  );

  /**
   * @swagger
   * /health/integrations:
   *   get:
   *     summary: Integration status dashboard
   *     description: Returns health status for all external integrations and third-party services
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Integration health dashboard retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 overallStatus:
   *                   type: string
   *                   enum: [healthy, degraded, unhealthy, unknown]
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 integrations:
   *                   type: array
   *                 summary:
   *                   type: object
   */
  app.get('/health/integrations', async (_req, res) => {
    try {
      const healthSummary = await integrationStatusService.getSystemHealth();
      res.status(200).json(healthSummary);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get integration status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * @swagger
   * /health/integrations/refresh:
   *   post:
   *     summary: Force refresh integration health status
   *     description: Invalidates cache and refreshes all integration health checks
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Integration health refreshed successfully
   */
  app.post('/health/integrations/refresh', async (_req, res) => {
    try {
      const healthSummary = await integrationStatusService.refreshHealth();
      res.status(200).json({
        message: 'Integration health refreshed',
        ...healthSummary,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to refresh integration status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
