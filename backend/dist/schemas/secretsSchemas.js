"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretsSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.secretsSchemas = {
    checkRotation: joi_1.default.object({
        maxAge: joi_1.default.number()
            .integer()
            .min(1)
            .max(365)
            .default(90)
            .description('Maximum age in days before rotation is recommended'),
    }),
    rotateJwt: joi_1.default.object({
        confirm: joi_1.default.boolean().valid(true).required().messages({
            'any.only': 'You must confirm with { "confirm": true } to proceed',
        }),
    }),
    rotateEncryption: joi_1.default.object({
        confirm: joi_1.default.boolean().valid(true).required().messages({
            'any.only': 'You must confirm with { "confirm": true } to proceed',
        }),
    }),
    rotateDbPassword: joi_1.default.object({
        newPassword: joi_1.default.string()
            .min(12)
            .max(256)
            .required()
            .description('New database password (minimum 12 characters)'),
        confirm: joi_1.default.boolean().valid(true).required().messages({
            'any.only': 'You must confirm with { "confirm": true } to proceed',
        }),
    }),
};
//# sourceMappingURL=secretsSchemas.js.map