/**
 * Member Audit Joi Schemas
 *
 * Validation schemas for the Membership Audit & Intel endpoints (Wave 2.1).
 */
import {
  FlagSeverity,
  FlagStatus,
  MemberFlagType,
  WatchlistReason,
  WatchlistThreatLevel,
} from '@sc-fleet-manager/shared-types';
import Joi from 'joi';

import { id, pageSizeKeysWith, uuid } from './common';

/* ─── Param schemas ──────────────────────────────────────────────── */

export const memberAuditSchemas = {
  /** :orgId */
  orgIdParam: Joi.object({ orgId: id }),

  /** :orgId/:flagId */
  flagIdParam: Joi.object({ orgId: id, flagId: id }),

  /** :orgId/:entryId */
  entryIdParam: Joi.object({ orgId: id, entryId: id }),

  /** :orgId/:userId (for profile & stats) */
  userIdParam: Joi.object({ orgId: id, userId: id }),

  /* ─── Flag endpoints ─────────────────────────────────────────── */

  /** POST /flags — create manual flag */
  createManualFlag: Joi.object({
    userId: uuid.required(),
    severity: Joi.string()
      .valid(...Object.values(FlagSeverity))
      .required(),
    description: Joi.string().trim().min(3).max(2000).required(),
    metadata: Joi.object().optional(),
  }),

  /** PATCH /flags/:flagId/resolve */
  resolveFlag: Joi.object({
    status: Joi.string()
      .valid(FlagStatus.RESOLVED, FlagStatus.DISMISSED, FlagStatus.ESCALATED)
      .required(),
    resolutionNote: Joi.string().trim().min(1).max(2000).required(),
  }),

  /** GET /flags — list with filters */
  listFlagsQuery: Joi.object({
    userId: Joi.string().trim().max(100).optional(),
    flagTypes: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...Object.values(MemberFlagType))),
        Joi.string().valid(...Object.values(MemberFlagType))
      )
      .optional(),
    severities: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...Object.values(FlagSeverity))),
        Joi.string().valid(...Object.values(FlagSeverity))
      )
      .optional(),
    statuses: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...Object.values(FlagStatus))),
        Joi.string().valid(...Object.values(FlagStatus))
      )
      .optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().optional(),
    ...pageSizeKeysWith(25),
    sortBy: Joi.string().valid('createdAt', 'severity', 'flagType', 'status').default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  }),

  /* ─── Watchlist endpoints ────────────────────────────────────── */

  /** POST /watchlist — create entry */
  createWatchlistEntry: Joi.object({
    rsiHandle: Joi.string().trim().min(1).max(100).required(),
    citizenName: Joi.string().trim().min(1).max(255).required(),
    reason: Joi.string()
      .valid(...Object.values(WatchlistReason))
      .required(),
    threatLevel: Joi.string()
      .valid(...Object.values(WatchlistThreatLevel))
      .required(),
    notes: Joi.string().trim().max(2000).optional().allow(''),
  }),

  /** PATCH /watchlist/:entryId — update entry */
  updateWatchlistEntry: Joi.object({
    reason: Joi.string()
      .valid(...Object.values(WatchlistReason))
      .optional(),
    threatLevel: Joi.string()
      .valid(...Object.values(WatchlistThreatLevel))
      .optional(),
    notes: Joi.string().trim().max(2000).optional().allow(''),
    citizenName: Joi.string().trim().min(1).max(255).optional(),
  }),

  /** GET /watchlist — list with filters */
  listWatchlistQuery: Joi.object({
    reasons: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...Object.values(WatchlistReason))),
        Joi.string().valid(...Object.values(WatchlistReason))
      )
      .optional(),
    threatLevels: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...Object.values(WatchlistThreatLevel))),
        Joi.string().valid(...Object.values(WatchlistThreatLevel))
      )
      .optional(),
    search: Joi.string().trim().max(200).optional(),
    ...pageSizeKeysWith(25),
    sortBy: Joi.string()
      .valid('createdAt', 'citizenName', 'threatLevel', 'reason')
      .default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  }),
};
