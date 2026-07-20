"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const uuidParam = (name) => joi_1.default.string()
    .trim()
    .uuid({ version: ['uuidv4'] })
    .required()
    .messages({ 'string.guid': `${name} must be a valid UUID` });
exports.roleSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        description: joi_1.default.string().trim().max(500).optional().allow('', null),
        scope: joi_1.default.string().valid('system', 'organization', 'fleet').default('organization'),
        permissions: joi_1.default.array().items(joi_1.default.string().trim().max(200)).optional(),
        organizationId: joi_1.default.string().uuid().optional(),
        priority: joi_1.default.number().integer().min(1).max(100).optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).optional(),
        description: joi_1.default.string().trim().max(500).optional().allow('', null),
        permissions: joi_1.default.array().items(joi_1.default.string().trim().max(200)).optional(),
        priority: joi_1.default.number().integer().min(1).max(100).optional(),
    }),
    reorder: joi_1.default.object({
        updates: joi_1.default.array()
            .items(joi_1.default.object({
            roleId: joi_1.default.string().trim().uuid().required(),
            priority: joi_1.default.number().integer().min(1).max(100).required(),
        }).unknown(false))
            .min(1)
            .required(),
    }).unknown(false),
    roleIdParam: joi_1.default.object({
        roleId: uuidParam('roleId'),
    }).unknown(false),
    orgRoleIdParams: joi_1.default.object({
        orgId: uuidParam('orgId'),
        roleId: uuidParam('roleId'),
    }).unknown(false),
    orgIdParam: joi_1.default.object({
        orgId: uuidParam('orgId'),
    }).unknown(false),
    roleIdUserIdParams: joi_1.default.object({
        roleId: uuidParam('roleId'),
        userId: uuidParam('userId'),
    }).unknown(false),
    roleIdPermissionIdParams: joi_1.default.object({
        roleId: uuidParam('roleId'),
        permissionId: joi_1.default.string().trim().min(1).max(200).required(),
    }).unknown(false),
    templateIdParam: joi_1.default.object({
        templateId: joi_1.default.string().trim().min(1).max(100).required(),
    }).unknown(false),
    assign: joi_1.default.object({
        userId: joi_1.default.string().uuid().required(),
        organizationId: joi_1.default.string().uuid().required(),
    }),
    addPermission: joi_1.default.object({
        permissionId: joi_1.default.string().trim().min(1).max(200).required(),
    }),
    applyTemplate: joi_1.default.object({
        roleName: joi_1.default.string().trim().min(1).max(100).required(),
        organizationId: joi_1.default.string().uuid().optional(),
    }),
    listQuery: joi_1.default.object({
        ...(0, common_1.paginationKeysWith)(50),
        organizationId: joi_1.default.string().uuid().optional(),
        includeSystem: joi_1.default.string().valid('true', 'false').optional(),
    }).unknown(false),
    searchByScopeQuery: joi_1.default.object({
        scope: joi_1.default.string().valid('system', 'organization', 'fleet').required(),
        organizationId: joi_1.default.string().uuid().optional(),
    }).unknown(false),
};
//# sourceMappingURL=roleSchemas.js.map