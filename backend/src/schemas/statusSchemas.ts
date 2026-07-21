import Joi from 'joi';

/**
 * Validation schemas for status update endpoints on fleet logistics,
 * cargo manifests, and mining operations.
 *
 * Prevents invalid enum values from reaching the service layer (B6 fix).
 */

export const logisticsStatusSchema = Joi.object({
  status: Joi.string()
    .valid('planning', 'ready', 'in_progress', 'completed', 'cancelled')
    .required(),
});

export const manifestStatusSchema = Joi.object({
  status: Joi.string().valid('loading', 'in_transit', 'delivered', 'cancelled').required(),
});

export const miningStatusSchema = Joi.object({
  status: Joi.string().valid('planned', 'in_progress', 'completed', 'cancelled').required(),
});
