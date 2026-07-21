import Joi from 'joi';

import { id, notes, paginationKeys } from './common';

/**
 * Briefing Validation Schemas
 *
 * Validation for mission briefing creation and management.
 * Classification uses intel-aligned levels (public → top_secret).
 */

const CLASSIFICATION_VALUES = [
  'public',
  'restricted',
  'confidential',
  'secret',
  'top_secret',
] as const;

export const briefingSchemas = {
  // Create briefing
  create: Joi.object({
    title: Joi.string().trim().min(3).max(200).required().messages({
      'string.empty': 'Title is required',
      'any.required': 'Title is required',
    }),
    missionId: id.optional().allow(null),
    type: Joi.string()
      .valid('mission', 'operation', 'training', 'event', 'announcement')
      .default('mission'),
    classification: Joi.string()
      .valid(...CLASSIFICATION_VALUES)
      .default('restricted'),
    operationIds: Joi.array().items(id).max(20).optional(),
    summary: Joi.string().trim().max(1000).optional(),
    content: Joi.string().trim().max(50000).optional(),
    objectives: Joi.array().items(Joi.string().trim().max(500)).max(20).optional(),
    targetDate: Joi.date().iso().optional().allow(null),
    expiresAt: Joi.date().iso().optional().allow(null),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    notes,
  }),

  // Update briefing — only fields that exist on the Briefing entity
  update: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    classification: Joi.string()
      .valid(...CLASSIFICATION_VALUES)
      .optional(),
    operationIds: Joi.array().items(id).max(20).optional(),
    elements: Joi.array().optional(),
    backgroundImage: Joi.string().max(7_000_000).optional().allow(null),
    pages: Joi.array()
      .items(
        Joi.object({
          backgroundImage: Joi.string().max(7_000_000).optional().allow(null),
        })
      )
      .max(50)
      .optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    status: Joi.string().valid('draft', 'active', 'completed', 'archived').optional(),
    participants: Joi.array().items(Joi.string().trim().max(100)).max(100).optional(),
  }),

  // Post a briefing to a Discord webhook (web-app share surface)
  postToDiscord: Joi.object({
    webhookUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .max(500)
      .required()
      .messages({
        'string.uri': 'webhookUrl must be a valid https URL',
        'any.required': 'webhookUrl is required',
      }),
  }),

  // Add element to briefing
  addElement: Joi.object({
    type: Joi.string()
      .valid(
        'text',
        'shape',
        'line',
        'arrow',
        'marker',
        'image',
        'map',
        'waypoint',
        'video',
        'link',
        'file',
        'tactical-unit',
        'map-reference',
        'interdiction-point',
        'ship-map'
      )
      .required(),
    title: Joi.string().trim().max(200).optional(),
    content: Joi.string().trim().max(10000).optional(),
    url: Joi.string().uri().trim().max(500).optional().allow(null),
    order: Joi.number().integer().min(0).optional(),
    metadata: Joi.object().optional(),
    position: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
    }).optional(),
    size: Joi.object({
      width: Joi.number().min(0).required(),
      height: Joi.number().min(0).required(),
    }).optional(),
    data: Joi.object().optional(),
    style: Joi.object().optional(),
    unitType: Joi.string().trim().max(50).optional(),
    formationSize: Joi.string().trim().max(50).optional(),
    locationSystem: Joi.string().trim().max(100).optional(),
    locationCode: Joi.string().trim().max(100).optional(),
    locationName: Joi.string().trim().max(200).optional(),
    pageIndex: Joi.number().integer().min(0).max(49).optional(),
  }),

  // Update element
  updateElement: Joi.object({
    title: Joi.string().trim().max(200).optional(),
    content: Joi.string().trim().max(10000).optional(),
    url: Joi.string().uri().trim().max(500).optional().allow(null),
    order: Joi.number().integer().min(0).optional(),
    metadata: Joi.object().optional(),
    position: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
    }).optional(),
    size: Joi.object({
      width: Joi.number().min(0).required(),
      height: Joi.number().min(0).required(),
    }).optional(),
    data: Joi.object().optional(),
    style: Joi.object().optional(),
  }),

  // Add participant
  addParticipant: Joi.object({
    userId: id,
    role: Joi.string().valid('viewer', 'contributor', 'editor', 'owner').default('viewer'),
    required: Joi.boolean().default(false),
  }),

  // Update status
  updateStatus: Joi.object({
    status: Joi.string().valid('draft', 'active', 'completed', 'archived').required(),
  }),

  // Query params
  query: Joi.object({
    ...paginationKeys,
    sortBy: Joi.string()
      .valid('createdAt', 'updatedAt', 'title', 'status', 'classification', 'version')
      .default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
    type: Joi.string()
      .valid('mission', 'operation', 'training', 'event', 'announcement')
      .optional(),
    classification: Joi.string()
      .valid(...CLASSIFICATION_VALUES)
      .optional(),
    operationId: id.optional(),
    status: Joi.string().valid('draft', 'active', 'completed', 'archived').optional(),
    search: Joi.string().trim().max(200).optional(),
  }),
};
