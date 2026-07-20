"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiMemberIntelSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const orgIdParam = joi_1.default.object({
    orgId: joi_1.default.string().uuid().required(),
});
const handleParam = joi_1.default.object({
    orgId: joi_1.default.string().uuid().required(),
    rsiHandle: joi_1.default.string().min(1).max(100).required(),
});
const auditBody = joi_1.default.object({
    guildId: joi_1.default.string()
        .pattern(/^\d{17,20}$/)
        .optional(),
});
const validateRolesBody = joi_1.default.object({
    guildId: joi_1.default.string()
        .pattern(/^\d{17,20}$/)
        .optional(),
});
const manualLinkBody = joi_1.default.object({
    userId: joi_1.default.string().uuid().required(),
    discordUserId: joi_1.default.string()
        .pattern(/^\d{17,20}$/)
        .optional(),
});
const linkCandidatesQuery = joi_1.default.object({
    q: joi_1.default.string().max(100).optional().allow(''),
});
exports.rsiMemberIntelSchemas = {
    orgIdParam,
    handleParam,
    auditBody,
    validateRolesBody,
    manualLinkBody,
    linkCandidatesQuery,
};
//# sourceMappingURL=rsiMemberIntelSchemas.js.map