"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'avif'];
const RESIZE_PRESETS = ['thumbnail', 'small', 'medium', 'large'];
exports.imageSchemas = {
    uploadQuery: joi_1.default.object({
        quality: joi_1.default.number().integer().min(1).max(100).optional(),
        format: joi_1.default.string()
            .valid(...ALLOWED_FORMATS)
            .optional(),
        resize: joi_1.default.string()
            .valid(...RESIZE_PRESETS)
            .optional(),
        variants: joi_1.default.string().valid('true', 'false').optional(),
        width: joi_1.default.number().integer().min(1).max(8192).optional(),
        height: joi_1.default.number().integer().min(1).max(8192).optional(),
    }).options({ allowUnknown: false }),
    fileNameParam: joi_1.default.object({
        fileName: joi_1.default.string()
            .trim()
            .max(512)
            .custom((value, helpers) => {
            if (value.includes('..') || value.includes('/') || value.includes('\\')) {
                return helpers.error('any.invalid');
            }
            return value;
        }, 'path traversal check')
            .pattern(/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/, 'valid filename')
            .required()
            .messages({
            'any.invalid': 'fileName must be a basename only (no path separators or .. segments)',
        }),
    }),
    listQuery: joi_1.default.object({
        prefix: joi_1.default.string().trim().max(256).optional(),
        ...(0, common_1.pageSizeKeysWith)(20),
    }).options({ allowUnknown: false }),
    validateQuery: joi_1.default.object({
        mimeType: joi_1.default.string()
            .valid(...ALLOWED_MIME_TYPES)
            .optional(),
    }).options({ allowUnknown: false }),
};
//# sourceMappingURL=imageSchemas.js.map