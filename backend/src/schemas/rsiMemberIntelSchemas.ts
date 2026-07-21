/**
 * RSI Member Intel Schemas
 *
 * Joi validation schemas for the member intelligence endpoints.
 * Wave 3.3: RSI Sync Enhancements
 */

import Joi from 'joi';

/** Validate organizationId path parameter */
const orgIdParam = Joi.object({
  orgId: Joi.string().uuid().required(),
});

/** Validate rsiHandle path parameter */
const handleParam = Joi.object({
  orgId: Joi.string().uuid().required(),
  rsiHandle: Joi.string().min(1).max(100).required(),
});

/** Validate optional guildId in request body */
const auditBody = Joi.object({
  guildId: Joi.string()
    .pattern(/^\d{17,20}$/)
    .optional(),
});

/** Validate optional guildId for role validation */
const validateRolesBody = Joi.object({
  guildId: Joi.string()
    .pattern(/^\d{17,20}$/)
    .optional(),
});

/** Validate manual link request body */
const manualLinkBody = Joi.object({
  userId: Joi.string().uuid().required(),
  discordUserId: Joi.string()
    .pattern(/^\d{17,20}$/)
    .optional(),
});

/** Validate link-candidates search query */
const linkCandidatesQuery = Joi.object({
  q: Joi.string().max(100).optional().allow(''),
});

export const rsiMemberIntelSchemas = {
  orgIdParam,
  handleParam,
  auditBody,
  validateRolesBody,
  manualLinkBody,
  linkCandidatesQuery,
};
