"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.organizationSchemas = {
    create: joi_1.default.object({
        id: common_1.id,
        name: joi_1.default.string().trim().min(3).max(100).required(),
        description: common_1.description,
        type: joi_1.default.string().valid('root', 'division', 'department', 'team', 'project').default('root'),
        status: joi_1.default.string().valid('active', 'inactive', 'archived').default('active'),
        members: joi_1.default.array().items(joi_1.default.string()).default([]),
        parentId: joi_1.default.string().trim().optional().allow(null),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(100).optional(),
        description: common_1.description,
        type: joi_1.default.string().valid('root', 'division', 'department', 'team', 'project').optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'archived').optional(),
        parentId: joi_1.default.string().trim().optional().allow(null),
    }),
    rename: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(100).required(),
    }),
    addMember: joi_1.default.object({
        userId: common_1.id,
        role: joi_1.default.string().valid('owner', 'admin', 'member', 'guest').default('member'),
    }),
    updateMemberRole: joi_1.default.object({
        role: joi_1.default.string()
            .pattern(/^[a-z][a-z0-9_-]{1,49}$/i)
            .messages({
            'string.pattern.base': 'Invalid role name. Only letters, numbers, hyphens, and underscores are allowed (2–50 chars, must start with a letter).',
        }),
        roleId: joi_1.default.string().uuid(),
    }).xor('role', 'roleId'),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        type: joi_1.default.string().valid('root', 'division', 'department', 'team', 'project').optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'archived').optional(),
        search: joi_1.default.string().trim().max(100).optional(),
        parentId: joi_1.default.string().trim().optional(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
    createSubOrg: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(100).required(),
        parentOrgId: common_1.id.required(),
        description: joi_1.default.string().trim().max(500).optional(),
    }),
    moveHierarchy: joi_1.default.object({
        targetParentId: common_1.id.required(),
        position: joi_1.default.number().integer().min(0).optional(),
    }),
    grantPermission: joi_1.default.object({
        userId: common_1.id.required(),
        permissions: joi_1.default.array()
            .items(joi_1.default.string().valid('read', 'write', 'delete', 'admin', 'manage_members', 'manage_roles'))
            .min(1)
            .required(),
    }),
    move: joi_1.default.object({
        newParentId: joi_1.default.string().trim().required().allow(null),
    }),
    onboardMember: joi_1.default.object({
        userId: common_1.id.required(),
        role: joi_1.default.string().valid('owner', 'admin', 'member', 'guest').default('member'),
        title: joi_1.default.string().trim().max(100).optional(),
        permissions: joi_1.default.array()
            .items(joi_1.default.object({
            resource: joi_1.default.string().required(),
            actions: joi_1.default.array().items(joi_1.default.string()).min(1).required(),
        }))
            .optional(),
        message: joi_1.default.string().trim().max(500).optional(),
        sendNotification: joi_1.default.boolean().default(true),
    }),
    offboardMember: joi_1.default.object({
        reason: joi_1.default.string().trim().max(500).optional(),
    }),
    bulkInvite: joi_1.default.object({
        invitations: joi_1.default.array()
            .items(joi_1.default.object({
            userId: common_1.id.required(),
            role: joi_1.default.string().valid('owner', 'admin', 'member', 'guest').default('member'),
            permissions: joi_1.default.array()
                .items(joi_1.default.object({
                resource: joi_1.default.string().required(),
                actions: joi_1.default.array().items(joi_1.default.string()).min(1).required(),
            }))
                .optional(),
        }))
            .min(1)
            .required(),
    }),
};
//# sourceMappingURL=organizationSchemas.js.map