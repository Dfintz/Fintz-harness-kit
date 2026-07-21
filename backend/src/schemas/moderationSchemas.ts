/**
 * Moderation / Blacklist Joi Validation Schemas
 *
 * Sprint 26 — Wire stub routes to real services
 */
import Joi from 'joi';

const INCIDENT_TYPES = ['WARNING', 'TIMEOUT', 'LONG_TIMEOUT', 'KICK', 'BAN'];
const INCIDENT_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'];

export const moderationSchemas = {
  /** POST /incidents — Create a new moderation incident */
  createIncident: Joi.object({
    guildId: Joi.string().max(20).required(),
    guildName: Joi.string().max(100).optional(),
    targetDiscordId: Joi.string().max(20).required(),
    targetUsername: Joi.string().max(100).optional(),
    incidentType: Joi.string()
      .valid(...INCIDENT_TYPES)
      .required(),
    reason: Joi.string().max(2000).optional(),
    durationMinutes: Joi.number().integer().min(1).max(40320).optional(), // max 28 days
    isShared: Joi.boolean().optional(),
    metadata: Joi.object().optional(),
  }),

  /** PATCH /incidents/:incidentId — Update incident */
  updateIncident: Joi.object({
    reason: Joi.string().max(2000).optional(),
    isShared: Joi.boolean().optional(),
    metadata: Joi.object().optional(),
  }),

  /** POST /incidents/:incidentId/revoke — Revoke incident */
  revokeIncident: Joi.object({
    reason: Joi.string().max(2000).optional(),
  }),

  /** GET /incidents — Paginated search query */
  searchQuery: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    targetDiscordId: Joi.string().max(20).optional(),
    guildId: Joi.string().max(20).optional(),
    incidentType: Joi.string()
      .valid(...INCIDENT_TYPES)
      .optional(),
    severity: Joi.number().integer().min(1).max(5).optional(),
    status: Joi.string()
      .valid(...INCIDENT_STATUSES)
      .optional(),
    minSeverity: Joi.number().integer().min(1).max(5).optional(),
    isShared: Joi.string().valid('true', 'false').optional(),
    searchTerm: Joi.string().max(200).optional(),
    sortBy: Joi.string().valid('createdAt', 'severity', 'incidentType', 'status').optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  }),

  /** PUT /sharing/config — Update sharing configuration */
  updateSharingConfig: Joi.object({
    shareWarnings: Joi.boolean().optional(),
    shareTimeouts: Joi.boolean().optional(),
    shareKicks: Joi.boolean().optional(),
    shareBans: Joi.boolean().optional(),
    receiveAlerts: Joi.boolean().optional(),
    minAlertSeverity: Joi.number().integer().min(1).max(5).optional(),
    alertChannelId: Joi.string().max(20).allow(null).optional(),
    autoShareWithAllies: Joi.boolean().optional(),
    autoShareMinSeverity: Joi.number().integer().min(1).max(5).optional(),
  }),
};
