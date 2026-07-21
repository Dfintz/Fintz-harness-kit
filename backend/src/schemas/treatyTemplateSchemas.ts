import Joi from 'joi';

import { paginationKeysWith } from './common';

const VALID_CATEGORIES = [
  'mutual_defense',
  'trade',
  'non_aggression',
  'resource_sharing',
  'intel_sharing',
  'military_cooperation',
  'custom',
];

const VALID_SCOPES = ['alliance', 'federation', 'both'];

const clauseSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  text: Joi.string().min(5).max(5000).required(),
  isRequired: Joi.boolean().default(false),
  sortOrder: Joi.number().integer().min(0).optional(),
});

/**
 * Joi validation schemas for treaty templates.
 */
export const treatyTemplateSchemas = {
  /** Create a new treaty template */
  create: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(2000).required(),
    category: Joi.string()
      .valid(...VALID_CATEGORIES)
      .required(),
    scope: Joi.string()
      .valid(...VALID_SCOPES)
      .default('both'),
    clauses: Joi.array().items(clauseSchema).min(1).max(50).required(),
    isPublished: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  }),

  /** Update an existing treaty template */
  update: Joi.object({
    name: Joi.string().min(3).max(200),
    description: Joi.string().min(10).max(2000),
    category: Joi.string().valid(...VALID_CATEGORIES),
    scope: Joi.string().valid(...VALID_SCOPES),
    clauses: Joi.array().items(clauseSchema).min(1).max(50),
    isPublished: Joi.boolean(),
    tags: Joi.array().items(Joi.string().max(50)).max(20),
  }).min(1),

  /** Instantiate a treaty from a template */
  instantiate: Joi.object({
    templateId: Joi.string().required(),
    clauseOverrides: Joi.object().pattern(Joi.string(), Joi.string().min(5).max(5000)).optional(),
    additionalClauses: Joi.array()
      .items(
        Joi.object({
          title: Joi.string().min(2).max(200).required(),
          text: Joi.string().min(5).max(5000).required(),
        })
      )
      .max(20)
      .optional(),
    excludeClauses: Joi.array().items(Joi.string().max(200)).max(50).optional(),
  }),

  /** Query params for listing templates */
  listQuery: Joi.object({
    category: Joi.string()
      .valid(...VALID_CATEGORIES)
      .optional(),
    scope: Joi.string()
      .valid(...VALID_SCOPES)
      .optional(),
    search: Joi.string().max(200).optional(),
    ...paginationKeysWith(50),
  }),

  /** Route param for template ID */
  param: Joi.object({
    id: Joi.string().required(),
  }),
};
