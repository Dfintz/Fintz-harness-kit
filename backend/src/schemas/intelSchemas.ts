import Joi from 'joi';

import { id, optionalId } from './common';

/**
 * Intel Vault Validation Schemas
 *
 * Validates Intel entries, officers, and audit log queries
 */

// Classification levels
const intelClassification = Joi.string().valid(
  'public',
  'restricted',
  'confidential',
  'secret',
  'top_secret'
);

// Intel categories
const intelCategory = Joi.string().valid(
  'strategic',
  'tactical',
  'personnel',
  'enemy',
  'alliance',
  'economic',
  'technical',
  'other'
);

// Officer ranks
const intelOfficerRank = Joi.string().valid('junior', 'officer', 'senior', 'lead', 'chief');

// Access levels
const intelAccessLevel = Joi.string().valid('read', 'write', 'edit', 'delete', 'admin');
const intelSharePermission = Joi.string().valid('view', 'comment', 'contribute', 'full');
const intelShareStatus = Joi.string().valid('pending', 'active', 'revoked', 'declined', 'expired');

// Audit actions
const intelAuditAction = Joi.string().valid(
  'entry_created',
  'entry_viewed',
  'entry_updated',
  'entry_deleted',
  'entry_archived',
  'entry_restored',
  'officer_appointed',
  'officer_promoted',
  'officer_demoted',
  'officer_removed',
  'officer_access_changed',
  'access_granted',
  'access_denied',
  'unauthorized_attempt',
  'vault_accessed',
  'export_performed',
  'bulk_operation'
);

export const intelSchemas = {
  // ==================== INTEL ENTRIES ====================

  // Create Intel entry
  createEntry: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    content: Joi.string().trim().min(1).max(50000).required(),
    classification: intelClassification.required(),
    category: intelCategory.required(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    location: Joi.string().trim().max(200).optional(),
    eventDate: Joi.date().iso().optional(),
    metadata: Joi.object({
      attachments: Joi.array().items(Joi.string()).max(10).optional(),
      relatedEntries: Joi.array().items(Joi.string()).max(20).optional(),
      sources: Joi.array().items(Joi.string()).max(10).optional(),
      reliability: Joi.number().min(1).max(5).optional(),
      urgency: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
      expirationDate: Joi.date().iso().optional(),
      customFields: Joi.object().optional(),
    }).optional(),
  }),

  // Update Intel entry
  updateEntry: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    content: Joi.string().trim().min(1).max(50000).optional(),
    classification: intelClassification.optional(),
    category: intelCategory.optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    location: Joi.string().trim().max(200).optional(),
    eventDate: Joi.date().iso().optional(),
    isArchived: Joi.boolean().optional(),
    metadata: Joi.object({
      attachments: Joi.array().items(Joi.string()).max(10).optional(),
      relatedEntries: Joi.array().items(Joi.string()).max(20).optional(),
      sources: Joi.array().items(Joi.string()).max(10).optional(),
      reliability: Joi.number().min(1).max(5).optional(),
      urgency: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
      expirationDate: Joi.date().iso().optional(),
      customFields: Joi.object().optional(),
    }).optional(),
  }),

  // Query Intel entries
  queryEntries: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
    includeArchived: Joi.string().valid('true', 'false').optional(),
    classification: intelClassification.optional(),
    category: intelCategory.optional(),
    search: Joi.string().trim().max(200).optional(),
  }),

  // ==================== INTEL OFFICERS ====================

  // Appoint Intel officer
  appointOfficer: Joi.object({
    userId: id,
    rank: intelOfficerRank.required(),
    accessLevel: intelAccessLevel.required(),
    specializations: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  // Update Intel officer
  updateOfficer: Joi.object({
    rank: intelOfficerRank.optional(),
    accessLevel: intelAccessLevel.optional(),
    specializations: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    notes: Joi.string().trim().max(1000).optional(),
    isActive: Joi.boolean().optional(),
  }),

  // Query Intel officers
  queryOfficers: Joi.object({
    includeInactive: Joi.string().valid('true', 'false').optional(),
    rank: intelOfficerRank.optional(),
  }),

  // Remove officer (body with reason)
  removeOfficer: Joi.object({
    reason: Joi.string().trim().max(500).optional(),
  }),

  // ==================== AUDIT LOGS ====================

  // Create intel share
  createShare: Joi.object({
    targetOrganizationId: id,
    permission: intelSharePermission.required(),
    maxClassification: intelClassification.optional(),
    shareReason: Joi.string().trim().max(2000).optional(),
    expiresAt: Joi.date().iso().optional(),
    metadata: Joi.object({
      allianceId: optionalId,
      treatyId: optionalId,
      conditions: Joi.array().items(Joi.string().trim().max(200)).max(20).optional(),
      restrictedSections: Joi.array().items(Joi.string().trim().max(200)).max(50).optional(),
      notes: Joi.string().trim().max(2000).optional(),
    }).optional(),
  }),

  // Share response body (accept/decline/revoke)
  shareResponse: Joi.object({
    reason: Joi.string().trim().max(2000).optional(),
  }),

  // Query shares
  queryShares: Joi.object({
    status: intelShareStatus.optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),

  // Query audit logs
  queryAuditLogs: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
    intelEntryId: optionalId,
    action: intelAuditAction.optional(),
    userId: optionalId,
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),

  // ==================== PARAMS ====================

  // Entry ID param
  entryIdParam: Joi.object({
    orgId: id,
    entryId: id,
  }),

  // Officer ID param
  officerIdParam: Joi.object({
    orgId: id,
    officerId: id,
  }),

  // Share ID param
  shareIdParam: Joi.object({
    orgId: id,
    shareId: id,
  }),

  // Org ID param
  orgIdParam: Joi.object({
    orgId: id,
  }),
};
