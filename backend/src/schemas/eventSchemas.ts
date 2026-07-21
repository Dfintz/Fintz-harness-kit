import Joi from 'joi';

import { description, id, paginationKeys } from './common';

/**
 * Event Validation Schemas
 *
 * Event routes use the Activity system but have slightly different requirements.
 * Events can use a simpler 'date' field instead of 'scheduledStartTime',
 * and 'activityType' is auto-set to 'EVENT'.
 */

export const eventSchemas = {
  // Create event - requires at least date OR scheduledStartTime
  create: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    description,
    // Events accept either 'date' or 'scheduledStartTime' - at least one required
    date: Joi.date().iso().optional(),
    scheduledStartTime: Joi.date().iso().optional(),
    estimatedDuration: Joi.number().integer().min(1).max(1440).optional().default(60), // default 1 hour
    maxParticipants: Joi.number().integer().min(1).max(100).optional(),
    requiredShips: Joi.array().items(Joi.string()).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard', 'expert').optional(),
    location: Joi.string().trim().max(200).optional(),
    requirements: Joi.string().trim().max(500).optional(),
    // activityType is auto-set to EVENT in the route handler
    activityType: Joi.string().optional(),
  }).or('date', 'scheduledStartTime'), // Require at least one date field

  // Update event
  update: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description,
    date: Joi.date().iso().optional(),
    scheduledStartTime: Joi.date().iso().optional(),
    estimatedDuration: Joi.number().integer().min(1).max(1440).optional(),
    maxParticipants: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid('draft', 'scheduled', 'active', 'completed', 'cancelled').optional(),
    location: Joi.string().trim().max(200).optional(),
  }),

  // Query filters
  query: Joi.object({
    ...paginationKeys,
    status: Joi.string().valid('draft', 'scheduled', 'active', 'completed', 'cancelled').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    organizationId: Joi.string().trim().optional(),
    activityType: Joi.string().optional(), // Allow override in query
  }),

  // Event ID param
  param: Joi.object({
    id,
  }),
};

/**
 * Helper function to normalize event date fields
 * Maps 'date' to 'scheduledStartTime' if present
 */
export const normalizeEventDate = (body: Record<string, unknown>): void => {
  if (body.date && !body.scheduledStartTime) {
    body.scheduledStartTime = body.date;
  }
};
