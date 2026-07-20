"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshOrganizationSchema = exports.getOrganizationSchema = exports.getOrganizationMembersSchema = exports.userHandleSchema = exports.orgSidSchema = exports.listOrganizationsSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.listOrganizationsSchema = joi_1.default.object({
    ...common_1.paginationKeys,
});
exports.orgSidSchema = joi_1.default.object({
    sid: joi_1.default.string().trim().uppercase().min(1).max(20).required(),
});
exports.userHandleSchema = joi_1.default.object({
    handle: joi_1.default.string().trim().min(1).max(50).required(),
});
exports.getOrganizationMembersSchema = joi_1.default.object({
    ...(0, common_1.paginationKeysWith)(100, 500),
    force: joi_1.default.boolean().default(false),
});
exports.getOrganizationSchema = joi_1.default.object({
    force: joi_1.default.boolean().default(false),
});
exports.refreshOrganizationSchema = joi_1.default.object({
    includeMembers: joi_1.default.boolean().default(true),
});
//# sourceMappingURL=rsiCrawlerSchemas.js.map