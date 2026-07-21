/**
 * Title & Badge validation schemas
 */
import Joi from 'joi';

import { description, pagination } from './common';

export const achievementSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    type: Joi.string().valid('title', 'badge').optional(),
    description,
    category: Joi.string().trim().max(50).optional(),
    rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
    icon: Joi.string().uri().max(500).allow('', null).optional(),
    metadata: Joi.object().optional(),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    type: Joi.string().valid('title', 'badge').optional(),
    description,
    category: Joi.string().trim().max(50).optional(),
    rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
    icon: Joi.string().uri().max(500).allow('', null).optional(),
    metadata: Joi.object().optional(),
    isActive: Joi.boolean().optional(),
  }),

  award: Joi.object({
    userId: Joi.string().trim().required(),
  }),

  revoke: Joi.object({
    userId: Joi.string().trim().required(),
  }),

  toggleDisplay: Joi.object({
    isDisplayed: Joi.boolean().required(),
  }),

  query: pagination.keys({
    category: Joi.string().trim().max(50).optional(),
    rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
    type: Joi.string().valid('title', 'badge').optional(),
  }),

  param: Joi.object({
    achievementId: Joi.string().trim().required(),
  }),

  displayParam: Joi.object({
    userAchievementId: Joi.string().trim().required(),
  }),
};
