import Joi from 'joi';

import { id } from './common';

/**
 * Validation schemas for FleetView import/export operations
 */

// FleetView ship schema
const fleetViewShip = Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    manufacturer: Joi.string().trim().min(1).max(100).optional(),
    kind: Joi.string().trim().max(100).optional(), // role/classification
    owned: Joi.number().integer().min(0).max(999).optional(),
    warbond: Joi.boolean().optional(),
    lti: Joi.boolean().optional(),
    contains: Joi.array().items(Joi.string().trim()).optional(),
    pledge: Joi.string().trim().max(200).optional(),
    cost: Joi.number().min(0).optional(),
    notes: Joi.string().trim().max(2000).optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).optional()
});

// Complete FleetView schema
const fleetViewSchema = Joi.object({
    version: Joi.string().trim().optional(),
    updated: Joi.string().isoDate().optional(),
    owner: Joi.object({
        name: Joi.string().trim().optional(),
        handle: Joi.string().trim().optional(),
        orgName: Joi.string().trim().optional(),
        orgSid: Joi.string().trim().optional()
    }).optional(),
    ships: Joi.array().items(fleetViewShip).min(1).required(),
    statistics: Joi.object({
        totalShips: Joi.number().integer().min(0).optional(),
        totalValue: Joi.number().min(0).optional(),
        manufacturers: Joi.object().pattern(Joi.string(), Joi.number().integer()).optional(),
        roles: Joi.object().pattern(Joi.string(), Joi.number().integer()).optional()
    }).optional()
});

export const fleetViewSchemas = {
    // Import FleetView data
    import: Joi.object({
        schema: fleetViewSchema.required(),
        options: Joi.object({
            merge: Joi.boolean().default(true),
            skipDuplicates: Joi.boolean().default(true),
            organizationId: id.required()
        }).optional()
    }),

    // Import from file upload (multipart/form-data)
    importFile: Joi.object({
        merge: Joi.boolean().optional(),
        skipDuplicates: Joi.boolean().optional(),
        organizationId: id.optional() // If not provided, use user's default org
    }),

    // Export query parameters
    exportQuery: Joi.object({
        organizationId: id.optional(),
        includeStatistics: Joi.boolean().default(true),
        includeInactive: Joi.boolean().default(false)
    }),

    // Export as org lead
    exportOrgQuery: Joi.object({
        organizationId: id.required(),
        includeStatistics: Joi.boolean().default(true),
        includeInactive: Joi.boolean().default(false)
    })
};
