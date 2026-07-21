import Joi from 'joi';

const discordSnowflake = Joi.string()
  .regex(/^\d{17,20}$/)
  .messages({ 'string.pattern.base': 'Must be a valid Discord snowflake ID' });

export const rsiUserLinkBotSchemas = {
  /** Params for routes scoped to a guild and org */
  guildOrgParams: Joi.object({
    orgId: Joi.string().uuid().required(),
    guildId: discordSnowflake.required(),
  }),

  /** Params for creating a user link */
  createLinkParams: Joi.object({
    orgId: Joi.string().uuid().required(),
    discordUserId: discordSnowflake.required(),
  }),

  /** Body for creating a user link */
  createLinkBody: Joi.object({
    rsiHandle: Joi.string().min(1).max(60).required(),
    verificationMethod: Joi.string()
      .valid('bio_code', 'manual', 'discord_match')
      .default('bio_code'),
  }),

  /** Params for link status/delete routes */
  statusParams: Joi.object({
    orgId: Joi.string().uuid().required(),
    discordUserId: discordSnowflake.required(),
  }),

  /** Query for link status route */
  statusQuery: Joi.object({
    includeHistory: Joi.boolean().default(false),
  }),

  /** Params for link delete route */
  deleteLinkParams: Joi.object({
    orgId: Joi.string().uuid().required(),
    discordUserId: discordSnowflake.required(),
  }),

  /** Params for sync route */
  syncParams: Joi.object({
    orgId: Joi.string().uuid().required(),
  }),

  /** Body for sync route */
  syncBody: Joi.object({
    force: Joi.boolean().default(false),
    targetDiscordUserIds: Joi.array().items(discordSnowflake).max(100).optional(),
  }),

  /** Params for audit route */
  auditParams: Joi.object({
    orgId: Joi.string().uuid().required(),
  }),

  /** Query for audit route */
  auditQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    discordUserId: discordSnowflake.optional(),
    action: Joi.string().optional(),
    since: Joi.date().iso().optional(),
  }),

  /** Params for verify-check route */
  verifyCheckParams: Joi.object({
    orgId: Joi.string().uuid().required(),
    discordUserId: discordSnowflake.required(),
  }),
};
