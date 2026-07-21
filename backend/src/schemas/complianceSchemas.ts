import Joi from 'joi';

import { id, paginationKeys } from './common';

/**
 * Compliance domain validation schemas
 * Covers: incident response, license tracking, data retention
 */

export const complianceSchemas = {
  // License export query
  licenseExport: Joi.object({
    format: Joi.string().valid('json', 'csv', 'text').default('json'),
    includeDevDependencies: Joi.boolean().default(false),
    filter: Joi.string().valid('all', 'problematic', 'unknown').default('all'),
  }),

  // Data retention policy
  createRetentionPolicy: Joi.object({
    dataType: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .messages({ 'string.empty': 'Data type is required' }),
    retentionDays: Joi.number()
      .integer()
      .min(1)
      .max(3650)
      .required()
      .messages({ 'number.base': 'Retention days must be a number' }),
    action: Joi.string()
      .valid('delete', 'anonymize', 'archive')
      .required()
      .messages({ 'any.only': 'Action must be one of: delete, anonymize, archive' }),
    enabled: Joi.boolean().default(true),
    description: Joi.string().trim().max(500).optional(),
    excludePatterns: Joi.array().items(Joi.string().trim()).optional(),
  }),

  // Update retention policy
  updateRetentionPolicy: Joi.object({
    retentionDays: Joi.number().integer().min(1).max(3650).optional(),
    action: Joi.string().valid('delete', 'anonymize', 'archive').optional(),
    enabled: Joi.boolean().optional(),
    description: Joi.string().trim().max(500).optional(),
    excludePatterns: Joi.array().items(Joi.string().trim()).optional(),
  }),

  // Execute retention cleanup
  executeRetention: Joi.object({
    dataType: Joi.string().trim().min(1).max(100).optional(),
    dryRun: Joi.boolean().default(true),
    maxRecords: Joi.number().integer().min(1).max(100000).default(10000),
  }),

  // Retention query
  retentionQuery: Joi.object({
    ...paginationKeys,
    dataType: Joi.string().trim().optional(),
    enabled: Joi.boolean().optional(),
  }),

  // Compliance audit query
  auditQuery: Joi.object({
    ...paginationKeys,
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    severity: Joi.string().valid('critical', 'high', 'medium', 'low').optional(),
    status: Joi.string().valid('INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED').optional(),
  }),

  param: Joi.object({ id }),
};
