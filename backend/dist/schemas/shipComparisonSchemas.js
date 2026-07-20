"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shipComparisonSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.shipComparisonSchemas = {
    compareBody: joi_1.default.object({
        shipIds: joi_1.default.array().items(joi_1.default.string().trim().required()).min(2).max(8).required(),
    }).unknown(false),
    quickCompareBody: joi_1.default.object({
        shipId1: joi_1.default.string().trim().required(),
        shipId2: joi_1.default.string().trim().required(),
    }).unknown(false),
    shipIdParam: joi_1.default.object({
        id: joi_1.default.string().trim().required(),
    }).unknown(false),
    fleetIdParam: joi_1.default.object({
        id: joi_1.default.string().trim().required(),
    }).unknown(false),
    similarShipsQuery: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(20).default(5),
    }).unknown(false),
};
//# sourceMappingURL=shipComparisonSchemas.js.map