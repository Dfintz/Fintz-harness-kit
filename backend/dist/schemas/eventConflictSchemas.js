"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventConflictSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const Activity_1 = require("../models/Activity");
const activityTypes = Object.values(Activity_1.ActivityType);
const activityStatuses = Object.values(Activity_1.ActivityStatus);
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
const conflictOptions = joi_1.default.object({
    includeTypes: stringToArray(activityTypes),
    excludeTypes: stringToArray(activityTypes),
    includeStatuses: stringToArray(activityStatuses),
    excludeStatuses: stringToArray(activityStatuses),
    userId: joi_1.default.string().trim().optional(),
    bufferMinutes: joi_1.default.number().integer().min(0).max(1440).optional(),
    adjacentThresholdMinutes: joi_1.default.number().integer().min(0).max(120).optional(),
    skipSuggestions: joi_1.default.boolean().optional(),
}).optional();
exports.eventConflictSchemas = {
    checkConflictsBody: joi_1.default.object({
        startDate: joi_1.default.date().iso().required(),
        endDate: joi_1.default.date().iso().required(),
        excludeActivityId: joi_1.default.string().trim().optional(),
        options: conflictOptions,
    }),
    activityParams: joi_1.default.object({
        activityId: joi_1.default.string().trim().required(),
    }),
    userParams: joi_1.default.object({
        userId: joi_1.default.string().trim().required(),
    }),
    rangeQuery: joi_1.default.object({
        startDate: joi_1.default.date().iso().required(),
        endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).required(),
        includeTypes: stringToArray(activityTypes),
        excludeTypes: stringToArray(activityTypes),
    }),
    optionsQuery: joi_1.default.object({
        includeTypes: stringToArray(activityTypes),
        excludeTypes: stringToArray(activityTypes),
        bufferMinutes: joi_1.default.number().integer().min(0).max(1440).optional(),
    }),
};
//# sourceMappingURL=eventConflictSchemas.js.map