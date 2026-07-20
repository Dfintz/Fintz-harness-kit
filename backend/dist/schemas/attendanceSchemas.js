"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.attendanceSchemas = {
    initialize: joi_1.default.object({
        participantUserIds: joi_1.default.array().items(common_1.id).min(1).max(200).optional(),
        sendNotifications: joi_1.default.boolean().default(true),
        confirmationDeadline: joi_1.default.date().iso().optional().allow(null),
    }),
    confirm: joi_1.default.object({
        userId: common_1.id.optional(),
        attendanceType: joi_1.default.string().valid('in_person', 'virtual', 'remote').default('in_person'),
        arrivalTime: joi_1.default.date().iso().optional().allow(null),
        notes: common_1.notes,
    }),
    record: joi_1.default.object({
        userId: common_1.id,
        status: joi_1.default.string()
            .valid('confirmed', 'attended', 'partial', 'late', 'left_early', 'no_show', 'excused')
            .required(),
        attendanceType: joi_1.default.string().valid('in_person', 'virtual', 'remote').default('in_person'),
        arrivalTime: joi_1.default.date().iso().optional().allow(null),
        departureTime: joi_1.default.date().iso().optional().allow(null),
        durationMinutes: joi_1.default.number().integer().min(0).optional(),
        notes: common_1.notes,
    }),
    noShow: joi_1.default.object({
        userId: common_1.id,
        reason: joi_1.default.string().trim().max(500).optional(),
        isExcused: joi_1.default.boolean().default(false),
    }),
    rating: joi_1.default.object({
        performanceRating: joi_1.default.number().min(1).max(5).required(),
        feedback: joi_1.default.string().trim().max(1000).optional(),
        strengths: joi_1.default.array().items(joi_1.default.string().trim().max(100)).max(10).optional(),
        areasForImprovement: joi_1.default.array().items(joi_1.default.string().trim().max(100)).max(10).optional(),
    }),
    historyQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string()
            .valid('confirmed', 'attended', 'partial', 'late', 'left_early', 'no_show', 'excused')
            .optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    }),
};
//# sourceMappingURL=attendanceSchemas.js.map