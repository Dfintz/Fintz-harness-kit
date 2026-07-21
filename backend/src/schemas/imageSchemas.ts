import Joi from 'joi';

import { pageSizeKeysWith } from './common';

/**
 * Joi validation schemas for Image upload/download endpoints
 * Promotes cloud domain from Alpha → Production
 */

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

// Allowed output formats for optimization
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'avif'];

// Predefined resize presets
const RESIZE_PRESETS = ['thumbnail', 'small', 'medium', 'large'];

export const imageSchemas = {
  /**
   * POST /api/v2/images/upload
   * Query params for image optimization on upload
   */
  uploadQuery: Joi.object({
    quality: Joi.number().integer().min(1).max(100).optional(),
    format: Joi.string()
      .valid(...ALLOWED_FORMATS)
      .optional(),
    resize: Joi.string()
      .valid(...RESIZE_PRESETS)
      .optional(),
    variants: Joi.string().valid('true', 'false').optional(),
    width: Joi.number().integer().min(1).max(8192).optional(),
    height: Joi.number().integer().min(1).max(8192).optional(),
  }).options({ allowUnknown: false }),

  /**
   * GET /api/v2/images/download/:fileName
   * GET /api/v2/images/url/:fileName
   * DELETE /api/v2/images/:fileName
   * Param validation for fileName
   */
  fileNameParam: Joi.object({
    fileName: Joi.string()
      .trim()
      .max(512)
      .custom((value, helpers) => {
        // Reject path traversal attempts (runs before pattern validation)
        if (value.includes('..') || value.includes('/') || value.includes('\\')) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'path traversal check')
      .pattern(/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/, 'valid filename')
      .required()
      .messages({
        'any.invalid': 'fileName must be a basename only (no path separators or .. segments)',
      }),
  }),

  /**
   * GET /api/v2/images
   * Query params for listing images
   */
  listQuery: Joi.object({
    prefix: Joi.string().trim().max(256).optional(),
    ...pageSizeKeysWith(20),
  }).options({ allowUnknown: false }),

  /**
   * POST /api/v2/images/validate
   * File validation (body is multipart — validated by multer middleware)
   */
  validateQuery: Joi.object({
    mimeType: Joi.string()
      .valid(...ALLOWED_MIME_TYPES)
      .optional(),
  }).options({ allowUnknown: false }),
};
