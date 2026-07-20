"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applicationQuestionsSchema = exports.orgApplicationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.orgApplicationSchemas = {
    submit: joi_1.default.object({
        message: joi_1.default.string().max(1000).optional().allow(''),
        formResponses: joi_1.default.object().pattern(joi_1.default.string().uuid(), joi_1.default.string().max(2000)).optional(),
        source: joi_1.default.string().valid('web', 'discord', 'api').optional(),
    }),
    review: joi_1.default.object({
        decision: joi_1.default.string().valid('approved', 'rejected').required(),
        note: joi_1.default.string().max(500).optional().allow(''),
    }),
    listQuery: joi_1.default.object({
        status: joi_1.default.string().valid('pending', 'approved', 'rejected', 'withdrawn').optional(),
        page: joi_1.default.number().integer().min(1).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
    }),
};
exports.applicationQuestionsSchema = joi_1.default.object({
    applicationQuestions: joi_1.default.array().items(common_1.applicationQuestionSchema).max(20).required(),
});
//# sourceMappingURL=orgApplicationSchemas.js.map