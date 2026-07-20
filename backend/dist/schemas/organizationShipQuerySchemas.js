"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationShipQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...(0, common_1.paginationKeysWith)(10),
    sortBy: joi_1.default.string().valid('name', 'type', 'status', 'createdAt', 'fleet').default('name'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('ASC'),
};
exports.organizationShipQuerySchemas = {
    listQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string()
            .valid('ACTIVE', 'MAINTENANCE', 'DEPLOYED', 'DAMAGED', 'RETIRED')
            .optional(),
        type: joi_1.default.string().valid('SPACECRAFT', 'VEHICLE', 'GROUND').optional(),
        fleetId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional(),
        unassigned: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
        'number.base': '{#label} must be a number',
    }),
    shipIdParam: joi_1.default.object({
        shipId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    fleetIdParam: joi_1.default.object({
        fleetId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    assignFleetBody: joi_1.default.object({
        fleetId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
        role: joi_1.default.string().valid('LEAD', 'WING', 'SUPPORT', 'SCOUT', 'OTHER').optional(),
    }).unknown(false),
    unassignFleetBody: joi_1.default.object({
        fleetId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    locationQuery: joi_1.default.object({
        includeHistory: joi_1.default.boolean().optional(),
    }).unknown(false),
};
//# sourceMappingURL=organizationShipQuerySchemas.js.map