"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const Activity_1 = require("../models/Activity");
const common_1 = require("./common");
const activityTypes = Object.values(Activity_1.ActivityType);
const activityStatuses = Object.values(Activity_1.ActivityStatus);
const visibilities = Object.values(Activity_1.ActivityVisibility);
const _participantRoles = Object.values(Activity_1.ParticipantRole);
const stringToArray = (allowed) => joi_1.default.alternatives()
    .try(joi_1.default.array()
    .items(joi_1.default.string().valid(...allowed))
    .unique(), joi_1.default.string().custom((value, helpers) => {
    if (typeof value !== 'string') {
        return helpers.error('any.invalid');
    }
    const items = value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    const { error, value: validated } = joi_1.default.array()
        .items(joi_1.default.string().valid(...allowed))
        .unique()
        .validate(items, { convert: true });
    if (error) {
        return helpers.error('any.invalid');
    }
    return validated;
}))
    .optional();
exports.activityQuerySchemas = {
    search: common_1.pagination.keys({
        activityType: stringToArray(activityTypes),
        status: stringToArray(activityStatuses),
        visibility: joi_1.default.string()
            .valid(...visibilities)
            .optional(),
        organizationId: joi_1.default.string().trim().optional(),
        creatorId: joi_1.default.string().trim().optional(),
        tags: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string()).unique(), joi_1.default.string().custom((value, helpers) => {
            if (typeof value !== 'string') {
                return helpers.error('any.invalid');
            }
            const items = value
                .split(',')
                .map(v => v.trim())
                .filter(Boolean);
            return items;
        }))
            .optional(),
        categories: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string()).unique(), joi_1.default.string().custom((value, helpers) => {
            if (typeof value !== 'string') {
                return helpers.error('any.invalid');
            }
            const items = value
                .split(',')
                .map(v => v.trim())
                .filter(Boolean);
            return items;
        }))
            .optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
        searchTerm: joi_1.default.string().trim().max(200).optional(),
        isFeatured: joi_1.default.boolean().optional(),
        isUrgent: joi_1.default.boolean().optional(),
        withExpired: joi_1.default.boolean().optional(),
        minParticipants: joi_1.default.number().integer().min(0).optional(),
        maxParticipants: joi_1.default.number().integer().min(0).optional(),
    }),
    idParam: joi_1.default.object({
        id: joi_1.default.string().trim().required(),
    }),
};
//# sourceMappingURL=activityQuerySchemas.js.map