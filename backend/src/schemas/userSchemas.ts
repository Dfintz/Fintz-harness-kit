import Joi from 'joi';

import { email, id, optionalEmail, paginationKeys, uuid } from './common';

/**
 * User validation schemas
 */

export const userSchemas = {
  // Create user
  create: Joi.object({
    id,
    username: Joi.string().trim().min(3).max(50).required(),
    email,
    discordId: Joi.string().trim().required(),
    role: Joi.string().valid('user', 'admin', 'moderator').default('user'),
  }),

  // Update user
  update: Joi.object({
    username: Joi.string().trim().min(3).max(50).optional(),
    email: optionalEmail,
    role: Joi.string().valid('user', 'admin', 'moderator').optional(),
    activeOrgId: Joi.string().trim().optional(),
  }),

  // Update current user profile via /users/me
  updateCurrentUser: Joi.object({
    displayName: Joi.string().trim().min(1).max(100).allow('').optional(),
    bio: Joi.string().trim().max(2000).allow('').optional(),
    avatar: Joi.string().trim().max(500_000).allow('').optional(),
    activeOrgId: Joi.forbidden().messages({
      'any.unknown':
        'activeOrgId cannot be updated via this endpoint. Use /api/v2/users/me/active-organization instead',
      'any.forbidden':
        'activeOrgId cannot be updated via this endpoint. Use /api/v2/users/me/active-organization instead',
    }),
  }),

  // Switch active organization via /users/me/active-organization
  switchActiveOrganization: Joi.object({
    organizationId: uuid,
  }),

  // Login
  login: Joi.object({
    email,
    password: Joi.string().min(8).required(),
  }),

  // Register
  register: Joi.object({
    username: Joi.string().trim().min(3).max(50).required(),
    email,
    password: Joi.string().min(8).max(128).required(),
    discordId: Joi.string().trim().optional(),
  }),

  // Query filters
  query: Joi.object({
    ...paginationKeys,
    role: Joi.string().valid('user', 'admin', 'moderator').optional(),
    search: Joi.string().trim().max(100).optional(),
  }),

  // User ID param
  param: Joi.object({
    id,
  }),

  // User preferences
  updatePreferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    language: Joi.string().valid('en', 'es', 'fr', 'de').optional(),
    notifications: Joi.boolean().optional(),
    timezone: Joi.string().optional(),
  }),

  // Password reset/change
  passwordReset: Joi.object({
    email: email.optional(),
    token: Joi.string().trim().optional(),
    password: Joi.string().min(8).max(128).optional(),
  }),

  passwordChange: Joi.object({
    currentPassword: Joi.string().min(8).required(),
    newPassword: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
  }),

  // User search
  searchQuery: Joi.object({
    query: Joi.string().trim().min(1).max(200).required(),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),

  browseCommunityMembers: Joi.object({
    search: Joi.string().trim().max(100).allow(''),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    sortBy: Joi.string().valid('createdAt', 'username', 'displayName').default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
    rsiVerifiedOnly: Joi.boolean().default(false),
    hasOrganization: Joi.boolean().default(false),
  }),
};
