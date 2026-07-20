"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const importSource = joi_1.default.string().valid('scstats_json', 'scstats_csv', 'generic_csv').required();
exports.importSchemas = {
    create: joi_1.default.object({
        source: importSource.default('scstats_json'),
        jsonData: joi_1.default.when('source', {
            is: 'scstats_json',
            then: joi_1.default.string().trim().min(2).max(10_000_000).required(),
            otherwise: joi_1.default.forbidden(),
        }),
        csvData: joi_1.default.when('source', {
            is: 'generic_csv',
            then: joi_1.default.string().trim().min(2).max(10_000_000).optional(),
            otherwise: joi_1.default.forbidden(),
        }),
        consentGranted: joi_1.default.boolean().valid(true).required().messages({
            'any.only': 'Consent must be granted for data import (GDPR Article 6)',
        }),
    }),
    validate: joi_1.default.object({
        source: importSource.default('scstats_json'),
        jsonData: joi_1.default.when('source', {
            is: 'scstats_json',
            then: joi_1.default.string().trim().min(2).max(10_000_000).required(),
            otherwise: joi_1.default.forbidden(),
        }),
        csvData: joi_1.default.when('source', {
            is: 'generic_csv',
            then: joi_1.default.string().trim().min(2).max(10_000_000).required(),
            otherwise: joi_1.default.forbidden(),
        }),
    }),
    query: common_1.pagination,
};
//# sourceMappingURL=importSchemas.js.map