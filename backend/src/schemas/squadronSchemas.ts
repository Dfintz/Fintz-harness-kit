import Joi from 'joi';

import { id, idArray } from './common';

/**
 * Squadron Validation Schemas
 * 
 * Validation for squadron/user group management
 */

export const squadronSchemas = {
    // Single squadron member
    singleMember: Joi.object({
        userId: id,
        role: Joi.string().trim().max(50).optional(),
        shipType: Joi.string().trim().max(100).optional(),
        status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').default('active'),
        joinDate: Joi.date().iso().optional(),
        notes: Joi.string().trim().max(1000).optional().allow(null, '')
    }),

    // Bulk add members
    bulkAddMembers: Joi.object({
        members: Joi.array().items(Joi.object({
            userId: id,
            role: Joi.string().trim().max(50).optional(),
            shipType: Joi.string().trim().max(100).optional(),
            status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').default('active'),
        })).min(1).max(100).required(),
    }),

    // Bulk update members
    bulkUpdateMembers: Joi.object({
        updates: Joi.array().items(Joi.object({
            id,
            data: Joi.object({
                role: Joi.string().trim().max(50).optional(),
                shipType: Joi.string().trim().max(100).optional(),
                status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
            }).required(),
        })).min(1).max(100).required(),
    }),

    // Bulk delete members
    bulkDeleteMembers: Joi.object({
        memberIds: idArray,
    }),

    // Bulk update status
    bulkUpdateStatus: Joi.object({
        memberIds: idArray,
        status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').required(),
    }),

    // Update role
    updateRole: Joi.object({
        role: Joi.string().trim().max(50).required()
    }),

    // Query filters
    query: Joi.object({
        status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
        role: Joi.string().trim().max(50).optional(),
        shipType: Joi.string().trim().max(100).optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10)
    })
};
