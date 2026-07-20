"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.commentSchemas = {
    create: joi_1.default.object({
        content: joi_1.default.string().trim().min(1).max(5000).required(),
        resourceType: joi_1.default.string().trim().min(1).max(64).required(),
        resourceId: joi_1.default.string().trim().min(1).max(255).required(),
    }),
    update: joi_1.default.object({
        content: joi_1.default.string().trim().min(1).max(5000).required(),
    }),
    reply: joi_1.default.object({
        content: joi_1.default.string().trim().min(1).max(5000).required(),
    }),
    query: joi_1.default.object({
        resourceType: joi_1.default.string().trim().min(1).max(64).required(),
        resourceId: joi_1.default.string().trim().min(1).max(255).required(),
        ...common_1.paginationKeys,
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
    }),
    param: joi_1.default.object({
        commentId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=commentSchemas.js.map