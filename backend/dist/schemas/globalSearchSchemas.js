"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSearchSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const validTypes = ['organization', 'federation', 'user'];
exports.globalSearchSchemas = {
    searchQuery: joi_1.default.object({
        q: joi_1.default.string().min(2).max(100).required()
            .messages({
            'string.min': 'Search query must be at least 2 characters',
            'string.max': 'Search query must not exceed 100 characters',
            'any.required': 'Search query (q) is required',
        }),
        types: joi_1.default.string().optional()
            .custom((value) => {
            const parsed = value.split(',').map((v) => v.trim());
            for (const t of parsed) {
                if (!validTypes.includes(t)) {
                    throw new Error(`Invalid type: ${t}. Allowed: ${validTypes.join(', ')}`);
                }
            }
            return parsed;
        }),
        limit: joi_1.default.number().integer().min(1).max(20).default(5).optional(),
    }),
};
//# sourceMappingURL=globalSearchSchemas.js.map