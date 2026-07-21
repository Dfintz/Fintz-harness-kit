import Joi from 'joi';

import { pagination } from './common';

/**
 * Jump Point validation schemas (v2)
 */

export const jumpPointSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    channelId: Joi.string().trim().min(1).max(100).required(),
    guildId: Joi.string().trim().min(1).max(100).required(),
    isPublic: Joi.boolean().default(true),
    password: Joi.string().trim().min(4).max(128).optional(),
    contentFilterEnabled: Joi.boolean().default(true),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    rateLimitConfig: Joi.object({
      maxMessagesPerMinute: Joi.number().integer().min(1).max(1000).optional(),
      maxMessagesPerHour: Joi.number().integer().min(1).max(10000).optional(),
    }).optional(),
    contentFilterEnabled: Joi.boolean().optional(),
    allowBotMessages: Joi.boolean().optional(),
    maxConnectedServers: Joi.number().integer().min(0).max(1000).optional(),
  }).min(1),

  activate: Joi.object({
    guildId: Joi.string().trim().min(1).max(100).required(),
    channelId: Joi.string().trim().min(1).max(100).required(),
    password: Joi.string().trim().min(4).max(128).optional(),
  }),

  deactivate: Joi.object({
    guildId: Joi.string().trim().min(1).max(100).required(),
    channelId: Joi.string().trim().min(1).max(100).required(),
  }),

  delete: Joi.object({
    guildId: Joi.string().trim().min(1).max(100).required(),
  }),

  linkByCode: Joi.object({
    code: Joi.string().trim().alphanum().min(6).max(8).required(),
    guildId: Joi.string().trim().min(1).max(100).required(),
    channelId: Joi.string().trim().min(1).max(100).required(),
    password: Joi.string().trim().min(4).max(128).optional(),
  }),

  ban: Joi.object({
    userId: Joi.string().trim().min(1).max(100).required(),
    username: Joi.string().trim().min(1).max(200).optional(),
    reason: Joi.string().trim().min(1).max(500).required(),
    expiresAt: Joi.date().iso().greater('now').optional(),
  }),

  unban: Joi.object({
    userId: Joi.string().trim().min(1).max(100).required(),
  }),

  analyticsQuery: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),

  query: pagination.append({
    guildId: Joi.string().trim().min(1).max(100).optional(),
  }),
};
