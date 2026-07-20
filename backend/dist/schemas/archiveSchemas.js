"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const resourceType = joi_1.default.string().max(50).trim();
const resourceId = joi_1.default.string().uuid();
exports.archiveSchemas = {
    create: joi_1.default.object({
        resourceType: resourceType.required(),
        resourceId: resourceId.required(),
        reason: joi_1.default.string().max(500).trim(),
    }),
    bulk: joi_1.default.object({
        records: joi_1.default.array()
            .items(joi_1.default.object({
            resourceType: resourceType.required(),
            resourceId: resourceId.required(),
        }))
            .min(1)
            .max(100)
            .required(),
        reason: joi_1.default.string().max(500).trim(),
    }),
    query: common_1.pagination.keys({
        type: resourceType,
        startDate: joi_1.default.date().iso(),
        endDate: joi_1.default.date().iso().greater(joi_1.default.ref('startDate')),
    }),
    search: common_1.pagination.keys({
        q: joi_1.default.string().max(200).trim(),
        type: resourceType,
        startDate: joi_1.default.date().iso(),
        endDate: joi_1.default.date().iso().greater(joi_1.default.ref('startDate')),
    }),
    param: joi_1.default.object({
        archiveId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=archiveSchemas.js.map