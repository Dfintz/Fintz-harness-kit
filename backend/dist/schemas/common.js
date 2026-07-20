"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.querySchemas = exports.paramSchemas = exports.applicationQuestionSchema = exports.description = exports.notes = exports.coordinates = exports.idArray = exports.statusActive = exports.optionalUrl = exports.url = exports.optionalEmail = exports.email = exports.dateRange = exports.pageSizeKeysWith = exports.paginationKeys = exports.pagination = exports.paginationKeysWith = exports.optionalUuid = exports.uuid = exports.optionalId = exports.id = void 0;
const joi_1 = __importDefault(require("joi"));
exports.id = joi_1.default.string().trim().min(1).max(100).required();
exports.optionalId = joi_1.default.string().trim().min(1).max(100).optional();
exports.uuid = joi_1.default.string().uuid().required();
exports.optionalUuid = joi_1.default.string().uuid().optional();
const paginationKeysWith = (limitDefault = 20, maxLimit = 100) => ({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(maxLimit).default(limitDefault),
});
exports.paginationKeysWith = paginationKeysWith;
exports.pagination = joi_1.default.object((0, exports.paginationKeysWith)());
exports.paginationKeys = (0, exports.paginationKeysWith)();
const pageSizeKeysWith = (pageSizeDefault = 20, maxPageSize = 100) => ({
    page: joi_1.default.number().integer().min(1).default(1),
    pageSize: joi_1.default.number().integer().min(1).max(maxPageSize).default(pageSizeDefault),
});
exports.pageSizeKeysWith = pageSizeKeysWith;
exports.dateRange = joi_1.default.object({
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
});
exports.email = joi_1.default.string().email().trim().lowercase().required();
exports.optionalEmail = joi_1.default.string().email().trim().lowercase().optional();
exports.url = joi_1.default.string().uri().trim().required();
exports.optionalUrl = joi_1.default.string().uri().trim().optional();
exports.statusActive = joi_1.default.string().valid('active', 'inactive').default('active');
exports.idArray = joi_1.default.array().items(exports.id).min(1).max(100);
exports.coordinates = joi_1.default.object({
    x: joi_1.default.number().required(),
    y: joi_1.default.number().required(),
    z: joi_1.default.number().required(),
});
exports.notes = joi_1.default.string().trim().max(2000).optional().allow(null, '');
exports.description = joi_1.default.string().trim().max(1000).optional();
exports.applicationQuestionSchema = joi_1.default.object({
    id: joi_1.default.string().uuid().required(),
    label: joi_1.default.string().max(200).required(),
    fieldKey: joi_1.default.string().max(100).optional(),
    type: joi_1.default.string().valid('short', 'paragraph', 'select', 'checkbox', 'rules').required(),
    required: joi_1.default.boolean().required(),
    placeholder: joi_1.default.string().max(200).optional().allow(''),
    options: joi_1.default.array().items(joi_1.default.string().max(100)).max(20).optional(),
    maxLength: joi_1.default.number().integer().min(1).max(5000).optional(),
    order: joi_1.default.number().integer().min(0).required(),
});
exports.paramSchemas = {
    id: joi_1.default.object({ id: exports.id }),
    uuid: joi_1.default.object({ uuid: exports.uuid }),
    squadronId: joi_1.default.object({
        squadronId: exports.id.description('Squadron ID'),
    }),
    userId: joi_1.default.object({
        userId: exports.id.description('User ID'),
    }),
    orgId: joi_1.default.object({
        orgId: exports.id.description('Organization ID'),
    }),
    shipId: joi_1.default.object({
        shipId: exports.id.description('Ship ID'),
    }),
    memberId: joi_1.default.object({
        memberId: exports.id.description('Member ID'),
    }),
    federationId: joi_1.default.object({
        federationId: exports.id.description('Federation ID'),
    }),
    jobId: joi_1.default.object({
        jobId: exports.uuid.required().description('Job listing ID'),
    }),
    applicationId: joi_1.default.object({
        applicationId: exports.uuid.required().description('Application ID'),
    }),
    jobIdAndApplicationId: joi_1.default.object({
        jobId: exports.uuid.required().description('Job listing ID'),
        applicationId: exports.uuid.required().description('Application ID'),
    }),
    identifier: joi_1.default.object({
        identifier: joi_1.default.string()
            .trim()
            .min(1)
            .max(255)
            .pattern(/^[a-z0-9-]+$/i)
            .required()
            .description('UUID or URL slug'),
    }),
};
exports.querySchemas = {
    pagination: exports.pagination,
    dateRange: exports.dateRange,
    search: joi_1.default.object({
        query: joi_1.default.string().trim().max(200).optional(),
    }),
};
//# sourceMappingURL=common.js.map