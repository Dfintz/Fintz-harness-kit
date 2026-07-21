import Joi from 'joi';

/**
 * RSI Role Mapping Validation Schemas
 *
 * Validation for RSI role mapping configuration endpoints
 * Phase 2: RSI Role Sync System - Role Mapping Configuration
 */

/**
 * RBAC Permissions schema
 */
const rbacPermissionsSchema = Joi.object({
  fleetView: Joi.boolean().optional(),
  fleetEdit: Joi.boolean().optional(),
  fleetManage: Joi.boolean().optional(),
  orgView: Joi.boolean().optional(),
  orgEdit: Joi.boolean().optional(),
  orgManage: Joi.boolean().optional(),
  eventView: Joi.boolean().optional(),
  eventManage: Joi.boolean().optional(),
  intelView: Joi.boolean().optional(),
  intelManage: Joi.boolean().optional(),
  admin: Joi.boolean().optional(),
  custom: Joi.object().pattern(Joi.string().max(50), Joi.boolean()).optional(),
}).optional();

export const rsiRoleMappingSchemas = {
  /**
   * Create a new role mapping
   */
  createMapping: Joi.object({
    rsiRank: Joi.string().trim().min(1).max(50).required().messages({
      'string.empty': 'RSI rank is required',
      'string.min': 'RSI rank must be at least 1 character',
      'string.max': 'RSI rank cannot exceed 50 characters',
      'any.required': 'RSI rank is required',
    }),
    discordRoleId: Joi.string()
      .trim()
      .pattern(/^\d{17,20}$/)
      .optional()
      .allow(null, '')
      .messages({
        'string.pattern.base': 'Discord role ID must be a valid snowflake (17-20 digits)',
      }),
    rbacPermissions: rbacPermissionsSchema,
    isActive: Joi.boolean().optional().default(true),
    priority: Joi.number().integer().min(0).max(1000).optional().default(0).messages({
      'number.min': 'Priority must be at least 0',
      'number.max': 'Priority cannot exceed 1000',
    }),
    description: Joi.string().trim().max(255).optional().allow(null, '').messages({
      'string.max': 'Description cannot exceed 255 characters',
    }),
    internalRoleId: Joi.string().uuid().optional().allow(null, '').messages({
      'string.guid': 'Internal role ID must be a valid UUID',
    }),
  }),

  /**
   * Update an existing role mapping
   */
  updateMapping: Joi.object({
    discordRoleId: Joi.string()
      .trim()
      .pattern(/^\d{17,20}$/)
      .optional()
      .allow(null, '')
      .messages({
        'string.pattern.base': 'Discord role ID must be a valid snowflake (17-20 digits)',
      }),
    rbacPermissions: rbacPermissionsSchema,
    isActive: Joi.boolean().optional(),
    priority: Joi.number().integer().min(0).max(1000).optional().messages({
      'number.min': 'Priority must be at least 0',
      'number.max': 'Priority cannot exceed 1000',
    }),
    description: Joi.string().trim().max(255).optional().allow(null, '').messages({
      'string.max': 'Description cannot exceed 255 characters',
    }),
    internalRoleId: Joi.string().uuid().optional().allow(null, '').messages({
      'string.guid': 'Internal role ID must be a valid UUID',
    }),
  }),

  /**
   * Apply a template to an organization
   */
  applyTemplate: Joi.object({
    templateName: Joi.string()
      .trim()
      .valid('standard', 'military', 'corporate')
      .required()
      .messages({
        'string.empty': 'Template name is required',
        'any.only': 'Template name must be one of: standard, military, corporate',
        'any.required': 'Template name is required',
      }),
    discordRoleMappings: Joi.object()
      .pattern(Joi.string().max(50), Joi.string().pattern(/^\d{17,20}$/))
      .optional()
      .messages({
        'object.pattern.match':
          'Discord role mappings must use valid RSI rank names as keys and Discord role IDs as values',
      }),
  }),

  /**
   * Bulk upsert mappings
   */
  bulkUpsert: Joi.object({
    mappings: Joi.array()
      .items(
        Joi.object({
          rsiRank: Joi.string().trim().min(1).max(50).required().messages({
            'string.empty': 'RSI rank is required',
            'string.min': 'RSI rank must be at least 1 character',
            'string.max': 'RSI rank cannot exceed 50 characters',
            'any.required': 'RSI rank is required',
          }),
          discordRoleId: Joi.string()
            .trim()
            .pattern(/^\d{17,20}$/)
            .optional()
            .allow(null, '')
            .messages({
              'string.pattern.base': 'Discord role ID must be a valid snowflake (17-20 digits)',
            }),
          rbacPermissions: rbacPermissionsSchema,
          priority: Joi.number().integer().min(0).max(1000).optional().messages({
            'number.min': 'Priority must be at least 0',
            'number.max': 'Priority cannot exceed 1000',
          }),
          description: Joi.string().trim().max(255).optional().allow(null, ''),
          internalRoleId: Joi.string().uuid().optional().allow(null, '').messages({
            'string.guid': 'Internal role ID must be a valid UUID',
          }),
        })
      )
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one mapping is required',
        'array.max': 'Cannot process more than 50 mappings at once',
        'any.required': 'Mappings array is required',
      }),
  }),

  /**
   * Clone mappings from another organization
   */
  cloneMappings: Joi.object({
    sourceOrgId: Joi.string().uuid().required().messages({
      'string.guid': 'Source organization ID must be a valid UUID',
      'any.required': 'Source organization ID is required',
    }),
    includeDiscordRoles: Joi.boolean().optional().default(false),
  }),

  /**
   * Query parameters for listing mappings
   */
  listMappingsQuery: Joi.object({
    includeInactive: Joi.boolean().optional().default(false),
  }),

  /**
   * Mapping ID parameter validation
   */
  mappingIdParam: Joi.object({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Mapping ID must be a valid UUID',
      'any.required': 'Mapping ID is required',
    }),
  }),

  /**
   * Organization ID parameter validation
   */
  organizationIdParam: Joi.object({
    organizationId: Joi.string().uuid().required().messages({
      'string.guid': 'Organization ID must be a valid UUID',
      'any.required': 'Organization ID is required',
    }),
  }),
};
