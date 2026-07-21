import Joi from 'joi';

import { id, notes, paginationKeys } from './common';

/**
 * Shared Account Validation Schemas
 *
 * Validation for shared account management endpoints
 */

export const sharedAccountSchemas = {
  // Create shared account
  create: Joi.object({
    accountName: Joi.string().trim().min(1).max(200).required().messages({
      'string.empty': 'Account name is required',
      'any.required': 'Account name is required',
    }),
    accountUsername: Joi.string().trim().min(1).max(200).required().messages({
      'string.empty': 'Username is required',
      'any.required': 'Username is required',
    }),
    password: Joi.string().min(1).max(500).required().messages({
      'any.required': 'Password is required',
    }),
    organizationId: id,
    category: Joi.string().trim().max(100).optional(),
    description: Joi.string().trim().max(1000).optional().allow(''),
    url: Joi.string().uri().trim().max(500).optional().allow(null),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    expiresAt: Joi.date().iso().optional().allow(null),
    twoFactorSecret: Joi.string().trim().max(200).optional().allow('', null),
    notes,
  }),

  // Update shared account (without password)
  update: Joi.object({
    accountName: Joi.string().trim().min(1).max(200).optional(),
    accountUsername: Joi.string().trim().min(1).max(200).optional(),
    category: Joi.string().trim().max(100).optional(),
    description: Joi.string().trim().max(1000).optional().allow(''),
    url: Joi.string().uri().trim().max(500).optional().allow(null),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    expiresAt: Joi.date().iso().optional().allow(null),
    notes,
  }),

  // Update password
  updatePassword: Joi.object({
    password: Joi.string().min(1).max(500).required().messages({
      'any.required': 'Password is required',
    }),
  }),

  // Update 2FA secret
  update2FA: Joi.object({
    twoFactorSecret: Joi.string().trim().max(200).optional().allow('', null),
  }),

  // Grant permission
  grantPermission: Joi.object({
    accountId: id,
    userId: id,
    canView: Joi.boolean().default(true),
    canEdit: Joi.boolean().default(false),
    canViewPassword: Joi.boolean().default(false),
    canView2FA: Joi.boolean().default(false),
    expiresAt: Joi.date().iso().optional().allow(null),
    notes,
  }),

  // Bulk import
  bulkImport: Joi.object({
    organizationId: id,
    accounts: Joi.array()
      .items(
        Joi.object({
          accountName: Joi.string().trim().min(1).max(200).required(),
          accountUsername: Joi.string().trim().min(1).max(200).required(),
          password: Joi.string().min(1).max(500).required(),
          category: Joi.string().trim().max(100).optional(),
          description: Joi.string().trim().max(1000).optional().allow(''),
          url: Joi.string().uri().trim().max(500).optional().allow('', null),
          tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
          expiresAt: Joi.date().iso().optional().allow(null),
          twoFactorSecret: Joi.string().trim().max(200).optional().allow('', null),
        })
      )
      .min(1)
      .max(100)
      .required(),
  }),

  // Query parameters
  query: Joi.object({
    ...paginationKeys,
    category: Joi.string().trim().max(100).optional(),
    search: Joi.string().trim().max(200).optional(),
    tag: Joi.string().trim().max(50).optional(),
    includeExpired: Joi.boolean().optional(),
  }),

  // Route parameter schemas
  params: {
    organizationId: Joi.object({
      organizationId: id,
    }),
    accountId: Joi.object({
      accountId: id,
    }),
  },
};
