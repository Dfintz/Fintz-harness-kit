"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.fleetQuerySchemas = {
    listQuery: common_1.pagination.keys({
        searchTerm: joi_1.default.string().trim().max(200).optional(),
        sortBy: joi_1.default.string().valid('name', 'createdAt', 'memberCount', 'updatedAt').default('name'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('ASC'),
    }),
    fleetIdParam: joi_1.default.object({
        fleetId: joi_1.default.string().trim().required(),
    }),
    memberIdParam: joi_1.default.object({
        memberId: joi_1.default.string().trim().required(),
    }),
    idParam: joi_1.default.object({
        id: joi_1.default.string().trim().required(),
    }),
    addMember: joi_1.default.object({
        fleetId: joi_1.default.string().trim().required(),
        userId: joi_1.default.string().trim().required(),
        role: joi_1.default.string().optional(),
        joinDate: joi_1.default.date().iso().optional(),
    }),
    updateMember: joi_1.default.object({
        status: joi_1.default.string().optional(),
        role: joi_1.default.string().optional(),
        approvedBy: joi_1.default.string().trim().optional(),
    }),
};
//# sourceMappingURL=fleetQuerySchemas.js.map