/**
 * RSI Sync Schedule Validation Schemas
 *
 * Joi validation schemas for RSI sync scheduling endpoints.
 * Phase 4: RSI Role Sync System - Automatic Scheduling & Audit Logging
 */

import Joi from 'joi';

export const rsiSyncScheduleSchemas = {
  /**
   * Schema for creating/updating a sync schedule
   */
  upsertSchedule: Joi.object({
    rsiOrgSid: Joi.string()
      .required()
      .min(1)
      .max(50)
      .pattern(/^[A-Za-z0-9_-]+$/)
      .messages({
        'string.pattern.base':
          'RSI Organization SID must contain only alphanumeric characters, underscores, and hyphens',
        'any.required': 'RSI Organization SID is required',
      }),

    guildId: Joi.string()
      .pattern(/^\d{17,20}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Guild ID must be a valid Discord snowflake ID',
      }),

    isEnabled: Joi.boolean().optional().default(false),

    intervalMinutes: Joi.number().integer().valid(360, 720, 1440).optional().default(360).messages({
      'any.only': 'Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)',
    }),

    notifyOnChanges: Joi.boolean().optional().default(true),

    notifyOnErrors: Joi.boolean().optional().default(true),

    notificationChannelId: Joi.string()
      .pattern(/^\d{17,20}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Notification channel ID must be a valid Discord snowflake ID',
      }),

    removeRolesOnLeave: Joi.boolean().optional().default(true),

    affiliateHandling: Joi.string()
      .valid('include', 'exclude', 'special_role')
      .optional()
      .default('include')
      .messages({
        'any.only': 'Affiliate handling must be one of: include, exclude, special_role',
      }),

    affiliateRoleId: Joi.string()
      .pattern(/^\d{17,20}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Affiliate role ID must be a valid Discord snowflake ID',
      }),

    maxConsecutiveFailures: Joi.number().integer().min(1).max(20).optional().default(5).messages({
      'number.min': 'Max consecutive failures must be at least 1',
      'number.max': 'Max consecutive failures cannot exceed 20',
    }),
  }),

  /**
   * Schema for updating interval
   */
  updateInterval: Joi.object({
    intervalMinutes: Joi.number().integer().valid(360, 720, 1440).required().messages({
      'any.only': 'Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)',
      'any.required': 'Interval is required',
    }),
  }),

  /**
   * Schema for audit log query parameters
   */
  auditLogQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional().default(20),

    offset: Joi.number().integer().min(0).optional().default(0),

    syncType: Joi.string().valid('manual', 'scheduled', 'webhook').optional(),

    hasErrors: Joi.boolean().optional(),

    fromDate: Joi.date().iso().optional(),

    toDate: Joi.date().iso().optional(),
  }),

  /**
   * Schema for resolving a review queue item
   */
  resolveReview: Joi.object({
    linkId: Joi.string().uuid().required().messages({
      'string.guid': 'linkId must be a valid UUID',
      'any.required': 'linkId is required',
    }),

    resolution: Joi.string()
      .valid('approved', 'rejected', 'resynced', 'removed')
      .required()
      .messages({
        'any.only': 'resolution must be one of: approved, rejected, resynced, removed',
        'any.required': 'resolution is required',
      }),

    adminNotes: Joi.string().max(500).optional().allow(''),

    updatedRank: Joi.string().max(50).optional().allow(''),
  }),

  /**
   * Schema for flagging a link for review
   */
  flagForReview: Joi.object({
    linkId: Joi.string().uuid().required().messages({
      'string.guid': 'linkId must be a valid UUID',
      'any.required': 'linkId is required',
    }),

    reason: Joi.string().max(100).required().messages({
      'any.required': 'reason is required',
    }),
  }),

  /**
   * Schema for manual assign request body
   */
  manualAssign: Joi.object({
    userId: Joi.string().uuid().required().messages({
      'string.guid': 'userId must be a valid UUID',
      'any.required': 'userId is required',
    }),

    rsiHandle: Joi.string().min(1).max(100).required().messages({
      'any.required': 'rsiHandle is required',
    }),

    discordUserId: Joi.string()
      .pattern(/^\d{17,20}$/)
      .optional()
      .allow(null),

    rank: Joi.string().max(50).optional(),
  }),

  /**
   * Schema for bulk verify request body
   */
  bulkVerify: Joi.object({
    linkIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required().messages({
      'array.min': 'At least one linkId is required',
      'array.max': 'Maximum 100 links per bulk operation',
      'any.required': 'linkIds array is required',
    }),
  }),

  /**
   * Schema for bulk assign request body
   */
  bulkAssign: Joi.object({
    entries: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().uuid().required(),
          rsiHandle: Joi.string().min(1).max(100).required(),
          discordUserId: Joi.string()
            .pattern(/^\d{17,20}$/)
            .optional()
            .allow(null),
        })
      )
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one entry is required',
        'array.max': 'Maximum 100 entries per bulk operation',
        'any.required': 'entries array is required',
      }),
  }),
};
