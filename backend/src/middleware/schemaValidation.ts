import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Middleware factory to validate request data against Joi schemas
 */
export const validateSchema = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => (req: Request, res: Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // Return all errors
            stripUnknown: true, // Remove unknown fields
            convert: true, // Convert types (e.g., strings to numbers for query params)
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));
            res.status(400).json({
                message: 'Validation error',
                errors,
            });
            return;
        }

        // Replace request data with validated and sanitized data
        req[property] = value;
        next();
    };

// Common validation schemas
export const schemas = {
    // ID parameter validation
    id: Joi.object({
        id: Joi.string().required().trim().min(1).max(100),
    }),

    // Organization schemas
    organization: {
        create: Joi.object({
            id: Joi.string().required().trim().min(1).max(100),
            name: Joi.string().required().trim().min(3).max(100),
            members: Joi.array().items(Joi.string()).default([]),
        }),
        update: Joi.object({
            name: Joi.string().optional().trim().min(3).max(100),
            members: Joi.array().items(Joi.string()).optional(),
        }),
    },

    // Fleet schemas
    fleet: {
        member: Joi.object({
            memberId: Joi.string().required().trim().min(1).max(100),
        }),
    },

    // Trading route schemas
    tradingRoute: {
        create: Joi.object({
            name: Joi.string().required().trim().min(3).max(200),
            origin: Joi.string().required().trim().min(1).max(200),
            destination: Joi.string().required().trim().min(1).max(200),
            commodity: Joi.string().required().trim().min(1).max(100),
            buyPrice: Joi.number().required().min(0),
            sellPrice: Joi.number().required().min(0),
            profitMargin: Joi.number().optional().min(0),
            distance: Joi.number().optional().min(0),
        }),
        updatePerformance: Joi.object({
            actualProfit: Joi.number().required().min(0),
            timeCompleted: Joi.number().optional().min(0),
            notes: Joi.string().optional().trim().max(1000),
        }),
        updateStatus: Joi.object({
            status: Joi.string().required().valid('active', 'inactive', 'deprecated'),
        }),
    },

    // Ship loan schemas
    shipLoan: {
        request: Joi.object({
            shipId: Joi.string().required().trim().min(1).max(100),
            shipName: Joi.string().required().trim().min(1).max(200),
            borrowerId: Joi.string().required().trim().min(1).max(100),
            borrowerName: Joi.string().required().trim().min(1).max(100),
            duration: Joi.number().required().min(1).max(365),
            purpose: Joi.string().required().trim().min(10).max(1000),
        }),
        updateStatus: Joi.object({
            status: Joi.string().optional().valid('pending', 'approved', 'active', 'returned', 'declined'),
            notes: Joi.string().optional().trim().max(1000),
        }),
    },

    // Mining operation schemas
    miningOperation: {
        create: Joi.object({
            location: Joi.string().required().trim().min(1).max(200),
            leaderId: Joi.string().required().trim().min(1).max(100),
            targetResource: Joi.string().required().trim().min(1).max(100),
            estimatedDuration: Joi.number().optional().min(1),
        }),
        addCrew: Joi.object({
            memberId: Joi.string().required().trim().min(1).max(100),
            role: Joi.string().required().trim().min(1).max(100),
        }),
        recordResources: Joi.object({
            resourceType: Joi.string().required().trim().min(1).max(100),
            quantity: Joi.number().required().min(0),
            quality: Joi.string().optional().valid('low', 'medium', 'high'),
        }),
        updateStatus: Joi.object({
            status: Joi.string().required().valid('planning', 'active', 'completed', 'cancelled'),
        }),
    },

    // Ship maintenance schemas
    shipMaintenance: {
        schedule: Joi.object({
            shipId: Joi.string().required().trim().min(1).max(100),
            shipName: Joi.string().required().trim().min(1).max(200),
            maintenanceType: Joi.string().required().trim().min(1).max(100),
            scheduledDate: Joi.date().required(),
            estimatedCost: Joi.number().optional().min(0),
            priority: Joi.string().optional().valid('low', 'medium', 'high', 'critical'),
            notes: Joi.string().optional().trim().max(1000),
        }),
        updateStatus: Joi.object({
            status: Joi.string().required().valid('scheduled', 'in_progress', 'completed', 'cancelled'),
            actualCost: Joi.number().optional().min(0),
            completionNotes: Joi.string().optional().trim().max(1000),
        }),
    },

    // Bounty schemas
    bounty: {
        create: Joi.object({
            targetId: Joi.string().required().trim().min(1).max(100),
            targetName: Joi.string().required().trim().min(1).max(200),
            reward: Joi.number().required().min(0),
            description: Joi.string().required().trim().min(10).max(2000),
            difficulty: Joi.string().optional().valid('easy', 'medium', 'hard', 'extreme'),
            expiresAt: Joi.date().optional(),
        }),
        claim: Joi.object({
            hunterId: Joi.string().required().trim().min(1).max(100),
            hunterName: Joi.string().required().trim().min(1).max(200),
        }),
        complete: Joi.object({
            proof: Joi.string().optional().trim().max(2000),
            notes: Joi.string().optional().trim().max(1000),
        }),
    },

    // Cargo manifest schemas
    cargoManifest: {
        create: Joi.object({
            shipId: Joi.string().required().trim().min(1).max(100),
            shipName: Joi.string().required().trim().min(1).max(200),
            ownerId: Joi.string().required().trim().min(1).max(100),
            totalCapacity: Joi.number().required().min(0),
        }),
        addCargo: Joi.object({
            itemName: Joi.string().required().trim().min(1).max(200),
            quantity: Joi.number().required().min(0),
            weight: Joi.number().optional().min(0),
            value: Joi.number().optional().min(0),
            category: Joi.string().optional().trim().max(100),
        }),
        updateStatus: Joi.object({
            status: Joi.string().required().valid('empty', 'loading', 'loaded', 'in_transit', 'unloading'),
        }),
        updateSharing: Joi.object({
            isPublic: Joi.boolean().required(),
            sharedWith: Joi.array().items(Joi.string()).optional(),
        }),
    },

    // Crew assignment schemas
    crewAssignment: {
        create: Joi.object({
            shipId: Joi.string().required().trim().min(1).max(100),
            memberId: Joi.string().required().trim().min(1).max(100),
            role: Joi.string().required().trim().min(1).max(100),
            startDate: Joi.date().optional(),
            endDate: Joi.date().optional(),
        }),
        update: Joi.object({
            role: Joi.string().optional().trim().min(1).max(100),
            endDate: Joi.date().optional(),
            notes: Joi.string().optional().trim().max(1000),
        }),
    },

    // Reputation schemas
    reputation: {
        create: Joi.object({
            userId: Joi.string().required().trim().min(1).max(100),
            organizationId: Joi.string().required().trim().min(1).max(100),
            points: Joi.number().required(),
            reason: Joi.string().required().trim().min(5).max(500),
        }),
        update: Joi.object({
            points: Joi.number().optional(),
            reason: Joi.string().optional().trim().min(5).max(500),
        }),
    },

    // Contract schemas
    contract: {
        create: Joi.object({
            title: Joi.string().required().trim().min(5).max(200),
            description: Joi.string().required().trim().min(10).max(2000),
            contractType: Joi.string().required().valid('bounty', 'cargo', 'mining', 'escort', 'other'),
            reward: Joi.number().required().min(0),
            deadline: Joi.date().optional(),
            requiredParticipants: Joi.number().optional().min(1),
        }),
        update: Joi.object({
            title: Joi.string().optional().trim().min(5).max(200),
            description: Joi.string().optional().trim().min(10).max(2000),
            status: Joi.string().optional().valid('open', 'in_progress', 'completed', 'cancelled'),
            reward: Joi.number().optional().min(0),
        }),
    },

    // Alliance diplomacy schemas
    allianceDiplomacy: {
        create: Joi.object({
            allianceId: Joi.string().required().trim().min(1).max(100),
            targetAllianceId: Joi.string().required().trim().min(1).max(100),
            relationship: Joi.string().required().valid('allied', 'neutral', 'hostile'),
            notes: Joi.string().optional().trim().max(1000),
        }),
        update: Joi.object({
            relationship: Joi.string().optional().valid('allied', 'neutral', 'hostile'),
            notes: Joi.string().optional().trim().max(1000),
        }),
    },
};
