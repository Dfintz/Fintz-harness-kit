"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.equipmentSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.equipmentSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        type: joi_1.default.string()
            .valid('weapon', 'armor', 'component', 'consumable', 'tool', 'attachment')
            .required(),
        rarity: joi_1.default.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').default('common'),
        description: common_1.description,
        shipId: joi_1.default.string().trim().max(100).optional(),
        metadata: joi_1.default.object().optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        description: common_1.description,
        rarity: joi_1.default.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
        status: joi_1.default.string().valid('available', 'equipped', 'damaged', 'destroyed').optional(),
        metadata: joi_1.default.object().optional(),
    }).min(1),
    transfer: joi_1.default.object({
        toUserId: joi_1.default.string().trim().min(1).max(100).required(),
        reason: joi_1.default.string().trim().max(500).optional(),
    }),
    compatibilityQuery: joi_1.default.object({
        shipId: joi_1.default.string().trim().max(100).optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        type: joi_1.default.string()
            .valid('weapon', 'armor', 'component', 'consumable', 'tool', 'attachment')
            .optional(),
        rarity: joi_1.default.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
        status: joi_1.default.string().valid('available', 'equipped', 'damaged', 'destroyed').optional(),
    }),
    param: joi_1.default.object({
        equipmentId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    userParam: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
};
//# sourceMappingURL=equipmentSchemas.js.map