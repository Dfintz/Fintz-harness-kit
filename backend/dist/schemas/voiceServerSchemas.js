"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiSidLookupSchema = exports.voiceTokenValidateSchema = exports.voiceChannelDataSchema = exports.voiceServerStatsQuerySchema = exports.voiceServerFedParamsSchema = exports.voiceServerOrgParamsSchema = exports.voiceServerConfigSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const VOICE_SERVER_TYPES = ['mumble', 'teamspeak', 'ventrilo', 'starcomms', 'custom'];
const STARCOMMS_VOICE_MODES = ['central', 'private'];
const SHARE_TARGET_TYPES = ['federation', 'organization'];
const PERMISSION_KEY_REGEX = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_*]*$/;
const voiceServerShareEntrySchema = joi_1.default.object({
    type: joi_1.default.string()
        .valid(...SHARE_TARGET_TYPES)
        .required(),
    targetId: joi_1.default.alternatives()
        .conditional('type', {
        is: 'federation',
        then: joi_1.default.string().uuid().required(),
        otherwise: joi_1.default.string().trim().min(1).max(100).required(),
    })
        .required(),
    targetName: joi_1.default.string().max(200).required(),
});
const voiceServerSharingSchema = joi_1.default.object({
    enabled: joi_1.default.boolean().required(),
    whitelist: joi_1.default.array().items(voiceServerShareEntrySchema).max(50).default([]),
});
exports.voiceServerConfigSchema = joi_1.default.object({
    enabled: joi_1.default.boolean().required(),
    serverType: joi_1.default.string()
        .valid(...VOICE_SERVER_TYPES)
        .required(),
    starCommsVoiceMode: joi_1.default.alternatives().conditional('serverType', {
        is: 'starcomms',
        then: joi_1.default.string()
            .valid(...STARCOMMS_VOICE_MODES)
            .optional()
            .default('central'),
        otherwise: joi_1.default.any().strip(),
    }),
    host: joi_1.default.string()
        .max(255)
        .when('enabled', {
        is: true,
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional().allow('', null),
    }),
    port: joi_1.default.number()
        .integer()
        .min(1)
        .max(65535)
        .when('enabled', {
        is: true,
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional().allow(null),
    }),
    displayName: joi_1.default.string().max(100).optional().allow('', null),
    password: joi_1.default.string().max(128).optional().allow('', null),
    connectUrl: joi_1.default.string()
        .uri({ scheme: ['http', 'https', 'mumble', 'ts3server', 'ventrilo', 'starcomms'] })
        .max(500)
        .optional()
        .allow('', null),
    queryPort: joi_1.default.number().integer().min(1).max(65535).optional().allow(null),
    queryUsername: joi_1.default.string().max(100).optional().allow('', null),
    queryPassword: joi_1.default.string().max(128).optional().allow('', null),
    isPlatformHosted: joi_1.default.boolean().optional().default(false),
    minRolePriority: joi_1.default.number().integer().min(0).max(100).optional().default(0),
    requiredPermission: joi_1.default.string().max(50).pattern(PERMISSION_KEY_REGEX).optional().allow('', null),
    contributeToCAS: joi_1.default.boolean().optional().default(false),
    iceHost: joi_1.default.string().hostname().max(255).optional().allow('', null),
    icePort: joi_1.default.number().integer().min(1).max(65535).optional().allow(null),
    iceSecret: joi_1.default.string().max(128).optional().allow('', null),
    sharing: voiceServerSharingSchema.optional(),
});
exports.voiceServerOrgParamsSchema = joi_1.default.object({
    orgId: joi_1.default.string().uuid().required(),
});
exports.voiceServerFedParamsSchema = joi_1.default.object({
    federationId: joi_1.default.string().uuid().required(),
});
exports.voiceServerStatsQuerySchema = joi_1.default.object({
    days: joi_1.default.number().integer().min(1).max(30).optional().default(7),
});
exports.voiceChannelDataSchema = joi_1.default.object({
    channels: joi_1.default.array()
        .items(joi_1.default.object({
        id: joi_1.default.number().integer().required(),
        name: joi_1.default.string().max(255).required(),
        parentId: joi_1.default.number().integer().allow(null).required(),
        userCount: joi_1.default.number().integer().min(0).required(),
    }))
        .max(200)
        .optional(),
    users: joi_1.default.array()
        .items(joi_1.default.object({
        displayName: joi_1.default.string().max(255).required(),
        channelId: joi_1.default.number().integer().required(),
        isMuted: joi_1.default.boolean().required(),
        isDeafened: joi_1.default.boolean().required(),
        onlineSince: joi_1.default.string().isoDate().required(),
        sessionMinutes: joi_1.default.number().optional(),
        platformUserId: joi_1.default.string().max(255).optional(),
    }))
        .max(500)
        .optional(),
}).max(20);
exports.voiceTokenValidateSchema = joi_1.default.object({
    token: joi_1.default.string().hex().length(64).required(),
    username: joi_1.default.string().max(128).required(),
});
exports.rsiSidLookupSchema = joi_1.default.object({
    rsiSid: joi_1.default.string()
        .required()
        .regex(/^[A-Z0-9]{1,10}$/)
        .messages({
        'string.pattern.base': 'RSI SID must be 1-10 uppercase letters/numbers',
    }),
});
//# sourceMappingURL=voiceServerSchemas.js.map