/**
 * Joi validation schemas for Team endpoints (Wave 2.6)
 */

import Joi from 'joi';

export const createTeam = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(1000).allow('', null).optional(),
  type: Joi.string().valid('squadron', 'division', 'crew', 'platoon', 'custom').default('squadron'),
  parentTeamId: Joi.string().uuid().allow(null).optional(),
  maxMembers: Joi.number().integer().min(1).max(1000).default(20),
  joinPolicy: Joi.string().valid('open', 'closed').default('closed'),
  emblem: Joi.string().uri().max(500).allow('', null).optional(),
});

export const updateTeam = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  type: Joi.string().valid('squadron', 'division', 'crew', 'platoon', 'custom').optional(),
  parentTeamId: Joi.string().uuid().allow(null).optional(),
  assignedShipId: Joi.string().max(255).allow(null).optional(),
  assignedDivisionId: Joi.string().uuid().allow(null).optional(),
  maxMembers: Joi.number().integer().min(1).max(1000).optional(),
  isActive: Joi.boolean().optional(),
  joinPolicy: Joi.string().valid('open', 'closed').optional(),
  emblem: Joi.string().uri().max(500).allow('', null).optional(),
}).min(1);

export const moveTeam = Joi.object({
  parentTeamId: Joi.string().uuid().allow(null).required(),
});

export const reorderTeams = Joi.object({
  orderedIds: Joi.array().items(Joi.string().uuid()).min(1).max(500).required(),
  parentTeamId: Joi.string().uuid().allow(null).optional(),
});

export const addTeamMember = Joi.object({
  userId: Joi.string().required(),
  role: Joi.string().valid('leader', 'officer', 'member').default('member'),
  rank: Joi.string().max(50).allow('', null).optional(),
  shipType: Joi.string().max(100).allow('', null).optional(),
  specialization: Joi.string().max(500).allow('', null).optional(),
  certifications: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  additionalRoles: Joi.array().items(Joi.string().max(100)).max(20).optional(),
});

const teamMemberStatsSchema = Joi.object({
  missionsCompleted: Joi.number().integer().min(0).optional(),
  hoursFlown: Joi.number().min(0).optional(),
  creditsEarned: Joi.number().min(0).optional(),
});

export const updateTeamMember = Joi.object({
  role: Joi.string().valid('leader', 'officer', 'member').optional(),
  status: Joi.string()
    .valid('active', 'inactive', 'pending', 'removed', 'on_leave', 'probation', 'deployed')
    .optional(),
  rank: Joi.string().max(50).allow('', null).optional(),
  shipType: Joi.string().max(100).allow('', null).optional(),
  specialization: Joi.string().max(500).allow('', null).optional(),
  stats: teamMemberStatsSchema.optional(),
  certifications: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  additionalRoles: Joi.array().items(Joi.string().max(100)).max(20).optional(),
  lastActiveAt: Joi.string().isoDate().allow(null).optional(),
  departureReason: Joi.string().max(1000).allow('', null).optional(),
}).min(1);
