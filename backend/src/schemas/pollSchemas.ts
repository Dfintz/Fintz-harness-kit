import Joi from 'joi';

import { paginationKeys } from './common';

/**
 * Poll validation schemas
 *
 * Supports poll types: single_choice, multiple_choice, ranked, approval
 */

const pollTypes = ['single_choice', 'multiple_choice', 'ranked', 'approval'];
const pollVisibilities = ['public', 'members_only', 'role_restricted'];
const pollStatuses = ['draft', 'active', 'closed', 'cancelled'];

const pollOptionSchema = Joi.object({
  id: Joi.string().trim().min(1).max(100).required(),
  label: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(500).optional(),
  sortOrder: Joi.number().integer().min(0).required(),
});

export const pollSchemas = {
  // Create poll
  create: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    description: Joi.string().trim().max(2000).optional(),
    pollType: Joi.string()
      .valid(...pollTypes)
      .required(),
    visibility: Joi.string()
      .valid(...pollVisibilities)
      .default('members_only'),
    options: Joi.array().items(pollOptionSchema).min(2).max(50).required(),
    isAnonymous: Joi.boolean().default(false),
    maxSelections: Joi.number().integer().min(1).max(50).default(1),
    endsAt: Joi.date().iso().min('now').optional(),
    allowedRoles: Joi.array().items(Joi.string().trim().max(100)).max(20).optional(),
    status: Joi.string().valid('draft', 'active').default('active'),
  }),

  // Update poll
  update: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description: Joi.string().trim().max(2000).optional().allow(null),
    visibility: Joi.string()
      .valid(...pollVisibilities)
      .optional(),
    options: Joi.array().items(pollOptionSchema).min(2).max(50).optional(),
    isAnonymous: Joi.boolean().optional(),
    maxSelections: Joi.number().integer().min(1).max(50).optional(),
    endsAt: Joi.date().iso().min('now').optional().allow(null),
    allowedRoles: Joi.array().items(Joi.string().trim().max(100)).max(20).optional().allow(null),
  }),

  // Cast vote
  vote: Joi.object({
    votes: Joi.array()
      .items(
        Joi.object({
          optionId: Joi.string().trim().min(1).max(100).required(),
          rank: Joi.number().integer().min(1).optional(),
        })
      )
      .min(1)
      .max(50)
      .required(),
  }),

  // Query parameters for list
  query: Joi.object({
    ...paginationKeys,
    status: Joi.string()
      .valid(...pollStatuses)
      .optional(),
    pollType: Joi.string()
      .valid(...pollTypes)
      .optional(),
    createdBy: Joi.string().trim().max(100).optional(),
    searchTerm: Joi.string().trim().max(200).optional(),
    sortBy: Joi.string().valid('createdAt', 'title', 'endsAt', 'status').default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').uppercase().default('DESC'),
  }),

  // Param validation
  param: Joi.object({
    pollId: Joi.string().uuid().required(),
  }),

  // Mirror param validation
  mirrorParam: Joi.object({
    pollId: Joi.string().uuid().required(),
    mirrorId: Joi.string().uuid().required(),
  }),

  // Mirror poll to a guild channel
  mirrorToGuild: Joi.object({
    guildId: Joi.string().trim().min(1).max(20).required(),
    channelId: Joi.string().trim().min(1).max(20).required(),
  }),

  // Mirror poll to all federation guilds
  mirrorToFederation: Joi.object({
    federationId: Joi.string().uuid().required(),
    channelId: Joi.string().trim().min(1).max(20).optional(),
  }),
};
