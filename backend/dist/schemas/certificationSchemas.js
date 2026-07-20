"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.certificationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const certificationStatuses = ['active', 'revoked', 'expired'];
exports.certificationSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        description: joi_1.default.string().trim().max(2000).optional(),
        requirements: joi_1.default.string().trim().max(5000).optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        description: joi_1.default.string().trim().max(2000).allow('').optional(),
        requirements: joi_1.default.string().trim().max(5000).allow('').optional(),
    }).min(1),
    award: joi_1.default.object({
        userId: joi_1.default.string().uuid().required(),
    }),
    revoke: joi_1.default.object({
        userId: joi_1.default.string().uuid().required(),
        reason: joi_1.default.string().trim().min(1).max(1000).required(),
    }),
    query: joi_1.default.object({
        status: joi_1.default.string()
            .valid(...certificationStatuses)
            .optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).default(50),
    }),
    param: joi_1.default.object({
        certificationId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=certificationSchemas.js.map