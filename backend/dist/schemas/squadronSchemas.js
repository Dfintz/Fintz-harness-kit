"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.squadronSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.squadronSchemas = {
    singleMember: joi_1.default.object({
        userId: common_1.id,
        role: joi_1.default.string().trim().max(50).optional(),
        shipType: joi_1.default.string().trim().max(100).optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').default('active'),
        joinDate: joi_1.default.date().iso().optional(),
        notes: joi_1.default.string().trim().max(1000).optional().allow(null, '')
    }),
    bulkAddMembers: joi_1.default.object({
        members: joi_1.default.array().items(joi_1.default.object({
            userId: common_1.id,
            role: joi_1.default.string().trim().max(50).optional(),
            shipType: joi_1.default.string().trim().max(100).optional(),
            status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').default('active'),
        })).min(1).max(100).required(),
    }),
    bulkUpdateMembers: joi_1.default.object({
        updates: joi_1.default.array().items(joi_1.default.object({
            id: common_1.id,
            data: joi_1.default.object({
                role: joi_1.default.string().trim().max(50).optional(),
                shipType: joi_1.default.string().trim().max(100).optional(),
                status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
            }).required(),
        })).min(1).max(100).required(),
    }),
    bulkDeleteMembers: joi_1.default.object({
        memberIds: common_1.idArray,
    }),
    bulkUpdateStatus: joi_1.default.object({
        memberIds: common_1.idArray,
        status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').required(),
    }),
    updateRole: joi_1.default.object({
        role: joi_1.default.string().trim().max(50).required()
    }),
    query: joi_1.default.object({
        status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
        role: joi_1.default.string().trim().max(50).optional(),
        shipType: joi_1.default.string().trim().max(100).optional(),
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(10)
    })
};
//# sourceMappingURL=squadronSchemas.js.map