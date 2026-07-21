import Joi from 'joi';

import { description, id } from './common';

/**
 * Additional domain validation schemas
 */

// Tournament schemas
export const tournamentSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(3).max(200).required(),
    description,
    tournamentType: Joi.string()
      .valid('single_elimination', 'double_elimination', 'round_robin', 'swiss')
      .required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    maxParticipants: Joi.number().integer().min(2).max(256).required(),
    entryFee: Joi.number().min(0).default(0),
    prizePool: Joi.number().min(0).default(0),
    rules: Joi.string().trim().max(5000).optional(),
  }),

  register: Joi.object({
    teamId: Joi.string().trim().optional(),
    players: Joi.array().items(id).min(1).max(10).required(),
  }),

  updateMatch: Joi.object({
    winnerId: id,
    score: Joi.object({
      team1: Joi.number().integer().min(0).required(),
      team2: Joi.number().integer().min(0).required(),
    }).required(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  param: Joi.object({ id }),
};

// Reputation schemas
export const reputationSchemas = {
  update: Joi.object({
    reputation: Joi.number().integer().min(-100).max(100).required(),
    reason: Joi.string().trim().min(10).max(500).required(),
  }),

  query: Joi.object({
    userId: id,
    organizationId: Joi.string().trim().optional(),
  }),
};

// Crew assignment schemas
export const crewSchemas = {
  create: Joi.object({
    shipId: id,
    missionId: id.optional(),
    crew: Joi.array()
      .items(
        Joi.object({
          userId: id,
          role: Joi.string().trim().min(1).max(50).required(),
          station: Joi.string().trim().optional(),
        })
      )
      .min(1)
      .max(20)
      .optional(),
    startDate: Joi.string().isoDate().optional(),
    endDate: Joi.string().isoDate().optional(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  addMember: Joi.object({
    userId: id,
    role: Joi.string().trim().min(1).max(50).required(),
    station: Joi.string().trim().optional(),
  }),

  // Body validation for v1 route: validates userId in request body
  removeMember: Joi.object({
    userId: id,
  }),

  // Path params validation for v2 route: validates both :id and :userId from URL
  removeCrewParams: Joi.object({
    id,
    userId: id,
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'completed').required(),
  }),

  param: Joi.object({ id }),
};

// Ship loan schemas
export const shipLoanSchemas = {
  request: Joi.object({
    shipId: id,
    shipName: Joi.string().trim().min(1).max(200).required(),
    borrowerId: id,
    borrowerName: Joi.string().trim().min(1).max(100).required(),
    duration: Joi.number().integer().min(1).max(365).required(), // days
    purpose: Joi.string().trim().min(10).max(1000).required(),
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('pending', 'approved', 'active', 'returned', 'declined').required(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  param: Joi.object({ id: id.description('Ship loan ID') }),
};

// Organization relationship schemas
export const orgRelationshipSchemas = {
  createRelationship: Joi.object({
    orgId: id.required(),
    targetOrgId: id.required(),
    relationship: Joi.string().valid('allied', 'neutral', 'hostile').required(),
  }),
  create: Joi.object({
    targetOrganizationId: id,
    type: Joi.string().valid('allied', 'neutral', 'hostile', 'partner', 'subsidiary').required(),
    description,
  }),

  update: Joi.object({
    type: Joi.string().valid('allied', 'neutral', 'hostile', 'partner', 'subsidiary').optional(),
    status: Joi.string().valid('active', 'inactive', 'terminated').optional(),
    description,
  }),

  param: Joi.object({ id }),
};

// Diplomacy schemas
export const diplomacySchemas = {
  proposal: Joi.object({
    targetOrgId: id,
    allianceType: Joi.string()
      .valid('trade', 'military', 'mutual_defense', 'non_aggression', 'full_alliance')
      .required(),
    terms: Joi.string().trim().max(5000).optional().allow(''),
    notes: Joi.string().trim().max(5000).optional().allow(''),
    name: Joi.string().trim().max(200).optional(),
  }),

  incident: Joi.object({
    description: Joi.string().trim().min(20).max(5000).required(),
    severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
    reportedBy: Joi.string().uuid().optional(),
  }),

  resolution: Joi.object({
    resolution: Joi.string().trim().min(20).max(5000).required(),
    status: Joi.string().valid('resolved', 'escalated', 'ongoing').required(),
  }),

  param: Joi.object({ id }),
};

// Cargo manifest schemas
export const cargoSchemas = {
  create: Joi.object({
    shipId: id,
    items: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().trim().required(),
          quantity: Joi.number().integer().min(1).required(),
          weight: Joi.number().min(0).optional(),
          value: Joi.number().min(0).optional(),
        })
      )
      .min(1)
      .max(100)
      .required(),
    destination: Joi.string().trim().required(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  update: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().trim().required(),
          quantity: Joi.number().integer().min(1).required(),
        })
      )
      .optional(),
    status: Joi.string().valid('loading', 'in_transit', 'delivered', 'cancelled').optional(),
  }),

  addItem: Joi.object({
    name: Joi.string().trim().required(),
    quantity: Joi.number().integer().min(1).required(),
    weight: Joi.number().min(0).optional(),
    value: Joi.number().min(0).optional(),
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('loading', 'in_transit', 'delivered', 'cancelled').required(),
    notes: Joi.string().trim().max(500).optional(),
  }),

  updateSharing: Joi.object({
    sharedWith: Joi.array().items(id).optional(),
    isPublic: Joi.boolean().optional(),
  }),

  param: Joi.object({ id }),
};
