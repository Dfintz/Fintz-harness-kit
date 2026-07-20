"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.achievementSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.achievementSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        type: joi_1.default.string().valid('title', 'badge').optional(),
        description: common_1.description,
        category: joi_1.default.string().trim().max(50).optional(),
        rarity: joi_1.default.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
        icon: joi_1.default.string().uri().max(500).allow('', null).optional(),
        metadata: joi_1.default.object().optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        type: joi_1.default.string().valid('title', 'badge').optional(),
        description: common_1.description,
        category: joi_1.default.string().trim().max(50).optional(),
        rarity: joi_1.default.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
        icon: joi_1.default.string().uri().max(500).allow('', null).optional(),
        metadata: joi_1.default.object().optional(),
        isActive: joi_1.default.boolean().optional(),
    }),
    award: joi_1.default.object({
        userId: joi_1.default.string().trim().required(),
    }),
    revoke: joi_1.default.object({
        userId: joi_1.default.string().trim().required(),
    }),
    toggleDisplay: joi_1.default.object({
        isDisplayed: joi_1.default.boolean().required(),
    }),
    query: common_1.pagination.keys({
        category: joi_1.default.string().trim().max(50).optional(),
        rarity: joi_1.default.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
        type: joi_1.default.string().valid('title', 'badge').optional(),
    }),
    param: joi_1.default.object({
        achievementId: joi_1.default.string().trim().required(),
    }),
    displayParam: joi_1.default.object({
        userAchievementId: joi_1.default.string().trim().required(),
    }),
};
//# sourceMappingURL=achievementSchemas.js.map