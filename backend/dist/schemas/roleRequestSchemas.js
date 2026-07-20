"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleRequestSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.roleRequestSchemas = {
    create: joi_1.default.object({
        roleId: joi_1.default.string().uuid().required(),
        reason: joi_1.default.string().max(1000).allow('', null).optional(),
    }),
    approve: joi_1.default.object({
        comment: joi_1.default.string().max(1000).allow('', null).optional(),
    }),
    reject: joi_1.default.object({
        reason: joi_1.default.string().min(1).max(1000).required(),
    }),
    param: joi_1.default.object({
        approvalId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=roleRequestSchemas.js.map