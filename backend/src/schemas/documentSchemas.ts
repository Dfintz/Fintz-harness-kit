import Joi from 'joi';

import { paginationKeys } from './common';

/**
 * Document validation schemas
 *
 * Supports document CRUD, versioning, folders, and sharing.
 */

const sharePermissions = ['view', 'download', 'edit'];
const mimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

export const documentSchemas = {
  // Upload document (metadata — file itself via multipart)
  upload: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    description: Joi.string().trim().max(2000).optional(),
    folderId: Joi.string().uuid().optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    isPublic: Joi.boolean().default(false),
  }),

  // Update document metadata
  update: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    description: Joi.string().trim().max(2000).optional().allow(null),
    folderId: Joi.string().uuid().optional().allow(null),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    isPublic: Joi.boolean().optional(),
  }).min(1),

  // Query parameters for list
  query: Joi.object({
    ...paginationKeys,
    folderId: Joi.string().uuid().optional(),
    mimeType: Joi.string()
      .valid(...mimeTypes)
      .optional(),
    search: Joi.string().trim().max(200).optional(),
    sortBy: Joi.string().valid('createdAt', 'name', 'fileSize', 'mimeType').default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  }),

  // Share document
  share: Joi.object({
    sharedWithUserId: Joi.string().uuid().optional(),
    sharedWithRole: Joi.string().trim().max(100).optional(),
    permission: Joi.string()
      .valid(...sharePermissions)
      .required(),
    expiresAt: Joi.date().iso().min('now').optional(),
  }).or('sharedWithUserId', 'sharedWithRole'),

  // Upload new version
  uploadVersion: Joi.object({
    changeNote: Joi.string().trim().max(500).optional(),
  }),

  // Create folder
  createFolder: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    parentId: Joi.string().uuid().optional(),
  }),

  // Update folder
  updateFolder: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    sortOrder: Joi.number().integer().min(0).optional(),
  }).min(1),

  // Document ID param
  documentParam: Joi.object({
    documentId: Joi.string().uuid().required(),
  }),

  // Folder ID param
  folderParam: Joi.object({
    folderId: Joi.string().uuid().required(),
  }),
};
