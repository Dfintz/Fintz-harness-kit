"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.exportSchemas = {
    create: joi_1.default.object({
        type: joi_1.default.string().trim().valid('full', 'fleet', 'profile', 'activity').default('full'),
        format: joi_1.default.string().trim().valid('json', 'csv').default('json'),
        filters: joi_1.default.object({
            startDate: joi_1.default.date().iso().optional(),
            endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
        }).optional(),
    }),
    query: common_1.pagination,
    attendanceCorrelation: joi_1.default.object({
        activityId: joi_1.default.string().trim().uuid().optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
        format: joi_1.default.string().trim().valid('json', 'csv').default('json'),
    }),
};
//# sourceMappingURL=exportSchemas.js.map