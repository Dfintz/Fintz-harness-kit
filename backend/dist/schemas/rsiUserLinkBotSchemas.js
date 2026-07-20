"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiUserLinkBotSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const discordSnowflake = joi_1.default.string()
    .regex(/^\d{17,20}$/)
    .messages({ 'string.pattern.base': 'Must be a valid Discord snowflake ID' });
exports.rsiUserLinkBotSchemas = {
    guildOrgParams: joi_1.default.object({
        orgId: joi_1.default.string().uuid().required(),
        guildId: discordSnowflake.required(),
    }),
    createLinkParams: joi_1.default.object({
        orgId: joi_1.default.string().uuid().required(),
        discordUserId: discordSnowflake.required(),
    }),
    createLinkBody: joi_1.default.object({
        rsiHandle: joi_1.default.string().min(1).max(60).required(),
        verificationMethod: joi_1.default.string()
            .valid('bio_code', 'manual', 'discord_match')
            .default('bio_code'),
    }),
    statusParams: joi_1.default.object({
        orgId: joi_1.default.string().uuid().required(),
        discordUserId: discordSnowflake.required(),
    }),
    statusQuery: joi_1.default.object({
        includeHistory: joi_1.default.boolean().default(false),
    }),
    deleteLinkParams: joi_1.default.object({
        orgId: joi_1.default.string().uuid().required(),
        discordUserId: discordSnowflake.required(),
    }),
    syncParams: joi_1.default.object({
        orgId: joi_1.default.string().uuid().required(),
    }),
    syncBody: joi_1.default.object({
        force: joi_1.default.boolean().default(false),
        targetDiscordUserIds: joi_1.default.array().items(discordSnowflake).max(100).optional(),
    }),
    auditParams: joi_1.default.object({
        orgId: joi_1.default.string().uuid().required(),
    }),
    auditQuery: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(100).default(20),
        offset: joi_1.default.number().integer().min(0).default(0),
        discordUserId: discordSnowflake.optional(),
        action: joi_1.default.string().optional(),
        since: joi_1.default.date().iso().optional(),
    }),
    verifyCheckParams: joi_1.default.object({
        orgId: joi_1.default.string().uuid().required(),
        discordUserId: discordSnowflake.required(),
    }),
};
//# sourceMappingURL=rsiUserLinkBotSchemas.js.map