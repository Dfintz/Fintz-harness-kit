"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.authSchemas = {
    login: joi_1.default.object({
        username: joi_1.default.string().trim().min(1).max(100).required().messages({
            'string.empty': 'Username is required',
            'any.required': 'Username is required',
        }),
        password: joi_1.default.string().min(1).max(256).required().messages({
            'string.empty': 'Password is required',
            'any.required': 'Password is required',
        }),
    }),
    demoLogin: joi_1.default.object({
        username: joi_1.default.string().trim().min(1).max(100),
        email: joi_1.default.string()
            .trim()
            .email({ tlds: { allow: false } }),
        role: joi_1.default.string().trim().valid('admin', 'user', 'moderator').messages({
            'any.only': 'Role must be admin, user, or moderator',
        }),
    }),
    sandboxLogin: joi_1.default.object({}).max(0).messages({
        'object.max': 'Sandbox login does not accept request body fields',
    }),
    refresh: joi_1.default.object({
        refreshToken: joi_1.default.string().trim().min(1).required().messages({
            'string.empty': 'Refresh token is required',
            'any.required': 'Refresh token is required',
        }),
    }),
    logout: joi_1.default.object({
        refreshToken: joi_1.default.string().trim().min(1).optional().messages({
            'string.empty': 'Refresh token is required',
        }),
    }),
};
//# sourceMappingURL=authSchemas.js.map