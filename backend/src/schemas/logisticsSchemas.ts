import Joi from 'joi';

import { id, paginationKeys } from './common';

/**
 * Fleet Logistics Advanced Schemas
 * Validation schemas for advanced logistics features
 */

export const logisticsSchemas = {
  // Inventory Management
  createInventoryItem: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    category: Joi.string().trim().required(),
    quantity: Joi.number().integer().min(0).required(),
    unit: Joi.string().trim().required(),
    location: Joi.string().trim().optional(),
    minStock: Joi.number().integer().min(0).optional(),
    maxStock: Joi.number().integer().min(0).optional(),
    cost: Joi.number().min(0).optional(),
    supplierId: id.optional(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  updateInventoryItem: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    category: Joi.string().trim().optional(),
    quantity: Joi.number().integer().min(0).optional(),
    unit: Joi.string().trim().optional(),
    location: Joi.string().trim().optional(),
    minStock: Joi.number().integer().min(0).optional(),
    maxStock: Joi.number().integer().min(0).optional(),
    cost: Joi.number().min(0).optional(),
    supplierId: id.optional(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  inventoryQuery: Joi.object({
    category: Joi.string().trim().optional(),
    location: Joi.string().trim().optional(),
    lowStock: Joi.boolean().optional(),
    search: Joi.string().trim().optional(),
    ...paginationKeys,
  }),

  adjustStock: Joi.object({
    adjustment: Joi.number().integer().required(),
    reason: Joi.string().trim().required(),
    notes: Joi.string().trim().max(500).optional(),
  }),

  // Dashboard & Analytics
  dashboardQuery: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    organizationId: id.optional(),
    fleetId: id.optional(),
    timeRange: Joi.string().valid('day', 'week', 'month', 'quarter', 'year').optional(),
  }),

  // Alerts
  createAlert: Joi.object({
    type: Joi.string()
      .valid('low_stock', 'high_stock', 'maintenance_due', 'contract_expiring', 'custom')
      .required(),
    title: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().max(1000).optional(),
    severity: Joi.string().valid('info', 'warning', 'critical').required(),
    threshold: Joi.number().optional(),
    conditions: Joi.object().optional(),
    recipientIds: Joi.array().items(id).optional(),
    channels: Joi.array()
      .items(Joi.string().valid('email', 'sms', 'push', 'webhook'))
      .optional(),
  }),

  updateAlert: Joi.object({
    title: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().max(1000).optional(),
    severity: Joi.string().valid('info', 'warning', 'critical').optional(),
    isActive: Joi.boolean().optional(),
    threshold: Joi.number().optional(),
    conditions: Joi.object().optional(),
    recipientIds: Joi.array().items(id).optional(),
    channels: Joi.array()
      .items(Joi.string().valid('email', 'sms', 'push', 'webhook'))
      .optional(),
  }),

  alertQuery: Joi.object({
    type: Joi.string().optional(),
    severity: Joi.string().valid('info', 'warning', 'critical').optional(),
    isActive: Joi.boolean().optional(),
    isResolved: Joi.boolean().optional(),
    ...paginationKeys,
  }),

  alertAction: Joi.object({
    action: Joi.string().valid('acknowledge', 'resolve', 'dismiss', 'snooze').required(),
    notes: Joi.string().trim().max(500).optional(),
    snoozeUntil: Joi.date().iso().when('action', {
      is: 'snooze',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  }),

  // Integrations
  createIntegration: Joi.object({
    type: Joi.string().valid('api', 'webhook', 'sync', 'import', 'export').required(),
    name: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().max(1000).optional(),
    config: Joi.object({
      endpoint: Joi.string().uri().optional(),
      apiKey: Joi.string().optional(),
      headers: Joi.object().optional(),
      method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE').optional(),
      payload: Joi.object().optional(),
    }).optional(),
    schedule: Joi.string().optional(), // cron expression
    isActive: Joi.boolean().default(true),
  }),

  updateIntegration: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().max(1000).optional(),
    config: Joi.object().optional(),
    schedule: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
  }),

  syncRequest: Joi.object({
    direction: Joi.string().valid('import', 'export', 'bidirectional').required(),
    entities: Joi.array()
      .items(Joi.string().valid('users', 'organizations', 'fleets', 'ships', 'inventory', 'cargo'))
      .min(1)
      .required(),
    fullSync: Joi.boolean().default(false),
    dryRun: Joi.boolean().default(false),
  }),

  webhookTest: Joi.object({
    endpoint: Joi.string().uri().required(),
    method: Joi.string().valid('GET', 'POST').default('POST'),
    headers: Joi.object().optional(),
    payload: Joi.object().optional(),
  }),
};
