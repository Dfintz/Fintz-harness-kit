/**
 * Announcement validation schemas
 */
import Joi from 'joi';

import { AnnouncementStatus, AnnouncementTargetType } from '../models/Announcement';

import { paginationKeys } from './common';

// Valid enum values
const announcementStatuses = Object.values(AnnouncementStatus);
const announcementTargetTypes = Object.values(AnnouncementTargetType);

// Embed field schema
const embedFieldSchema = Joi.object({
  name: Joi.string().required().max(256).messages({
    'string.empty': 'Field name is required',
    'string.max': 'Field name must be less than 256 characters',
  }),
  value: Joi.string().required().max(1024).messages({
    'string.empty': 'Field value is required',
    'string.max': 'Field value must be less than 1024 characters',
  }),
  inline: Joi.boolean().optional().default(false),
});

// Embed config schema
const embedConfigSchema = Joi.object({
  color: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Color must be a valid hex color (e.g., #0099FF)',
    }),
  thumbnailUrl: Joi.string().uri().optional().messages({
    'string.uri': 'Thumbnail URL must be a valid URL',
  }),
  imageUrl: Joi.string().uri().optional().messages({
    'string.uri': 'Image URL must be a valid URL',
  }),
  footerText: Joi.string().max(2048).optional().messages({
    'string.max': 'Footer text must be less than 2048 characters',
  }),
  footerIconUrl: Joi.string().uri().optional().messages({
    'string.uri': 'Footer icon URL must be a valid URL',
  }),
  authorName: Joi.string().max(256).optional().messages({
    'string.max': 'Author name must be less than 256 characters',
  }),
  authorIconUrl: Joi.string().uri().optional().messages({
    'string.uri': 'Author icon URL must be a valid URL',
  }),
  authorUrl: Joi.string().uri().optional().messages({
    'string.uri': 'Author URL must be a valid URL',
  }),
  timestamp: Joi.boolean().optional().default(false),
  fields: Joi.array().items(embedFieldSchema).max(25).optional().messages({
    'array.max': 'Maximum of 25 fields allowed',
  }),
});

export const announcementSchemas = {
  // Create announcement schema
  create: Joi.object({
    title: Joi.string().required().min(1).max(256).messages({
      'string.empty': 'Title is required',
      'string.min': 'Title must be at least 1 character',
      'string.max': 'Title must be less than 256 characters',
    }),
    content: Joi.string().required().min(1).max(4096).messages({
      'string.empty': 'Content is required',
      'string.min': 'Content must be at least 1 character',
      'string.max': 'Content must be less than 4096 characters',
    }),
    embedConfig: embedConfigSchema.optional(),
    targetType: Joi.string()
      .valid(...announcementTargetTypes)
      .default(AnnouncementTargetType.SINGLE)
      .messages({
        'any.only': `Target type must be one of: ${announcementTargetTypes.join(', ')}`,
      }),
    targetIds: Joi.array().items(Joi.string()).optional(),
    scheduledAt: Joi.date().iso().greater('now').optional().messages({
      'date.greater': 'Scheduled time must be in the future',
    }),
  }),

  // Update announcement schema
  update: Joi.object({
    title: Joi.string().min(1).max(256).optional(),
    content: Joi.string().min(1).max(4096).optional(),
    embedConfig: embedConfigSchema.optional(),
    targetType: Joi.string()
      .valid(...announcementTargetTypes)
      .optional(),
    targetIds: Joi.array().items(Joi.string()).optional(),
    scheduledAt: Joi.date().iso().optional(),
    status: Joi.string()
      .valid(...announcementStatuses)
      .optional()
      .messages({
        'any.only': `Status must be one of: ${announcementStatuses.join(', ')}`,
      }),
  }),

  // Query filters schema
  query: Joi.object({
    ...paginationKeys,
    status: Joi.string()
      .valid(...announcementStatuses)
      .optional(),
    targetType: Joi.string()
      .valid(...announcementTargetTypes)
      .optional(),
    createdBy: Joi.string().optional(),
  }),

  // Send announcement schema
  send: Joi.object({
    channelId: Joi.string().required().messages({
      'string.empty': 'Channel ID is required',
    }),
  }),

  // Embed config only (for preview updates)
  embedConfig: embedConfigSchema,

  // ========================================
  // Phase 4: Template Schemas
  // ========================================

  // Create template schema
  createTemplate: Joi.object({
    name: Joi.string().required().min(1).max(100).messages({
      'string.empty': 'Template name is required',
      'string.min': 'Template name must be at least 1 character',
      'string.max': 'Template name must be less than 100 characters',
    }),
    title: Joi.string().max(256).optional().messages({
      'string.max': 'Title must be less than 256 characters',
    }),
    content: Joi.string().required().min(1).max(4096).messages({
      'string.empty': 'Content is required',
      'string.min': 'Content must be at least 1 character',
      'string.max': 'Content must be less than 4096 characters',
    }),
    embedConfig: embedConfigSchema.optional(),
    isGlobal: Joi.boolean().optional().default(false),
  }),

  // Update template schema
  updateTemplate: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    title: Joi.string().max(256).optional().allow(null), // Allow null to clear the title
    content: Joi.string().min(1).max(4096).optional(),
    embedConfig: embedConfigSchema.optional(),
  }),

  // Query templates schema
  queryTemplates: Joi.object({
    ...paginationKeys,
    isGlobal: Joi.boolean().optional(),
    createdBy: Joi.string().optional(),
  }),

  // Create from template schema
  createFromTemplate: Joi.object({
    templateId: Joi.string().uuid().required().messages({
      'string.empty': 'Template ID is required',
      'string.guid': 'Template ID must be a valid UUID',
    }),
    title: Joi.string().max(256).optional(),
    content: Joi.string().max(4096).optional(),
    embedConfig: embedConfigSchema.optional(),
  }),

  // Global broadcast schema
  globalBroadcast: Joi.object({
    channelName: Joi.string().max(100).optional().default('announcements').messages({
      'string.max': 'Channel name must be less than 100 characters',
    }),
    confirmation: Joi.boolean().valid(true).required().messages({
      'any.only': 'You must confirm the global broadcast by setting confirmation to true',
    }),
  }),
};
