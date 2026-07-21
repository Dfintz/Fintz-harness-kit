import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Reusable UUID param schema for role routes
 */
const uuidParam = (name: string): Joi.StringSchema =>
  Joi.string()
    .trim()
    .uuid({ version: ['uuidv4'] })
    .required()
    .messages({ 'string.guid': `${name} must be a valid UUID` });

/**
 * Role Validation Schemas
 *
 * Joi schemas for role CRUD endpoints.
 */
export const roleSchemas = {
  /**
   * Schema for creating a custom role.
   * `scope` is optional and defaults to 'organization' so the org-scoped route
   * (/api/v2/organizations/:orgId/roles) accepts payloads that omit it.
   * Use scope='system' explicitly for platform-wide roles.
   */
  create: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().max(500).optional().allow('', null),
    scope: Joi.string().valid('system', 'organization', 'fleet').default('organization'),
    permissions: Joi.array().items(Joi.string().trim().max(200)).optional(),
    organizationId: Joi.string().uuid().optional(),
    priority: Joi.number().integer().min(1).max(100).optional(),
  }),

  /**
   * Schema for updating a custom role
   */
  update: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    description: Joi.string().trim().max(500).optional().allow('', null),
    permissions: Joi.array().items(Joi.string().trim().max(200)).optional(),
    priority: Joi.number().integer().min(1).max(100).optional(),
  }),

  /** Body for POST /organizations/:orgId/roles/reorder */
  reorder: Joi.object({
    updates: Joi.array()
      .items(
        Joi.object({
          roleId: Joi.string().trim().uuid().required(),
          priority: Joi.number().integer().min(1).max(100).required(),
        }).unknown(false)
      )
      .min(1)
      .required(),
  }).unknown(false),

  /** Params: { roleId } */
  roleIdParam: Joi.object({
    roleId: uuidParam('roleId'),
  }).unknown(false),

  /** Params: { orgId, roleId } */
  orgRoleIdParams: Joi.object({
    orgId: uuidParam('orgId'),
    roleId: uuidParam('roleId'),
  }).unknown(false),

  /** Params: { orgId } */
  orgIdParam: Joi.object({
    orgId: uuidParam('orgId'),
  }).unknown(false),

  /** Params: { roleId, userId } */
  roleIdUserIdParams: Joi.object({
    roleId: uuidParam('roleId'),
    userId: uuidParam('userId'),
  }).unknown(false),

  /** Params: { roleId, permissionId } */
  roleIdPermissionIdParams: Joi.object({
    roleId: uuidParam('roleId'),
    permissionId: Joi.string().trim().min(1).max(200).required(),
  }).unknown(false),

  /** Params: { templateId } */
  templateIdParam: Joi.object({
    templateId: Joi.string().trim().min(1).max(100).required(),
  }).unknown(false),

  /** Body for POST /:roleId/assign */
  assign: Joi.object({
    userId: Joi.string().uuid().required(),
    organizationId: Joi.string().uuid().required(),
  }),

  /** Body for POST /:roleId/permissions */
  addPermission: Joi.object({
    permissionId: Joi.string().trim().min(1).max(200).required(),
  }),

  /** Body for POST /templates/:templateId/apply */
  applyTemplate: Joi.object({
    roleName: Joi.string().trim().min(1).max(100).required(),
    organizationId: Joi.string().uuid().optional(),
  }),

  /** Query for GET /roles */
  listQuery: Joi.object({
    ...paginationKeysWith(50),
    organizationId: Joi.string().uuid().optional(),
    includeSystem: Joi.string().valid('true', 'false').optional(),
  }).unknown(false),

  /** Query for GET /roles/search/by-scope */
  searchByScopeQuery: Joi.object({
    scope: Joi.string().valid('system', 'organization', 'fleet').required(),
    organizationId: Joi.string().uuid().optional(),
  }).unknown(false),
};
