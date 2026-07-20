"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twoFactorSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.twoFactorSchemas = {
    verify: joi_1.default.object({
        token: joi_1.default.string().trim().length(6).pattern(/^\d+$/).required().messages({
            'string.length': 'Verification code must be exactly 6 digits',
            'string.pattern.base': 'Verification code must only contain numbers',
            'any.required': 'Verification code is required',
        }),
        backupCodes: joi_1.default.array().items(joi_1.default.string().trim().min(1)).required().messages({
            'any.required': 'Backup codes are required',
            'array.base': 'Backup codes must be an array',
        }),
    }),
    disable: joi_1.default.object({
        password: joi_1.default.string().min(1).required().messages({
            'any.required': 'Password is required to disable 2FA',
        }),
        token: joi_1.default.string().trim().length(6).pattern(/^\d+$/).optional().messages({
            'string.length': 'Verification code must be exactly 6 digits',
            'string.pattern.base': 'Verification code must only contain numbers',
        }),
    }),
    verifyLogin: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).required().messages({
            'any.required': 'User ID is required',
        }),
        token: joi_1.default.string().trim().length(6).pattern(/^\d+$/).required().messages({
            'string.length': 'Verification code must be exactly 6 digits',
            'string.pattern.base': 'Verification code must only contain numbers',
            'any.required': 'Verification code is required',
        }),
        rememberDevice: joi_1.default.boolean().optional().default(false),
    }),
    useBackupCode: joi_1.default.object({
        backupCode: joi_1.default.string().trim().min(6).max(16).required().messages({
            'any.required': 'Backup code is required',
        }),
    }),
};
//# sourceMappingURL=twoFactorSchemas.js.map