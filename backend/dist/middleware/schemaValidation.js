"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = exports.validateSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const validateSchema = (schema, property = 'body') => (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
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
    req[property] = value;
    next();
};
exports.validateSchema = validateSchema;
exports.schemas = {
    id: joi_1.default.object({
        id: joi_1.default.string().required().trim().min(1).max(100),
    }),
    organization: {
        create: joi_1.default.object({
            id: joi_1.default.string().required().trim().min(1).max(100),
            name: joi_1.default.string().required().trim().min(3).max(100),
            members: joi_1.default.array().items(joi_1.default.string()).default([]),
        }),
        update: joi_1.default.object({
            name: joi_1.default.string().optional().trim().min(3).max(100),
            members: joi_1.default.array().items(joi_1.default.string()).optional(),
        }),
    },
    fleet: {
        member: joi_1.default.object({
            memberId: joi_1.default.string().required().trim().min(1).max(100),
        }),
    },
    tradingRoute: {
        create: joi_1.default.object({
            name: joi_1.default.string().required().trim().min(3).max(200),
            origin: joi_1.default.string().required().trim().min(1).max(200),
            destination: joi_1.default.string().required().trim().min(1).max(200),
            commodity: joi_1.default.string().required().trim().min(1).max(100),
            buyPrice: joi_1.default.number().required().min(0),
            sellPrice: joi_1.default.number().required().min(0),
            profitMargin: joi_1.default.number().optional().min(0),
            distance: joi_1.default.number().optional().min(0),
        }),
        updatePerformance: joi_1.default.object({
            actualProfit: joi_1.default.number().required().min(0),
            timeCompleted: joi_1.default.number().optional().min(0),
            notes: joi_1.default.string().optional().trim().max(1000),
        }),
        updateStatus: joi_1.default.object({
            status: joi_1.default.string().required().valid('active', 'inactive', 'deprecated'),
        }),
    },
    shipLoan: {
        request: joi_1.default.object({
            shipId: joi_1.default.string().required().trim().min(1).max(100),
            shipName: joi_1.default.string().required().trim().min(1).max(200),
            borrowerId: joi_1.default.string().required().trim().min(1).max(100),
            borrowerName: joi_1.default.string().required().trim().min(1).max(100),
            duration: joi_1.default.number().required().min(1).max(365),
            purpose: joi_1.default.string().required().trim().min(10).max(1000),
        }),
        updateStatus: joi_1.default.object({
            status: joi_1.default.string().optional().valid('pending', 'approved', 'active', 'returned', 'declined'),
            notes: joi_1.default.string().optional().trim().max(1000),
        }),
    },
    miningOperation: {
        create: joi_1.default.object({
            location: joi_1.default.string().required().trim().min(1).max(200),
            leaderId: joi_1.default.string().required().trim().min(1).max(100),
            targetResource: joi_1.default.string().required().trim().min(1).max(100),
            estimatedDuration: joi_1.default.number().optional().min(1),
        }),
        addCrew: joi_1.default.object({
            memberId: joi_1.default.string().required().trim().min(1).max(100),
            role: joi_1.default.string().required().trim().min(1).max(100),
        }),
        recordResources: joi_1.default.object({
            resourceType: joi_1.default.string().required().trim().min(1).max(100),
            quantity: joi_1.default.number().required().min(0),
            quality: joi_1.default.string().optional().valid('low', 'medium', 'high'),
        }),
        updateStatus: joi_1.default.object({
            status: joi_1.default.string().required().valid('planning', 'active', 'completed', 'cancelled'),
        }),
    },
    shipMaintenance: {
        schedule: joi_1.default.object({
            shipId: joi_1.default.string().required().trim().min(1).max(100),
            shipName: joi_1.default.string().required().trim().min(1).max(200),
            maintenanceType: joi_1.default.string().required().trim().min(1).max(100),
            scheduledDate: joi_1.default.date().required(),
            estimatedCost: joi_1.default.number().optional().min(0),
            priority: joi_1.default.string().optional().valid('low', 'medium', 'high', 'critical'),
            notes: joi_1.default.string().optional().trim().max(1000),
        }),
        updateStatus: joi_1.default.object({
            status: joi_1.default.string().required().valid('scheduled', 'in_progress', 'completed', 'cancelled'),
            actualCost: joi_1.default.number().optional().min(0),
            completionNotes: joi_1.default.string().optional().trim().max(1000),
        }),
    },
    bounty: {
        create: joi_1.default.object({
            targetId: joi_1.default.string().required().trim().min(1).max(100),
            targetName: joi_1.default.string().required().trim().min(1).max(200),
            reward: joi_1.default.number().required().min(0),
            description: joi_1.default.string().required().trim().min(10).max(2000),
            difficulty: joi_1.default.string().optional().valid('easy', 'medium', 'hard', 'extreme'),
            expiresAt: joi_1.default.date().optional(),
        }),
        claim: joi_1.default.object({
            hunterId: joi_1.default.string().required().trim().min(1).max(100),
            hunterName: joi_1.default.string().required().trim().min(1).max(200),
        }),
        complete: joi_1.default.object({
            proof: joi_1.default.string().optional().trim().max(2000),
            notes: joi_1.default.string().optional().trim().max(1000),
        }),
    },
    cargoManifest: {
        create: joi_1.default.object({
            shipId: joi_1.default.string().required().trim().min(1).max(100),
            shipName: joi_1.default.string().required().trim().min(1).max(200),
            ownerId: joi_1.default.string().required().trim().min(1).max(100),
            totalCapacity: joi_1.default.number().required().min(0),
        }),
        addCargo: joi_1.default.object({
            itemName: joi_1.default.string().required().trim().min(1).max(200),
            quantity: joi_1.default.number().required().min(0),
            weight: joi_1.default.number().optional().min(0),
            value: joi_1.default.number().optional().min(0),
            category: joi_1.default.string().optional().trim().max(100),
        }),
        updateStatus: joi_1.default.object({
            status: joi_1.default.string().required().valid('empty', 'loading', 'loaded', 'in_transit', 'unloading'),
        }),
        updateSharing: joi_1.default.object({
            isPublic: joi_1.default.boolean().required(),
            sharedWith: joi_1.default.array().items(joi_1.default.string()).optional(),
        }),
    },
    crewAssignment: {
        create: joi_1.default.object({
            shipId: joi_1.default.string().required().trim().min(1).max(100),
            memberId: joi_1.default.string().required().trim().min(1).max(100),
            role: joi_1.default.string().required().trim().min(1).max(100),
            startDate: joi_1.default.date().optional(),
            endDate: joi_1.default.date().optional(),
        }),
        update: joi_1.default.object({
            role: joi_1.default.string().optional().trim().min(1).max(100),
            endDate: joi_1.default.date().optional(),
            notes: joi_1.default.string().optional().trim().max(1000),
        }),
    },
    reputation: {
        create: joi_1.default.object({
            userId: joi_1.default.string().required().trim().min(1).max(100),
            organizationId: joi_1.default.string().required().trim().min(1).max(100),
            points: joi_1.default.number().required(),
            reason: joi_1.default.string().required().trim().min(5).max(500),
        }),
        update: joi_1.default.object({
            points: joi_1.default.number().optional(),
            reason: joi_1.default.string().optional().trim().min(5).max(500),
        }),
    },
    contract: {
        create: joi_1.default.object({
            title: joi_1.default.string().required().trim().min(5).max(200),
            description: joi_1.default.string().required().trim().min(10).max(2000),
            contractType: joi_1.default.string().required().valid('bounty', 'cargo', 'mining', 'escort', 'other'),
            reward: joi_1.default.number().required().min(0),
            deadline: joi_1.default.date().optional(),
            requiredParticipants: joi_1.default.number().optional().min(1),
        }),
        update: joi_1.default.object({
            title: joi_1.default.string().optional().trim().min(5).max(200),
            description: joi_1.default.string().optional().trim().min(10).max(2000),
            status: joi_1.default.string().optional().valid('open', 'in_progress', 'completed', 'cancelled'),
            reward: joi_1.default.number().optional().min(0),
        }),
    },
    allianceDiplomacy: {
        create: joi_1.default.object({
            allianceId: joi_1.default.string().required().trim().min(1).max(100),
            targetAllianceId: joi_1.default.string().required().trim().min(1).max(100),
            relationship: joi_1.default.string().required().valid('allied', 'neutral', 'hostile'),
            notes: joi_1.default.string().optional().trim().max(1000),
        }),
        update: joi_1.default.object({
            relationship: joi_1.default.string().optional().valid('allied', 'neutral', 'hostile'),
            notes: joi_1.default.string().optional().trim().max(1000),
        }),
    },
};
//# sourceMappingURL=schemaValidation.js.map