"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.invitationSchemas = {
    invite: joi_1.default.object({
        email: joi_1.default.string().email().required().description('Email address of user to invite'),
        role: joi_1.default.string()
            .valid('member', 'officer', 'admin')
            .optional()
            .default('member')
            .description('Role for the invited member'),
        title: joi_1.default.string().max(100).optional().description('Job title for the member'),
        expiresAt: joi_1.default.date()
            .iso()
            .optional()
            .description('Invitation expiration date (defaults to 7 days from now)'),
        message: joi_1.default.string()
            .max(500)
            .optional()
            .description('Optional message to include in invitation'),
        metadata: joi_1.default.object().optional(),
    }),
    accept: joi_1.default.object({
        invitationId: joi_1.default.string().uuid().required().description('Invitation ID'),
        token: joi_1.default.string().hex().length(64).required().description('Invitation token from email link'),
    }),
    decline: joi_1.default.object({
        invitationId: joi_1.default.string().uuid().required().description('Invitation ID'),
        token: joi_1.default.string().hex().length(64).required().description('Invitation token from email link'),
    }),
    listQuery: joi_1.default.object({
        status: joi_1.default.string()
            .valid('pending', 'approved', 'accepted', 'rejected', 'declined', 'expired')
            .optional(),
        page: joi_1.default.number().integer().min(1).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
    }),
    get send() {
        return this.invite;
    },
};
//# sourceMappingURL=invitationSchemas.js.map