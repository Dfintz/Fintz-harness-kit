import Joi from 'joi';

import { paginationKeys } from './common';

/**
 * Monitoring domain validation schemas
 * Covers: web vitals, error tracking, performance metrics
 */

export const monitoringSchemas = {
  // Track web vitals batch
  trackWebVitals: Joi.object({
    metrics: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().trim().min(1).max(50).required(),
          value: Joi.number().required(),
          rating: Joi.string().valid('good', 'needs-improvement', 'poor').required(),
          delta: Joi.number().required(),
          id: Joi.string().trim().max(100).required(),
          navigationType: Joi.string().trim().max(50).required(),
          timestamp: Joi.number().integer().required(),
          url: Joi.string().trim().max(2000).required(),
          userAgent: Joi.string().trim().max(500).required(),
        })
      )
      .min(1)
      .max(100)
      .required(),
  }),

  // Track frontend error
  trackError: Joi.object({
    error: Joi.object({
      name: Joi.string().trim().max(200).required(),
      message: Joi.string().trim().max(5000).required(),
      stack: Joi.string().trim().max(10000).optional(),
    }).required(),
    severity: Joi.string().valid('critical', 'error', 'warning', 'info').default('error'),
    context: Joi.object({
      userId: Joi.string().trim().optional(),
      organizationId: Joi.string().trim().optional(),
      page: Joi.string().trim().max(500).optional(),
      route: Joi.string().trim().max(500).optional(),
      component: Joi.string().trim().max(200).optional(),
      userAgent: Joi.string().trim().max(500).optional(),
      browserInfo: Joi.object({
        name: Joi.string().trim().optional(),
        version: Joi.string().trim().optional(),
        os: Joi.string().trim().optional(),
        platform: Joi.string().trim().optional(),
      }).optional(),
      screenResolution: Joi.string().trim().max(20).optional(),
      additionalData: Joi.object().optional(),
    }).optional(),
    timestamp: Joi.string().isoDate().optional(),
    tags: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  }),

  // Performance report query
  reportQuery: Joi.object({
    period: Joi.string().valid('1h', '6h', '24h', '7d', '30d').default('24h'),
    includeHistory: Joi.boolean().default(false),
  }),

  // Alert configuration
  alertConfig: Joi.object({
    metricName: Joi.string().trim().min(1).max(100).required(),
    threshold: Joi.number().required(),
    condition: Joi.string().valid('above', 'below', 'equals').required(),
    severity: Joi.string().valid('critical', 'warning', 'info').default('warning'),
    enabled: Joi.boolean().default(true),
    cooldownMinutes: Joi.number().integer().min(1).max(1440).default(15),
    notificationChannels: Joi.array()
      .items(Joi.string().valid('email', 'discord', 'webhook'))
      .min(1)
      .optional(),
  }),

  // Metrics query
  metricsQuery: Joi.object({
    ...paginationKeys,
    metricName: Joi.string().trim().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    rating: Joi.string().valid('good', 'needs-improvement', 'poor').optional(),
  }),
};
