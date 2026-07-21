import Joi from 'joi';

import { description, id, paginationKeys } from './common';

/**
 * Organization validation schemas
 */

export const organizationSchemas = {
  // Create organization
  create: Joi.object({
    id,
    name: Joi.string().trim().min(3).max(100).required(),
    description,
    type: Joi.string().valid('root', 'division', 'department', 'team', 'project').default('root'),
    status: Joi.string().valid('active', 'inactive', 'archived').default('active'),
    members: Joi.array().items(Joi.string()).default([]),
    parentId: Joi.string().trim().optional().allow(null),
  }),

  // Update organization
  update: Joi.object({
    name: Joi.string().trim().min(3).max(100).optional(),
    description,
    type: Joi.string().valid('root', 'division', 'department', 'team', 'project').optional(),
    status: Joi.string().valid('active', 'inactive', 'archived').optional(),
    parentId: Joi.string().trim().optional().allow(null),
  }),

  // Rename organization (name only)
  rename: Joi.object({
    name: Joi.string().trim().min(3).max(100).required(),
  }),

  // Add member
  addMember: Joi.object({
    userId: id,
    role: Joi.string().valid('owner', 'admin', 'member', 'guest').default('member'),
  }),

  // Update member role — accepts either a role name (legacy) or roleId (preferred).
  updateMemberRole: Joi.object({
    role: Joi.string()
      .pattern(/^[a-z][a-z0-9_-]{1,49}$/i)
      .messages({
        'string.pattern.base':
          'Invalid role name. Only letters, numbers, hyphens, and underscores are allowed (2–50 chars, must start with a letter).',
      }),
    roleId: Joi.string().uuid(),
  }).xor('role', 'roleId'),

  // Query filters
  query: Joi.object({
    ...paginationKeys,
    type: Joi.string().valid('root', 'division', 'department', 'team', 'project').optional(),
    status: Joi.string().valid('active', 'inactive', 'archived').optional(),
    search: Joi.string().trim().max(100).optional(),
    parentId: Joi.string().trim().optional(),
  }),

  // Organization ID param
  param: Joi.object({ id }),

  // Create sub-organization
  createSubOrg: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    parentOrgId: id.required(),
    description: Joi.string().trim().max(500).optional(),
  }),

  // Move in hierarchy
  moveHierarchy: Joi.object({
    targetParentId: id.required(),
    position: Joi.number().integer().min(0).optional(),
  }),

  // Grant permissions
  grantPermission: Joi.object({
    userId: id.required(),
    permissions: Joi.array()
      .items(
        Joi.string().valid('read', 'write', 'delete', 'admin', 'manage_members', 'manage_roles')
      )
      .min(1)
      .required(),
  }),

  // Hierarchy operations
  move: Joi.object({
    newParentId: Joi.string().trim().required().allow(null),
  }),

  // ── Aggregator Schemas ──

  // Onboard member with permissions
  onboardMember: Joi.object({
    userId: id.required(),
    role: Joi.string().valid('owner', 'admin', 'member', 'guest').default('member'),
    title: Joi.string().trim().max(100).optional(),
    permissions: Joi.array()
      .items(
        Joi.object({
          resource: Joi.string().required(),
          actions: Joi.array().items(Joi.string()).min(1).required(),
        })
      )
      .optional(),
    message: Joi.string().trim().max(500).optional(),
    sendNotification: Joi.boolean().default(true),
  }),

  // Offboard member
  offboardMember: Joi.object({
    reason: Joi.string().trim().max(500).optional(),
  }),

  // Bulk invite members
  bulkInvite: Joi.object({
    invitations: Joi.array()
      .items(
        Joi.object({
          userId: id.required(),
          role: Joi.string().valid('owner', 'admin', 'member', 'guest').default('member'),
          permissions: Joi.array()
            .items(
              Joi.object({
                resource: Joi.string().required(),
                actions: Joi.array().items(Joi.string()).min(1).required(),
              })
            )
            .optional(),
        })
      )
      .min(1)
      .required(),
  }),
};
