"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEventDate = exports.eventSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.eventSchemas = {
    create: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required(),
        description: common_1.description,
        date: joi_1.default.date().iso().optional(),
        scheduledStartTime: joi_1.default.date().iso().optional(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(1440).optional().default(60),
        maxParticipants: joi_1.default.number().integer().min(1).max(100).optional(),
        requiredShips: joi_1.default.array().items(joi_1.default.string()).optional(),
        difficulty: joi_1.default.string().valid('easy', 'medium', 'hard', 'expert').optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        requirements: joi_1.default.string().trim().max(500).optional(),
        activityType: joi_1.default.string().optional(),
    }).or('date', 'scheduledStartTime'),
    update: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        description: common_1.description,
        date: joi_1.default.date().iso().optional(),
        scheduledStartTime: joi_1.default.date().iso().optional(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(1440).optional(),
        maxParticipants: joi_1.default.number().integer().min(1).max(100).optional(),
        status: joi_1.default.string().valid('draft', 'scheduled', 'active', 'completed', 'cancelled').optional(),
        location: joi_1.default.string().trim().max(200).optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string().valid('draft', 'scheduled', 'active', 'completed', 'cancelled').optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        organizationId: joi_1.default.string().trim().optional(),
        activityType: joi_1.default.string().optional(),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
};
const normalizeEventDate = (body) => {
    if (body.date && !body.scheduledStartTime) {
        body.scheduledStartTime = body.date;
    }
};
exports.normalizeEventDate = normalizeEventDate;
//# sourceMappingURL=eventSchemas.js.map