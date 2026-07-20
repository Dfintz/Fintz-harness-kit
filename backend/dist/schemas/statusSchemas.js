"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.miningStatusSchema = exports.manifestStatusSchema = exports.logisticsStatusSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.logisticsStatusSchema = joi_1.default.object({
    status: joi_1.default.string()
        .valid('planning', 'ready', 'in_progress', 'completed', 'cancelled')
        .required(),
});
exports.manifestStatusSchema = joi_1.default.object({
    status: joi_1.default.string().valid('loading', 'in_transit', 'delivered', 'cancelled').required(),
});
exports.miningStatusSchema = joi_1.default.object({
    status: joi_1.default.string().valid('planned', 'in_progress', 'completed', 'cancelled').required(),
});
//# sourceMappingURL=statusSchemas.js.map