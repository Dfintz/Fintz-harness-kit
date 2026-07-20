"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationListQuerySchema = exports.userListQuerySchema = exports.tradingRouteListQuerySchema = exports.activityListQuerySchema = exports.shipListQuerySchema = exports.fleetListQuerySchema = exports.standardListQuerySchema = exports.fieldsQuerySchema = exports.searchQuerySchema = exports.sortQuerySchema = exports.paginationQuerySchema = void 0;
exports.validateQueryParams = validateQueryParams;
const joi_1 = __importDefault(require("joi"));
exports.paginationQuerySchema = joi_1.default.object({
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    offset: joi_1.default.number().integer().min(0).default(0),
    page: joi_1.default.number().integer().min(1).optional(),
});
exports.sortQuerySchema = joi_1.default.object({
    sort: joi_1.default.string()
        .pattern(/^[+-]?[a-zA-Z_][a-zA-Z0-9_]*$/)
        .optional(),
});
exports.searchQuerySchema = joi_1.default.object({
    search: joi_1.default.string().trim().max(200).optional(),
});
exports.fieldsQuerySchema = joi_1.default.object({
    fields: joi_1.default.string()
        .pattern(/^[a-zA-Z_][a-zA-Z0-9_]*(,[a-zA-Z_][a-zA-Z0-9_]*)*$/)
        .optional(),
});
exports.standardListQuerySchema = exports.paginationQuerySchema
    .concat(exports.sortQuerySchema)
    .concat(exports.searchQuerySchema)
    .concat(exports.fieldsQuerySchema);
exports.fleetListQuerySchema = exports.standardListQuerySchema.keys({
    'filter[status]': joi_1.default.string().valid('active', 'inactive', 'archived').optional(),
    'filter[name]': joi_1.default.string().trim().max(100).optional(),
});
exports.shipListQuerySchema = exports.standardListQuerySchema.keys({
    'filter[manufacturer]': joi_1.default.string().trim().max(100).optional(),
    'filter[size]': joi_1.default.string().valid('small', 'medium', 'large', 'capital').optional(),
    'filter[role]': joi_1.default.string().trim().max(50).optional(),
    'filter[status]': joi_1.default.string().valid('flight_ready', 'in_concept', 'in_production').optional(),
});
exports.activityListQuerySchema = exports.standardListQuerySchema.keys({
    'filter[status]': joi_1.default.string()
        .valid('draft', 'open', 'recruiting', 'ready', 'active', 'paused', 'completed', 'cancelled', 'archived')
        .optional(),
    'filter[type]': joi_1.default.string()
        .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
        .optional(),
    'filter[visibility]': joi_1.default.string().valid('public', 'organization', 'private').optional(),
});
exports.tradingRouteListQuerySchema = exports.standardListQuerySchema.keys({
    'filter[status]': joi_1.default.string().valid('active', 'inactive', 'deprecated').optional(),
    minProfit: joi_1.default.number().integer().min(0).optional(),
    maxDistance: joi_1.default.number().integer().min(0).optional(),
    cargoCapacity: joi_1.default.number().integer().min(0).optional(),
});
exports.userListQuerySchema = exports.standardListQuerySchema.keys({
    'filter[role]': joi_1.default.string().valid('user', 'admin', 'moderator').optional(),
    'filter[status]': joi_1.default.string().valid('active', 'inactive', 'suspended').optional(),
});
exports.organizationListQuerySchema = exports.standardListQuerySchema.keys({
    'filter[status]': joi_1.default.string().valid('active', 'inactive', 'pending').optional(),
    'filter[type]': joi_1.default.string().trim().max(50).optional(),
});
function validateQueryParams(query, schema) {
    return schema.validate(query, {
        allowUnknown: true,
        stripUnknown: false,
    });
}
//# sourceMappingURL=v2QuerySchemas.js.map