"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregatorSchemas = exports.batchUpdateRouteStatusSchema = exports.analyzeSupplyChainSchema = exports.createTradeOperationSchema = exports.analyzeFleetCompositionSchema = exports.dissolveFleetSchema = exports.deployFleetSchema = exports.createFleetWithAssetsSchema = exports.getActivityDetailsSchema = exports.cancelActivitySchema = exports.completeActivitySchema = exports.createActivityWithParticipantsSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createActivityWithParticipantsSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    activityData: joi_1.default.object({
        title: joi_1.default.string().min(1).max(255).required(),
        description: joi_1.default.string().max(2000).optional(),
        activityType: joi_1.default.string().min(1).max(100).required(),
        scheduledStartDate: joi_1.default.date().iso().required(),
        scheduledEndDate: joi_1.default.date().iso().greater(joi_1.default.ref('scheduledStartDate')).optional(),
        maxParticipants: joi_1.default.number().integer().min(1).max(1000).optional(),
        creatorId: joi_1.default.string().uuid().required(),
    }).required(),
    participantIds: joi_1.default.array().items(joi_1.default.string().uuid()).max(1000).optional(),
    notifyParticipants: joi_1.default.boolean().default(false),
    postToDiscord: joi_1.default.boolean().default(false),
    discordChannelId: joi_1.default.string().optional(),
});
exports.completeActivitySchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    activityId: joi_1.default.string().uuid().required(),
    completedById: joi_1.default.string().uuid().required(),
    outcome: joi_1.default.string().valid('success', 'failed', 'cancelled').default('success'),
    summary: joi_1.default.string().max(2000).optional(),
    participantReports: joi_1.default.array()
        .items(joi_1.default.object({
        userId: joi_1.default.string().uuid().required(),
        attended: joi_1.default.boolean().required(),
        contribution: joi_1.default.string().max(500).optional(),
    }))
        .optional(),
    notifyParticipants: joi_1.default.boolean().default(false),
});
exports.cancelActivitySchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    activityId: joi_1.default.string().uuid().required(),
    cancelledById: joi_1.default.string().uuid().required(),
    reason: joi_1.default.string().max(500).optional(),
    notifyParticipants: joi_1.default.boolean().default(true),
});
exports.getActivityDetailsSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    activityId: joi_1.default.string().uuid().required(),
});
exports.createFleetWithAssetsSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    fleetData: joi_1.default.object({
        name: joi_1.default.string().min(1).max(255).required(),
        description: joi_1.default.string().max(2000).optional(),
        status: joi_1.default.string().optional(),
        teamId: joi_1.default.string().uuid().allow(null).optional(),
    }).required(),
    shipIds: joi_1.default.array().items(joi_1.default.string().uuid()).optional(),
    squadronData: joi_1.default.object({
        name: joi_1.default.string().min(1).max(255).required(),
        leaderId: joi_1.default.string().uuid().required(),
        memberIds: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).required(),
    }).optional(),
    inventoryItems: joi_1.default.array()
        .items(joi_1.default.object({
        name: joi_1.default.string().min(1).max(255).required(),
        category: joi_1.default.string().required(),
        quantity: joi_1.default.number().integer().min(0).required(),
        unit: joi_1.default.string().required(),
    }))
        .optional(),
    notifyMembers: joi_1.default.boolean().default(false),
    postToDiscord: joi_1.default.boolean().default(false),
    discordChannelId: joi_1.default.string().optional(),
});
exports.deployFleetSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    fleetId: joi_1.default.string().uuid().required(),
    deploymentData: joi_1.default.object({
        location: joi_1.default.string().min(1).max(255).required(),
        mission: joi_1.default.string().min(1).max(255).required(),
        objectives: joi_1.default.array().items(joi_1.default.string().max(500)).optional(),
        estimatedDuration: joi_1.default.string().max(100).optional(),
    }).required(),
    notifyMembers: joi_1.default.boolean().default(false),
});
exports.dissolveFleetSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    fleetId: joi_1.default.string().uuid().required(),
    dissolvedById: joi_1.default.string().uuid().required(),
    reason: joi_1.default.string().max(500).optional(),
    notifyMembers: joi_1.default.boolean().default(false),
});
exports.analyzeFleetCompositionSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    fleetId: joi_1.default.string().uuid().required(),
});
exports.createTradeOperationSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    operationData: joi_1.default.object({
        name: joi_1.default.string().min(1).max(255).required(),
        coordinatorId: joi_1.default.string().uuid().required(),
        route: joi_1.default.object({
            name: joi_1.default.string().min(1).max(255).required(),
            stops: joi_1.default.array()
                .items(joi_1.default.object({
                location: joi_1.default.string().min(1).max(255).required(),
                type: joi_1.default.string().valid('buy', 'sell', 'waypoint').required(),
                commodity: joi_1.default.string().optional(),
                quantity: joi_1.default.number().integer().min(0).optional(),
                price: joi_1.default.number().min(0).optional(),
            }))
                .min(2)
                .required(),
        }).required(),
    }).required(),
    notifyParticipants: joi_1.default.boolean().default(false),
    postToDiscord: joi_1.default.boolean().default(false),
    discordChannelId: joi_1.default.string().optional(),
});
exports.analyzeSupplyChainSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    commodities: joi_1.default.array().items(joi_1.default.string().min(1).max(100)).min(1).max(50).required(),
    startLocation: joi_1.default.string().min(1).max(255).required(),
    endLocation: joi_1.default.string().min(1).max(255).optional(),
    budget: joi_1.default.number().min(0).optional(),
    includeSuppliers: joi_1.default.boolean().default(false),
});
exports.batchUpdateRouteStatusSchema = joi_1.default.object({
    organizationId: joi_1.default.string().uuid().required(),
    routeIds: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).max(100).required(),
    newStatus: joi_1.default.string().required(),
    updatedById: joi_1.default.string().uuid().required(),
    reason: joi_1.default.string().max(500).optional(),
});
exports.aggregatorSchemas = {
    createActivityWithParticipants: exports.createActivityWithParticipantsSchema,
    completeActivity: exports.completeActivitySchema,
    cancelActivity: exports.cancelActivitySchema,
    getActivityDetails: exports.getActivityDetailsSchema,
    createFleetWithAssets: exports.createFleetWithAssetsSchema,
    deployFleet: exports.deployFleetSchema,
    dissolveFleet: exports.dissolveFleetSchema,
    analyzeFleetComposition: exports.analyzeFleetCompositionSchema,
    createTradeOperation: exports.createTradeOperationSchema,
    analyzeSupplyChain: exports.analyzeSupplyChainSchema,
    batchUpdateRouteStatus: exports.batchUpdateRouteStatusSchema,
};
//# sourceMappingURL=aggregatorSchemas.js.map