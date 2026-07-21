import Joi from 'joi';

/**
 * Feature Flag validation schemas
 */

export const featureFlagSchemas = {
    // Create feature flag
    create: Joi.object({
        id: Joi.string().trim().min(3).max(100).pattern(/^[a-z0-9-]+$/).required()
            .messages({
                'string.pattern.base': 'Flag ID must contain only lowercase letters, numbers, and hyphens'
            }),
        name: Joi.string().trim().min(3).max(200).required(),
        description: Joi.string().trim().min(10).max(1000).required(),
        status: Joi.string().valid('enabled', 'disabled', 'beta', 'percentage').required(),
        scope: Joi.string().valid('global', 'organization', 'user', 'beta_users').required(),
        percentage: Joi.number().integer().min(0).max(100)
            .when('status', {
                is: 'percentage',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
        targetOrganizations: Joi.array().items(Joi.string().trim()).min(1)
            .when('scope', {
                is: 'organization',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
        targetUsers: Joi.array().items(Joi.string().trim()).min(1)
            .when('scope', {
                is: 'user',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
        metadata: Joi.object().optional(),
    }),

    // Update feature flag
    update: Joi.object({
        name: Joi.string().trim().min(3).max(200).optional(),
        description: Joi.string().trim().min(10).max(1000).optional(),
        status: Joi.string().valid('enabled', 'disabled', 'beta', 'percentage').optional(),
        scope: Joi.string().valid('global', 'organization', 'user', 'beta_users').optional(),
        percentage: Joi.number().integer().min(0).max(100)
            .when('status', {
                is: 'percentage',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
        targetOrganizations: Joi.array().items(Joi.string().trim()).min(1)
            .when('scope', {
                is: 'organization',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
        targetUsers: Joi.array().items(Joi.string().trim()).min(1)
            .when('scope', {
                is: 'user',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
        metadata: Joi.object().optional(),
    }).min(1), // At least one field must be provided

    // Batch evaluation
    evaluateBatch: Joi.object({
        flagIds: Joi.array().items(Joi.string().trim()).min(1).max(50).required()
            .messages({
                'array.max': 'Cannot evaluate more than 50 flags at once'
            }),
    }),

    // Analytics query
    analyticsQuery: Joi.object({
        days: Joi.number().integer().min(1).max(90).optional().default(30)
            .messages({
                'number.max': 'Analytics period cannot exceed 90 days'
            }),
    }),
};

export const paramSchemas = {
    // Feature flag ID param
    featureFlagId: Joi.object({
        id: Joi.string().trim().required(),
    }),
    
    // Flag ID in path
    flagId: Joi.object({
        flagId: Joi.string().trim().required(),
    }),
};
