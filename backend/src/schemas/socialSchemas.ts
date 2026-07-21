import Joi from 'joi';

import { description, id, notes, paginationKeys } from './common';

/**
 * Social domain validation schemas
 * Covers: matchmaking preferences, LFG sessions, social groups
 */

export const socialSchemas = {
  // Set/update gameplay preferences
  setPreferences: Joi.object({
    activityPreferences: Joi.object()
      .pattern(Joi.string(), Joi.number().min(0).max(100))
      .required(),
    experienceLevels: Joi.object()
      .pattern(Joi.string(), Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert'))
      .optional(),
    playstyles: Joi.array()
      .items(
        Joi.string().valid('casual', 'competitive', 'roleplay', 'exploration', 'social', 'hardcore')
      )
      .min(1)
      .required(),
    preferredGroupSizeMin: Joi.number().integer().min(1).max(50).optional(),
    preferredGroupSizeMax: Joi.number().integer().min(1).max(50).optional(),
    requiresVoiceChat: Joi.boolean().optional(),
    prefersSilentPlay: Joi.boolean().optional(),
    timezone: Joi.string().trim().max(50).optional(),
    availability: Joi.array()
      .items(
        Joi.string().valid(
          'weekday_morning',
          'weekday_afternoon',
          'weekday_evening',
          'weekday_night',
          'weekend_morning',
          'weekend_afternoon',
          'weekend_evening',
          'weekend_night'
        )
      )
      .optional(),
    preferredRoles: Joi.array().items(Joi.string().trim().max(50)).optional(),
    languages: Joi.array().items(Joi.string().trim().max(30)).min(1).optional(),
    combatSkill: Joi.number().integer().min(0).max(100).optional(),
    pilotingSkill: Joi.number().integer().min(0).max(100).optional(),
    tradingSkill: Joi.number().integer().min(0).max(100).optional(),
    miningSkill: Joi.number().integer().min(0).max(100).optional(),
    allowCrossOrgMatching: Joi.boolean().optional(),
    onlyMatchWithVerified: Joi.boolean().optional(),
    minReputationScore: Joi.number().integer().min(0).max(100).optional(),
  }),

  // Find matches query
  findMatchesQuery: Joi.object({
    activityType: Joi.string().trim().max(50).optional(),
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),

  // Track session join
  trackJoin: Joi.object({
    sessionId: id,
    activityType: Joi.string().trim().max(50).optional(),
  }),

  // LFG session creation
  createLfgSession: Joi.object({
    organizationId: Joi.string().trim().optional(),
    activityType: Joi.string().trim().min(1).max(100).required(),
    title: Joi.string().trim().min(3).max(200).required(),
    description,
    maxPlayers: Joi.number().integer().min(2).max(50).required(),
    minPlayers: Joi.number().integer().min(1).max(50).optional(),
    scheduledTime: Joi.date().iso().optional(),
    requirements: Joi.object({
      minLevel: Joi.number().integer().min(0).optional(),
      requiredRoles: Joi.array().items(Joi.string().trim()).optional(),
      voiceRequired: Joi.boolean().optional(),
    }).optional(),
    tags: Joi.array().items(Joi.string().trim().max(30)).optional(),
    metadata: Joi.object().optional(),
    ttlSeconds: Joi.number().integer().min(60).max(86400).optional(),
    notes,
  }),

  // Update LFG session
  updateLfgSession: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description,
    maxPlayers: Joi.number().integer().min(2).max(50).optional(),
    scheduledTime: Joi.date().iso().optional(),
    status: Joi.string().valid('open', 'in_progress', 'completed', 'cancelled').optional(),
    notes,
  }),

  // Social group creation
  createGroup: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    description,
    maxMembers: Joi.number().integer().min(2).max(100).optional(),
    isPrivate: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().trim().max(30)).optional(),
  }),

  // Query params
  query: Joi.object({
    ...paginationKeys,
    activityType: Joi.string().trim().optional(),
    status: Joi.string().trim().optional(),
    organizationId: Joi.string().trim().optional(),
    minAvailableSlots: Joi.number().integer().min(1).optional(),
    tags: Joi.string().trim().optional(),
    hostUserId: Joi.string().trim().optional(),
  }),

  param: Joi.object({ id }),
};
