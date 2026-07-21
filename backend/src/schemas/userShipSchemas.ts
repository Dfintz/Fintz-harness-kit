import Joi from 'joi';

import { id, notes } from './common';

/**
 * User Ship Validation Schemas
 *
 * Validation for personal ship ownership and management
 */

export const userShipSchemas = {
  // Create user ship
  createUserShip: Joi.object({
    userId: id,
    shipId: id,
    shipName: Joi.string().trim().min(1).max(200).required(),
    customName: Joi.string().trim().max(200).optional().allow(null),
    status: Joi.string()
      .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
      .default('owned'),
    condition: Joi.string()
      .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
      .default('good'),
    acquiredDate: Joi.date().iso().optional().allow(null),
    acquiredPrice: Joi.number().min(0).max(999999999.99).optional().allow(null),
    acquiredCurrency: Joi.string().trim().max(10).optional().allow(null),
    insuranceLevel: Joi.string().trim().max(100).optional().allow(null),
    insuranceExpires: Joi.date().iso().optional().allow(null),
    location: Joi.string().trim().max(200).optional().allow(null),
    hangar: Joi.string().trim().max(200).optional().allow(null),
    description: Joi.string().trim().max(2000).optional().allow(null, ''),
    notes,
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    sharingLevel: Joi.string()
      .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
      .default('organization'),
    sharedWithUsers: Joi.array().items(id).optional(),
    modifications: Joi.object({
      components: Joi.array().items(Joi.string()).optional(),
      weapons: Joi.array().items(Joi.string()).optional(),
      upgrades: Joi.array().items(Joi.string()).optional(),
      customization: Joi.object().max(50).optional().allow(null),
    })
      .optional()
      .allow(null),
  }),

  // Update user ship
  updateUserShip: Joi.object({
    customName: Joi.string().trim().max(200).optional().allow(null),
    status: Joi.string()
      .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
      .optional(),
    condition: Joi.string()
      .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
      .optional(),
    insuranceLevel: Joi.string().trim().max(100).optional().allow(null),
    insuranceExpires: Joi.date().iso().optional().allow(null),
    location: Joi.string().trim().max(200).optional().allow(null),
    hangar: Joi.string().trim().max(200).optional().allow(null),
    description: Joi.string().trim().max(2000).optional().allow(null, ''),
    notes,
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    sharingLevel: Joi.string()
      .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
      .optional(),
    useCustomVisibility: Joi.boolean().optional(),
    sharedWithUsers: Joi.array().items(id).optional(),
    isActive: Joi.boolean().optional(),
    flightHours: Joi.number().integer().min(0).optional(),
    missionsCompleted: Joi.number().integer().min(0).optional(),
    totalEarnings: Joi.number().min(0).max(9999999999999.99).optional(),
    modifications: Joi.object({
      components: Joi.array().items(Joi.string()).optional(),
      weapons: Joi.array().items(Joi.string()).optional(),
      upgrades: Joi.array().items(Joi.string()).optional(),
      customization: Joi.object().max(50).optional().allow(null),
    })
      .optional()
      .allow(null),
    erkulLoadoutUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .trim()
      .max(500)
      .optional()
      .allow(null, ''),
  }),

  // Loan ship
  loanShip: Joi.object({
    loanedTo: id,
    loanExpires: Joi.date().iso().min('now').required(),
    notes,
  }),

  // Query filters
  query: Joi.object({
    status: Joi.string()
      .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
      .optional(),
    condition: Joi.string()
      .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
      .optional(),
    sharingLevel: Joi.string()
      .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
      .optional(),
    useCustomVisibility: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};
