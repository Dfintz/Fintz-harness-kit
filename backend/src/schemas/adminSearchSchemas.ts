import Joi from 'joi';

import { pageSizeKeysWith } from './common';

/**
 * Validation schemas for admin search endpoints.
 * POST /api/v2/admin/security/search
 * POST /api/v2/admin/users/search
 */

export const adminSearchSchemas = {
  /**
   * POST /api/v2/admin/security/search
   * Search security events by criteria
   */
  securitySearch: Joi.object({
    type: Joi.string()
      .valid(
        'login_success',
        'login_failure',
        'logout',
        'password_change',
        'password_reset',
        'permission_granted',
        'permission_denied',
        'role_changed',
        'data_accessed',
        'data_modified',
        'data_deleted',
        'data_exported',
        'brute_force_attempt',
        'suspicious_activity',
        'api_rate_limit_exceeded',
        'invalid_token',
        'admin_action',
        'feature_flag_changed',
        'configuration_changed'
      )
      .optional()
      .messages({
        'any.only': 'Invalid security event type',
      }),
    severity: Joi.string().valid('info', 'warning', 'critical').optional().messages({
      'any.only': 'Severity must be info, warning, or critical',
    }),
    userHash: Joi.string().trim().max(256).optional(),
    organizationHash: Joi.string().trim().max(256).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
      'date.min': 'endDate must be after startDate',
    }),
  }),

  /**
   * POST /api/v2/admin/users/search
   * Search users with filtering criteria
   */
  userSearch: Joi.object({
    query: Joi.string().trim().max(200).optional(),
    role: Joi.string().valid('admin', 'user', 'moderator', 'member', 'guest').optional(),
    status: Joi.string().valid('active', 'disabled', 'suspended').optional(),
    ...pageSizeKeysWith(20),
    sortBy: Joi.string().valid('username', 'email', 'createdAt', 'role').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  }),
};
