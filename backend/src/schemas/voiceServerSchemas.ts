/**
 * Joi validation schemas for voice server endpoints.
 */

import Joi from 'joi';

const VOICE_SERVER_TYPES = ['mumble', 'teamspeak', 'ventrilo', 'starcomms', 'custom'] as const;
const STARCOMMS_VOICE_MODES = ['central', 'private'] as const;
const SHARE_TARGET_TYPES = ['federation', 'organization'] as const;
const PERMISSION_KEY_REGEX = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_*]*$/;

/**
 * Schema for a single whitelist entry in federation/3rd-party sharing.
 */
const voiceServerShareEntrySchema = Joi.object({
  type: Joi.string()
    .valid(...SHARE_TARGET_TYPES)
    .required(),
  targetId: Joi.alternatives()
    .conditional('type', {
      is: 'federation',
      then: Joi.string().uuid().required(),
      otherwise: Joi.string().trim().min(1).max(100).required(),
    })
    .required(),
  targetName: Joi.string().max(200).required(),
});

/**
 * Schema for the sharing sub-object in voice server config.
 */
const voiceServerSharingSchema = Joi.object({
  enabled: Joi.boolean().required(),
  whitelist: Joi.array().items(voiceServerShareEntrySchema).max(50).default([]),
});

/**
 * Schema for creating/updating voice server config.
 * POST/PUT /api/v2/organizations/:orgId/voice-server
 * POST/PUT /api/v2/federations/:federationId/voice-server
 */
export const voiceServerConfigSchema = Joi.object({
  enabled: Joi.boolean().required(),
  serverType: Joi.string()
    .valid(...VOICE_SERVER_TYPES)
    .required(),
  starCommsVoiceMode: Joi.alternatives().conditional('serverType', {
    is: 'starcomms',
    then: Joi.string()
      .valid(...STARCOMMS_VOICE_MODES)
      .optional()
      .default('central'),
    otherwise: Joi.any().strip(),
  }),
  // Host/port are only required when the integration is enabled. This lets users
  // toggle "Enable" off and save (e.g. to temporarily disable the server) even when
  // the host field has never been populated.
  host: Joi.string()
    .max(255)
    .when('enabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional().allow('', null),
    }),
  port: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .when('enabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional().allow(null),
    }),
  displayName: Joi.string().max(100).optional().allow('', null),
  password: Joi.string().max(128).optional().allow('', null),
  connectUrl: Joi.string()
    .uri({ scheme: ['http', 'https', 'mumble', 'ts3server', 'ventrilo', 'starcomms'] })
    .max(500)
    .optional()
    .allow('', null),
  queryPort: Joi.number().integer().min(1).max(65535).optional().allow(null),
  queryUsername: Joi.string().max(100).optional().allow('', null),
  queryPassword: Joi.string().max(128).optional().allow('', null),
  isPlatformHosted: Joi.boolean().optional().default(false),
  minRolePriority: Joi.number().integer().min(0).max(100).optional().default(0),
  requiredPermission: Joi.string().max(50).pattern(PERMISSION_KEY_REGEX).optional().allow('', null),
  contributeToCAS: Joi.boolean().optional().default(false),
  iceHost: Joi.string().hostname().max(255).optional().allow('', null),
  icePort: Joi.number().integer().min(1).max(65535).optional().allow(null),
  iceSecret: Joi.string().max(128).optional().allow('', null),
  sharing: voiceServerSharingSchema.optional(),
});

/**
 * Schema for org/federation ID path parameter.
 */
export const voiceServerOrgParamsSchema = Joi.object({
  orgId: Joi.string().uuid().required(),
});

export const voiceServerFedParamsSchema = Joi.object({
  federationId: Joi.string().uuid().required(),
});

/**
 * Schema for stats query parameters.
 */
export const voiceServerStatsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(30).optional().default(7),
});

/**
 * Schema for channel data push from CVP bridge (internal service).
 */
export const voiceChannelDataSchema = Joi.object({
  channels: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().integer().required(),
        name: Joi.string().max(255).required(),
        parentId: Joi.number().integer().allow(null).required(),
        userCount: Joi.number().integer().min(0).required(),
      })
    )
    .max(200)
    .optional(),
  users: Joi.array()
    .items(
      Joi.object({
        displayName: Joi.string().max(255).required(),
        channelId: Joi.number().integer().required(),
        isMuted: Joi.boolean().required(),
        isDeafened: Joi.boolean().required(),
        onlineSince: Joi.string().isoDate().required(),
        sessionMinutes: Joi.number().optional(),
        platformUserId: Joi.string().max(255).optional(),
      })
    )
    .max(500)
    .optional(),
}).max(20); // Limit total payload size

/**
 * Schema for voice token validation request (internal service).
 */
export const voiceTokenValidateSchema = Joi.object({
  token: Joi.string().hex().length(64).required(),
  username: Joi.string().max(128).required(),
});

/**
 * Schema for RSI SID lookup query parameter.
 * GET /api/v2/voice/org-lookup?rsiSid=ACME
 */
export const rsiSidLookupSchema = Joi.object({
  rsiSid: Joi.string()
    .required()
    .regex(/^[A-Z0-9]{1,10}$/)
    .messages({
      'string.pattern.base': 'RSI SID must be 1-10 uppercase letters/numbers',
    }),
});
