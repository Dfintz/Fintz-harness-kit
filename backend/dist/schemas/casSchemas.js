"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.casSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.casSchemas = {
    getScore: joi_1.default.object({
        orgId: joi_1.default.string().uuid().required(),
    }),
    getHistory: joi_1.default.object({
        days: joi_1.default.number().integer().min(1).max(90).default(30),
    }),
    getHeatmap: joi_1.default.object({
        days: joi_1.default.number().integer().min(1).max(30).default(7),
        logScale: joi_1.default.boolean().default(true),
    }),
    getRanking: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(100).default(20),
    }),
};
//# sourceMappingURL=casSchemas.js.map