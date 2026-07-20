"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paramSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.paramSchemas = {
    entryId: joi_1.default.object({
        id: joi_1.default.string().uuid().required().messages({
            'string.guid': 'Invalid dead-letter entry ID format',
            'any.required': 'Dead-letter entry ID is required',
        }),
    }),
};
//# sourceMappingURL=deadLetterSchemas.js.map