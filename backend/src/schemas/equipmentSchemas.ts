import Joi from 'joi';

import { description, paginationKeys } from './common';

/**
 * Equipment & gear management validation schemas
 * Covers: equipment CRUD, compatibility checks, transfers
 */
export const equipmentSchemas = {
  // Create equipment
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    type: Joi.string()
      .valid('weapon', 'armor', 'component', 'consumable', 'tool', 'attachment')
      .required(),
    rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').default('common'),
    description,
    shipId: Joi.string().trim().max(100).optional(),
    metadata: Joi.object().optional(),
  }),

  // Update equipment
  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    description,
    rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
    status: Joi.string().valid('available', 'equipped', 'damaged', 'destroyed').optional(),
    metadata: Joi.object().optional(),
  }).min(1),

  // Transfer equipment
  transfer: Joi.object({
    toUserId: Joi.string().trim().min(1).max(100).required(),
    reason: Joi.string().trim().max(500).optional(),
  }),

  // Compatibility query
  compatibilityQuery: Joi.object({
    shipId: Joi.string().trim().max(100).optional(),
  }),

  // Query params
  query: Joi.object({
    ...paginationKeys,
    type: Joi.string()
      .valid('weapon', 'armor', 'component', 'consumable', 'tool', 'attachment')
      .optional(),
    rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
    status: Joi.string().valid('available', 'equipped', 'damaged', 'destroyed').optional(),
  }),

  // Equipment ID param
  param: Joi.object({
    equipmentId: Joi.string().trim().min(1).max(100).required(),
  }),

  // User ID param
  userParam: Joi.object({
    userId: Joi.string().trim().min(1).max(100).required(),
  }),
};
