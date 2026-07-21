import Joi from 'joi';

import { optionalUuid } from './common';

/**
 * Wiki Validation Schemas
 *
 * Validation for wiki page CRUD, move, search, and revision operations.
 * Slugs are auto-generated from titles; content is Markdown.
 */

export const wikiSchemas = {
  /** Create a new wiki page */
  create: Joi.object({
    title: Joi.string().trim().min(1).max(200).required().messages({
      'string.empty': 'Title is required',
      'any.required': 'Title is required',
    }),
    content: Joi.string().max(100_000).optional().allow(null, '').default(''),
    parentPageId: optionalUuid.allow(null),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional().default([]),
  }),

  /** Update an existing wiki page */
  update: Joi.object({
    title: Joi.string().trim().min(1).max(200).optional(),
    content: Joi.string().max(100_000).optional().allow(null, ''),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    changeDescription: Joi.string().trim().max(500).optional().allow(null, ''),
    isLocked: Joi.boolean().optional(),
  }).min(1), // at least one field required

  /** Move a page within the tree */
  move: Joi.object({
    parentPageId: Joi.string().uuid().allow(null).required(),
    sortOrder: Joi.number().integer().min(0).default(0),
  }),

  /** Search query parameters */
  search: Joi.object({
    q: Joi.string().trim().min(1).max(200).required().messages({
      'string.empty': 'Search query is required',
      'any.required': 'Search query is required',
    }),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),

  /** Restore a specific revision */
  restore: Joi.object({
    revisionId: Joi.string().uuid().required().messages({
      'any.required': 'Revision ID is required',
    }),
  }),

  /** Page ID param validation */
  pageIdParam: Joi.object({
    pageId: Joi.string().trim().min(1).max(100).required(),
  }),

  /** Revision ID param validation */
  revisionIdParam: Joi.object({
    pageId: Joi.string().trim().min(1).max(100).required(),
    revisionId: Joi.string().uuid().required(),
  }),
};
