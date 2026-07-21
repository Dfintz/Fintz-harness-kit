import Joi from 'joi';

import { OrganizationInventoryCategory } from '../models/OrganizationInventory';

/**
 * Validation schemas for organization inventory operations
 */

export const organizationInventorySchemas = {
    // Create inventory item
    create: Joi.object({
        itemName: Joi.string().trim().min(1).max(200).required(),
        description: Joi.string().trim().max(1000).optional().allow(null, ''),
        category: Joi.string()
            .valid(...Object.values(OrganizationInventoryCategory))
            .required(),
        quantity: Joi.number().integer().min(1).required(),
        unit: Joi.string().trim().max(50).optional().allow(null, ''),
        unitValue: Joi.number().min(0).required(),
        notes: Joi.string().trim().max(2000).optional().allow(null, ''),
        location: Joi.string().trim().max(200).optional().allow(null, ''),
        assignedTo: Joi.string().trim().optional().allow(null, '')
    }),

    // Update inventory item
    update: Joi.object({
        itemName: Joi.string().trim().min(1).max(200).optional(),
        description: Joi.string().trim().max(1000).optional().allow(null, ''),
        category: Joi.string()
            .valid(...Object.values(OrganizationInventoryCategory))
            .optional(),
        quantity: Joi.number().integer().min(1).optional(),
        unit: Joi.string().trim().max(50).optional().allow(null, ''),
        unitValue: Joi.number().min(0).optional(),
        notes: Joi.string().trim().max(2000).optional().allow(null, ''),
        location: Joi.string().trim().max(200).optional().allow(null, ''),
        assignedTo: Joi.string().trim().optional().allow(null, '')
    }).min(1), // At least one field must be present

    // Query/filter parameters
    query: Joi.object({
        category: Joi.alternatives()
            .try(
                Joi.string().valid(...Object.values(OrganizationInventoryCategory)),
                Joi.array().items(Joi.string().valid(...Object.values(OrganizationInventoryCategory)))
            )
            .optional(),
        searchTerm: Joi.string().trim().max(200).optional(),
        assignedTo: Joi.string().trim().optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        sortBy: Joi.string()
            .valid('itemName', 'quantity', 'totalValue', 'category', 'createdAt', 'updatedAt')
            .optional(),
        sortOrder: Joi.string().valid('ASC', 'DESC').optional()
    })
};
