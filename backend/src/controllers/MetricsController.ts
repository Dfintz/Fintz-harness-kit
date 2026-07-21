/**
 * Metrics Controller
 *
 * Handles Web Vitals and performance metrics from frontend
 */

import { Request, Response } from 'express';

import { trackEvent, trackMetric } from '../config/applicationInsights';
import { logger } from '../utils/logger';

/**
 * Web Vitals metric payload from frontend
 */
export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  timestamp: number;
  url: string;
  userAgent: string;
}

/**
 * Web Vitals batch payload
 */
interface WebVitalsBatchPayload {
  metrics: WebVitalsMetric[];
}

/**
 * Track Web Vitals metrics from frontend
 */
export const trackWebVitals = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload: WebVitalsBatchPayload = req.body;

    // Validate payload
    if (!payload.metrics || !Array.isArray(payload.metrics) || payload.metrics.length === 0) {
      res.status(400).json({ error: 'Invalid metrics payload' });
      return;
    }

    // Validate maximum batch size to prevent abuse
    const MAX_BATCH_SIZE = 100;
    if (payload.metrics.length > MAX_BATCH_SIZE) {
      res.status(400).json({
        error: 'Batch size exceeds maximum limit',
        maxBatchSize: MAX_BATCH_SIZE,
      });
      return;
    }

    // Get user context safely
    const userId = (req as Request & { user?: { id?: string } }).user?.id || 'anonymous';
    const organizationId = (req as Request & { organizationId?: string }).organizationId || 'none';

    // Track each metric
    for (const metric of payload.metrics) {
      // Validate individual metric
      if (!metric.name || typeof metric.value !== 'number') {
        logger.warn('Invalid Web Vitals metric in batch', { metric });
        continue;
      }

      // Safely parse URL
      let urlPathname = metric.url;
      try {
        urlPathname = new URL(metric.url).pathname;
      } catch (urlError) {
        logger.warn('Invalid URL in Web Vitals metric, using full URL', {
          url: metric.url,
          error: urlError,
        });
      }

      // Track metric value in Application Insights
      trackMetric(`webvitals.${metric.name.toLowerCase()}`, metric.value);

      // Track metric event with additional context
      trackEvent(`webvitals.${metric.name.toLowerCase()}.recorded`, {
        rating: metric.rating,
        navigationType: metric.navigationType,
        url: urlPathname, // Only track pathname for privacy
        value: String(metric.value),
        delta: String(metric.delta),
        metricId: metric.id,
        userAgent: metric.userAgent,
        userId,
        organizationId,
      });

      // Track rating distribution
      trackEvent(`webvitals.${metric.name.toLowerCase()}.${metric.rating}`, {
        value: String(metric.value),
        url: urlPathname,
      });
    }

    logger.info('Web Vitals metrics tracked successfully', {
      count: payload.metrics.length,
      userId,
      metrics: payload.metrics.map(m => `${m.name}:${m.rating}`).join(', '),
    });

    res.status(200).json({
      success: true,
      message: 'Metrics tracked successfully',
      count: payload.metrics.length,
    });
  } catch (error) {
    logger.error('Failed to track Web Vitals metrics', { error });
    res.status(500).json({ error: 'Failed to track metrics' });
  }
};

/**
 * Get aggregated Web Vitals statistics
 * This would typically query Application Insights or a metrics database
 */
export const getWebVitalsStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // This is a placeholder implementation
    // In production, this would query Application Insights Analytics API
    // or a dedicated metrics database

    res.status(200).json({
      message: 'Web Vitals statistics are tracked in Application Insights',
      note: 'Use Azure Portal or Application Insights Analytics API to view aggregated metrics',
      metrics: ['webvitals.lcp', 'webvitals.inp', 'webvitals.cls', 'webvitals.ttfb'],
    });
  } catch (error) {
    logger.error('Failed to get Web Vitals stats', { error });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
};
