import Joi from 'joi';

import { id, paginationKeys } from './common';

/**
 * Activity template validation schemas
 */

const activityTypeValues = [
  'mission',
  'contract',
  'bounty',
  'event',
  'lfg',
  'operation',
  'job_listing',
] as const;

const categoryValues = [
  'combat',
  'mining',
  'trading',
  'exploration',
  'logistics',
  'social',
  'training',
  'custom',
] as const;

const roleRequirementSchema = Joi.object({
  role: Joi.string().trim().min(1).max(100).required(),
  count: Joi.number().integer().min(1).max(100).required(),
  required: Joi.boolean().required(),
});

const resourceRequirementSchema = Joi.object({
  resource: Joi.string().trim().min(1).max(100).required(),
  quantity: Joi.number().integer().min(1).required(),
  required: Joi.boolean().required(),
});

const templateDataSchema = Joi.object({
  description: Joi.string().trim().max(2000).optional(),
  activityType: Joi.string()
    .valid(...activityTypeValues)
    .optional(),
  visibility: Joi.string()
    .valid('public', 'organization', 'private', 'unlisted', 'restricted', 'federation')
    .optional(),
  maxParticipants: Joi.number().integer().min(1).max(200).optional(),
  minParticipants: Joi.number().integer().min(1).max(200).optional(),
  locationSystem: Joi.string().trim().max(200).optional(),
  locationPlanet: Joi.string().trim().max(200).optional(),
  locationDetails: Joi.string().trim().max(500).optional(),
  estimatedDuration: Joi.number().integer().min(1).max(1440).optional(),
  requirements: Joi.array().items(Joi.string().trim().max(200)).max(20).optional(),
  objectives: Joi.array().items(Joi.string().trim().max(200)).max(20).optional(),
  roleRequirements: Joi.array().items(roleRequirementSchema).max(20).optional(),
  resourceRequirements: Joi.array().items(resourceRequirementSchema).max(20).optional(),
  requiredShips: Joi.array().items(Joi.string().trim().min(1).max(100)).max(20).optional(),
  preferredShips: Joi.array().items(Joi.string().trim().min(1).max(100)).max(20).optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  metadata: Joi.object().unknown(true).optional(),
});

export const activityTemplateSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(3).max(150).required(),
    description: Joi.string().trim().max(1000).optional().allow('', null),
    activityType: Joi.string()
      .valid(...activityTypeValues)
      .required(),
    category: Joi.string()
      .valid(...categoryValues)
      .optional(),
    templateData: templateDataSchema.default({}),
    isPublic: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(3).max(150).optional(),
    description: Joi.string().trim().max(1000).optional().allow('', null),
    activityType: Joi.string()
      .valid(...activityTypeValues)
      .optional(),
    category: Joi.string()
      .valid(...categoryValues)
      .optional(),
    templateData: templateDataSchema.optional(),
    isPublic: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  }),

  query: Joi.object({
    ...paginationKeys,
    category: Joi.string()
      .valid(...categoryValues)
      .optional(),
    activityType: Joi.string()
      .valid(...activityTypeValues)
      .optional(),
    isPublic: Joi.boolean().optional(),
    search: Joi.string().trim().max(200).optional(),
  }),

  param: Joi.object({
    templateId: id.description('Activity template ID'),
  }),

  apply: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    scheduledStartTime: Joi.date().iso().required(),
    estimatedDuration: Joi.number().integer().min(1).max(1440).optional(),
    maxParticipants: Joi.number().integer().min(1).max(200).optional(),
    overrides: Joi.object().unknown(true).optional(),
  }),
};
