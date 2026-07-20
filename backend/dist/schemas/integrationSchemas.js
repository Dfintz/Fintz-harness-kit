"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.integrationSchemas = {
    integrationName: joi_1.default.object({
        name: joi_1.default.string()
            .trim()
            .min(1)
            .max(100)
            .required()
            .messages({ 'string.empty': 'Integration name is required' }),
    }),
};
//# sourceMappingURL=integrationSchemas.js.map