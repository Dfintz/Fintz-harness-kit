"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.miningSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.miningSchemas = {
    create: joi_1.default.object({
        location: joi_1.default.string().trim().min(1).max(200).required(),
        coordinates: common_1.coordinates.optional(),
        resourceType: joi_1.default.string().trim().min(1).max(100).required(),
        estimatedYield: joi_1.default.number().min(0).optional(),
        difficulty: joi_1.default.string().valid('easy', 'medium', 'hard', 'extreme').optional(),
        requiredShips: joi_1.default.array().items(joi_1.default.string()).optional(),
        maxParticipants: joi_1.default.number().integer().min(1).max(50).optional(),
        scheduledStart: joi_1.default.date().iso().optional(),
        notes: common_1.notes,
    }),
    update: joi_1.default.object({
        location: joi_1.default.string().trim().min(1).max(200).optional(),
        resourceType: joi_1.default.string().trim().min(1).max(100).optional(),
        status: joi_1.default.string().valid('planned', 'active', 'completed', 'cancelled').optional(),
        actualYield: joi_1.default.number().min(0).optional(),
        notes: common_1.notes,
    }),
    recordYield: joi_1.default.object({
        resource: joi_1.default.string().trim().required(),
        quantity: joi_1.default.number().min(0).required(),
        quality: joi_1.default.string().valid('low', 'medium', 'high', 'excellent').optional(),
        participantId: common_1.id,
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string().valid('planned', 'active', 'completed', 'cancelled').optional(),
        resourceType: joi_1.default.string().trim().optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
    createOperation: joi_1.default.object({
        location: joi_1.default.string().trim().required(),
        resourceType: joi_1.default.string().trim().required(),
        shipId: common_1.id.required(),
        crewSize: joi_1.default.number().integer().min(1).optional(),
    }),
    addCrewMember: joi_1.default.object({
        userId: common_1.id.required(),
        role: joi_1.default.string().required(),
    }),
    updateResources: joi_1.default.object({
        resources: joi_1.default.array()
            .items(joi_1.default.object({
            type: joi_1.default.string().required(),
            quantity: joi_1.default.number().min(0).required(),
            value: joi_1.default.number().min(0).optional(),
        }))
            .required(),
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string().valid('planned', 'active', 'completed', 'cancelled').required(),
        notes: joi_1.default.string().max(500).optional(),
    }),
};
//# sourceMappingURL=miningSchemas.js.map