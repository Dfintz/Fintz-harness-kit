"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const type = joi_1.default.string().max(50).trim();
const reason = joi_1.default.string().max(2000).trim();
const comment = joi_1.default.string().max(2000).trim();
const resourceId = joi_1.default.string().uuid();
const userId = joi_1.default.string().uuid();
exports.approvalSchemas = {
    create: joi_1.default.object({
        type: type.required(),
        resourceId: resourceId.required(),
        description: common_1.description,
        priority: joi_1.default.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
        metadata: joi_1.default.object().unknown(true),
    }),
    approve: joi_1.default.object({
        comment,
        conditions: joi_1.default.array().items(joi_1.default.string().max(500)).max(10),
    }),
    reject: joi_1.default.object({
        reason: reason.required(),
        comment,
    }),
    delegate: joi_1.default.object({
        userId: userId.required(),
        comment,
    }),
    query: common_1.pagination.keys({
        status: joi_1.default.string().valid('pending', 'approved', 'rejected', 'delegated', 'expired'),
        type,
        assignedTo: userId,
        requestedBy: userId,
        dateFrom: joi_1.default.date().iso(),
        dateTo: joi_1.default.date().iso().greater(joi_1.default.ref('dateFrom')),
    }),
    param: joi_1.default.object({
        approvalId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=approvalSchemas.js.map