import Joi from 'joi';

import { coordinates, id, notes, paginationKeys } from './common';

/**
 * Mining operation validation schemas
 */

export const miningSchemas = {
  // Create mining operation
  create: Joi.object({
    location: Joi.string().trim().min(1).max(200).required(),
    coordinates: coordinates.optional(),
    resourceType: Joi.string().trim().min(1).max(100).required(),
    estimatedYield: Joi.number().min(0).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard', 'extreme').optional(),
    requiredShips: Joi.array().items(Joi.string()).optional(),
    maxParticipants: Joi.number().integer().min(1).max(50).optional(),
    scheduledStart: Joi.date().iso().optional(),
    notes,
  }),

  // Update mining operation
  update: Joi.object({
    location: Joi.string().trim().min(1).max(200).optional(),
    resourceType: Joi.string().trim().min(1).max(100).optional(),
    status: Joi.string().valid('planned', 'active', 'completed', 'cancelled').optional(),
    actualYield: Joi.number().min(0).optional(),
    notes,
  }),

  // Record yield
  recordYield: Joi.object({
    resource: Joi.string().trim().required(),
    quantity: Joi.number().min(0).required(),
    quality: Joi.string().valid('low', 'medium', 'high', 'excellent').optional(),
    participantId: id,
  }),

  // Query filters
  query: Joi.object({
    ...paginationKeys,
    status: Joi.string().valid('planned', 'active', 'completed', 'cancelled').optional(),
    resourceType: Joi.string().trim().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),

  // Mining operation ID param
  param: Joi.object({
    id,
  }),

  createOperation: Joi.object({
    location: Joi.string().trim().required(),
    resourceType: Joi.string().trim().required(),
    shipId: id.required(),
    crewSize: Joi.number().integer().min(1).optional(),
  }),

  addCrewMember: Joi.object({
    userId: id.required(),
    role: Joi.string().required(),
  }),

  updateResources: Joi.object({
    resources: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().required(),
          quantity: Joi.number().min(0).required(),
          value: Joi.number().min(0).optional(),
        })
      )
      .required(),
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('planned', 'active', 'completed', 'cancelled').required(),
    notes: Joi.string().max(500).optional(),
  }),
};
