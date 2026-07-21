import { Request, Response, Router } from 'express';

import { validateSchema } from '../../middleware/schemaValidation';
import { monitoringSchemas } from '../../schemas';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * POST /api/v2/metrics/web-vitals
 * Collect Web Vitals metrics from frontend
 */
router.post(
  '/web-vitals',
  validateSchema(monitoringSchemas.trackWebVitals, 'body'),
  async (req: Request, res: Response) => {
    try {
      const { metrics } = req.body;

      if (!metrics || !Array.isArray(metrics)) {
        return res.status(400).json({ error: 'Invalid metrics data' });
      }

      // Log metrics in development for debugging
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Received ${metrics.length} Web Vitals metrics`);
        metrics.forEach((metric: { name: string; value: number }) => {
          logger.debug(`Web Vital - ${metric.name}: ${metric.value}ms`);
        });
      }

      // In production, you would store these in a database or send to an analytics service
      // For now, we just acknowledge receipt
      res.status(200).json({
        success: true,
        received: metrics.length,
      });
    } catch (error) {
      logger.error('Error processing Web Vitals metrics:', error);
      res.status(500).json({ error: 'Failed to process metrics' });
    }
  }
);

export { router };
