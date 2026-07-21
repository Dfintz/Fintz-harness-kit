/**
 * V2 Intel Routes
 *
 * Org-scoped intel vault, intel officers, audit logs, and watchlist.
 * Delegates to IntelVaultService / IntelOfficerService for full implementation.
 */

import { Response, Router } from 'express';

import { AppDataSource } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import {
  intelDeleteRateLimiter,
  intelOfficerManagementRateLimiter,
  intelOperationsRateLimiter,
  intelWriteRateLimiter,
} from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { IntelAuditAction } from '../../models/IntelAuditLog';
import { IntelCategory, IntelClassification } from '../../models/IntelEntry';
import { IntelOfficerRank } from '../../models/IntelOfficer';
import { IntelSharePermission, IntelShareStatus } from '../../models/IntelShare';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { intelSchemas } from '../../schemas';
import { AppointOfficerInput } from '../../services/intel/IntelOfficerService';
import type { IntelSharingService as IntelSharingServiceType } from '../../services/intel/IntelSharingService';
import type { IntelVaultService as IntelVaultServiceType } from '../../services/intel/IntelVaultService';
import { CreateIntelEntryInput } from '../../services/intel/IntelVaultService';
import { ApiError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { sanitizeObject } from '../../utils/prototypePollutionPrevention';
import { getRoleName } from '../../utils/roleUtils';

const router = Router();

const CREATE_INTEL_ENTRY_SANITIZE_FIELDS = [
  'title',
  'content',
  'category',
  'classification',
  'tags',
  'relatedEntities',
  'expiresAt',
  'isArchived',
  'location',
  'eventDate',
  'metadata',
] as const;

const UPDATE_INTEL_ENTRY_SANITIZE_FIELDS = [
  'title',
  'content',
  'category',
  'classification',
  'tags',
  'location',
  'eventDate',
  'isArchived',
  'metadata',
] as const;

function getIntelRequestUserId(req: AuthRequest): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new Error('Authentication required');
  }

  return userId;
}

async function createIntelVaultService(): Promise<IntelVaultServiceType> {
  const { IntelVaultService } = await import('../../services/intel/IntelVaultService');
  return new IntelVaultService();
}

async function createIntelSharingService(): Promise<IntelSharingServiceType> {
  const { IntelSharingService } = await import('../../services/intel/IntelSharingService');
  return new IntelSharingService();
}

function getRequestMetadata(req: AuthRequest): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    ipAddress: req.ip ?? req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

function getRequestBodyRecord(req: AuthRequest): Record<string, unknown> | undefined {
  return req.body as Record<string, unknown> | undefined;
}

function getOptionalReason(req: AuthRequest): string | undefined {
  const body = req.body as { reason?: unknown } | undefined;
  return typeof body?.reason === 'string' ? body.reason : undefined;
}

/**
 * Responds with a typed ApiError's own status code and message when present.
 * Returns true if the error was handled, allowing callers to fall back to
 * legacy message-matching for plain Error instances.
 */
function respondTypedApiError(res: Response, error: unknown): boolean {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return true;
  }
  return false;
}

// All intel routes require authentication
router.use(
  '/organizations/:orgId/intel',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext
);
router.use('/organizations/:orgId/intel', (req: AuthRequest, res: Response, next) => {
  if (req.user?.currentOrganizationId && req.user.currentOrganizationId !== req.params.orgId) {
    res.status(403).json({ error: 'Not authorized for this organization' });
    return;
  }
  next();
});

// ==================== INTEL ACCESS ====================
// Delegates to the real IntelVaultService for proper role-based access control.
/**
 * Fallback intel access check via direct membership lookup.
 * Used when IntelVaultService is unavailable (e.g., missing DB tables).
 */
async function checkIntelAccessFallback(
  userId: string,
  orgId: string
): Promise<{
  hasAccess: boolean;
  accessLevel: string;
  isOwner: boolean;
  isIntelOfficer: boolean;
} | null> {
  try {
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const membership = await membershipRepo
      .createQueryBuilder('membership')
      .where('membership.userId = :userId', { userId })
      .andWhere('membership.organizationId = :orgId', { orgId })
      .andWhere('membership.isActive = :isActive', { isActive: true })
      .getOne();
    const roleName = getRoleName(membership?.role);

    if (['owner', 'founder', 'admin'].includes(roleName)) {
      return {
        hasAccess: true,
        accessLevel: 'admin',
        isOwner: roleName === 'owner' || roleName === 'founder',
        isIntelOfficer: false,
      };
    }
  } catch (fallbackError) {
    logger.error('Intel access fallback also failed', {
      orgId,
      error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    });
  }
  return null;
}

// Falls back to a direct membership lookup if the IntelVaultService is unavailable
// (e.g., intel DB tables not yet created).
router.get('/organizations/:orgId/intel/access', async (req: AuthRequest, res: Response) => {
  try {
    const { IntelVaultService } = await import('../../services/intel/IntelVaultService');
    const service = new IntelVaultService();
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const result = await service.checkAccess(userId, req.params.orgId);
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const userId = req.user?.id;
    const orgId = req.params.orgId;

    if (userId && orgId) {
      const fallback = await checkIntelAccessFallback(userId, orgId);
      if (fallback) {
        logger.warn('Intel access check fell back to direct membership lookup', {
          orgId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        res.json({ success: true, data: fallback });
        return;
      }
    }

    logger.error('Intel access check failed', {
      orgId: req.params.orgId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to check intel access' });
  }
});

// ==================== INTEL ENTRIES ====================

router.get(
  '/organizations/:orgId/intel/entries',
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.queryEntries, 'query'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { IntelVaultService } = await import('../../services/intel/IntelVaultService');
      const service = new IntelVaultService();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const { includeArchived, classification, category, search, limit, offset } = req.query;
      const result = await service.getEntries(req.params.orgId, userId, {
        includeArchived: includeArchived === 'true',
        classification: classification as IntelClassification | undefined,
        category: category as IntelCategory | undefined,
        search: search as string | undefined,
        limit: limit ? Number.parseInt(limit as string, 10) : undefined,
        offset: offset ? Number.parseInt(offset as string, 10) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('access') ||
        message.includes('clearance') ||
        message.includes('permission')
      ) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to get intel entries', {
          orgId: req.params.orgId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to get intel entries' });
      }
    }
  }
);

router.get(
  '/organizations/:orgId/intel/entries/:entryId',
  validateSchema(intelSchemas.entryIdParam, 'params'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { IntelVaultService } = await import('../../services/intel/IntelVaultService');
      const service = new IntelVaultService();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');
      const entry = await service.getEntry(
        req.params.entryId,
        userId,
        req.params.orgId,
        ipAddress,
        userAgent
      );
      res.json({ success: true, data: entry });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        res.status(404).json({ success: false, error: 'Intel entry not found' });
      } else if (message.includes('clearance') || message.includes('access')) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to get intel entry', { entryId: req.params.entryId, error: message });
        res.status(500).json({ error: 'Failed to get intel entry' });
      }
    }
  }
);

router.post(
  '/organizations/:orgId/intel/entries',
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.createEntry, 'body'),
  intelWriteRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelVaultService();
      const userId = getIntelRequestUserId(req);
      const { ipAddress, userAgent } = getRequestMetadata(req);

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(
        getRequestBodyRecord(req),
        CREATE_INTEL_ENTRY_SANITIZE_FIELDS
      );

      const entry = await service.createEntry(
        { ...safeBody, organizationId: req.params.orgId } as CreateIntelEntryInput,
        userId,
        ipAddress,
        userAgent
      );
      res.status(201).json({ success: true, data: entry });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (
        message.includes('access') ||
        message.includes('clearance') ||
        message.includes('permission')
      ) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to create intel entry', { orgId: req.params.orgId, error: message });
        res.status(500).json({ error: 'Failed to create intel entry' });
      }
    }
  }
);

router.patch(
  '/organizations/:orgId/intel/entries/:entryId',
  validateSchema(intelSchemas.entryIdParam, 'params'),
  validateSchema(intelSchemas.updateEntry, 'body'),
  intelWriteRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelVaultService();
      const userId = getIntelRequestUserId(req);
      const { ipAddress, userAgent } = getRequestMetadata(req);

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(
        getRequestBodyRecord(req),
        UPDATE_INTEL_ENTRY_SANITIZE_FIELDS
      );

      const updated = await service.updateEntry(
        req.params.entryId,
        userId,
        req.params.orgId,
        safeBody,
        ipAddress,
        userAgent
      );
      res.json({ success: true, data: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ success: false, error: 'Intel entry not found' });
      } else if (
        message.includes('clearance') ||
        message.includes('access') ||
        message.includes('permission')
      ) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to update intel entry', {
          entryId: req.params.entryId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to update intel entry' });
      }
    }
  }
);

router.delete(
  '/organizations/:orgId/intel/entries/:entryId',
  validateSchema(intelSchemas.entryIdParam, 'params'),
  intelDeleteRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelVaultService();
      const userId = getIntelRequestUserId(req);
      const { ipAddress, userAgent } = getRequestMetadata(req);
      await service.deleteEntry(req.params.entryId, userId, req.params.orgId, ipAddress, userAgent);
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ success: false, error: 'Intel entry not found' });
      } else if (
        message.includes('clearance') ||
        message.includes('access') ||
        message.includes('permission')
      ) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to delete intel entry', {
          entryId: req.params.entryId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to delete intel entry' });
      }
    }
  }
);

// ==================== INTEL SHARING ====================

router.post(
  '/organizations/:orgId/intel/entries/:entryId/shares',
  validateSchema(intelSchemas.entryIdParam, 'params'),
  validateSchema(intelSchemas.createShare, 'body'),
  intelWriteRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelSharingService();
      const userId = getIntelRequestUserId(req);
      const { ipAddress, userAgent } = getRequestMetadata(req);
      const safeBody = sanitizeObject(getRequestBodyRecord(req), [
        'targetOrganizationId',
        'permission',
        'maxClassification',
        'shareReason',
        'expiresAt',
        'metadata',
      ]);

      const share = await service.createShare(
        {
          intelEntryId: req.params.entryId,
          sourceOrganizationId: req.params.orgId,
          targetOrganizationId: safeBody.targetOrganizationId as string,
          permission: safeBody.permission as IntelSharePermission,
          maxClassification:
            (safeBody.maxClassification as IntelClassification | undefined) ??
            IntelClassification.RESTRICTED,
          shareReason: safeBody.shareReason as string | undefined,
          expiresAt: safeBody.expiresAt ? new Date(safeBody.expiresAt as string) : undefined,
          metadata: safeBody.metadata as
            | {
                allianceId?: string;
                treatyId?: string;
                conditions?: string[];
                restrictedSections?: string[];
                notes?: string;
              }
            | undefined,
        },
        userId,
        ipAddress,
        userAgent
      );

      res.status(201).json({ success: true, data: share });
    } catch (error: unknown) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ success: false, error: message });
      } else if (message.includes('access') || message.includes('permission')) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to create intel share', {
          orgId: req.params.orgId,
          entryId: req.params.entryId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to create intel share' });
      }
    }
  }
);

router.get(
  '/organizations/:orgId/intel/entries/:entryId/shares',
  validateSchema(intelSchemas.entryIdParam, 'params'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelSharingService();
      const userId = getIntelRequestUserId(req);

      const shares = await service.getSharesForEntry(req.params.entryId, req.params.orgId, userId);
      res.json({ success: true, data: shares });
    } catch (error: unknown) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('permission')) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to get intel shares for entry', {
          orgId: req.params.orgId,
          entryId: req.params.entryId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to get intel shares for entry' });
      }
    }
  }
);

router.get(
  '/organizations/:orgId/intel/shares/incoming',
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.queryShares, 'query'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelSharingService();
      const userId = getIntelRequestUserId(req);

      const result = await service.getIntelSharedWithOrg(req.params.orgId, userId, {
        status: req.query.status as IntelShareStatus | undefined,
        limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? Number.parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else {
        logger.error('Failed to get incoming intel shares', {
          orgId: req.params.orgId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to get incoming intel shares' });
      }
    }
  }
);

router.get(
  '/organizations/:orgId/intel/shares/outgoing',
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.queryShares, 'query'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelSharingService();
      const userId = getIntelRequestUserId(req);

      const result = await service.getIntelSharedByOrg(req.params.orgId, userId, {
        status: req.query.status as IntelShareStatus | undefined,
        limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? Number.parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('permission')) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to get outgoing intel shares', {
          orgId: req.params.orgId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to get outgoing intel shares' });
      }
    }
  }
);

router.post(
  '/organizations/:orgId/intel/shares/:shareId/accept',
  validateSchema(intelSchemas.shareIdParam, 'params'),
  validateSchema(intelSchemas.shareResponse, 'body'),
  intelWriteRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelSharingService();
      const userId = getIntelRequestUserId(req);
      const { ipAddress, userAgent } = getRequestMetadata(req);
      const share = await service.acceptShare(
        req.params.shareId,
        userId,
        req.params.orgId,
        ipAddress,
        userAgent
      );
      res.json({ success: true, data: share });
    } catch (error: unknown) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ success: false, error: message });
      } else {
        logger.error('Failed to accept intel share', {
          shareId: req.params.shareId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to accept intel share' });
      }
    }
  }
);

router.post(
  '/organizations/:orgId/intel/shares/:shareId/decline',
  validateSchema(intelSchemas.shareIdParam, 'params'),
  validateSchema(intelSchemas.shareResponse, 'body'),
  intelWriteRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelSharingService();
      const userId = getIntelRequestUserId(req);
      const { ipAddress, userAgent } = getRequestMetadata(req);
      const share = await service.declineShare(
        req.params.shareId,
        userId,
        req.params.orgId,
        getOptionalReason(req),
        ipAddress,
        userAgent
      );
      res.json({ success: true, data: share });
    } catch (error: unknown) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ success: false, error: message });
      } else {
        logger.error('Failed to decline intel share', {
          shareId: req.params.shareId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to decline intel share' });
      }
    }
  }
);

router.post(
  '/organizations/:orgId/intel/shares/:shareId/revoke',
  validateSchema(intelSchemas.shareIdParam, 'params'),
  validateSchema(intelSchemas.shareResponse, 'body'),
  intelWriteRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelSharingService();
      const userId = getIntelRequestUserId(req);
      const { ipAddress, userAgent } = getRequestMetadata(req);
      const share = await service.revokeShare(
        req.params.shareId,
        userId,
        req.params.orgId,
        getOptionalReason(req),
        ipAddress,
        userAgent
      );
      res.json({ success: true, data: share });
    } catch (error: unknown) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ success: false, error: message });
      } else if (message.includes('permission')) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to revoke intel share', {
          shareId: req.params.shareId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to revoke intel share' });
      }
    }
  }
);

router.get(
  '/organizations/:orgId/intel/shared-entries/:entryId',
  validateSchema(intelSchemas.entryIdParam, 'params'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const service = await createIntelSharingService();
      const userId = getIntelRequestUserId(req);
      const { ipAddress, userAgent } = getRequestMetadata(req);
      const data = await service.getSharedEntry(
        req.params.entryId,
        userId,
        req.params.orgId,
        ipAddress,
        userAgent
      );
      res.json({ success: true, data });
    } catch (error: unknown) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Authentication required') {
        res.status(401).json({ error: message });
      } else if (message.includes('not found') || message.includes('expired')) {
        res.status(404).json({ success: false, error: message });
      } else if (message.includes('access')) {
        res.status(403).json({ success: false, error: message });
      } else {
        logger.error('Failed to get shared intel entry', {
          orgId: req.params.orgId,
          entryId: req.params.entryId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to get shared intel entry' });
      }
    }
  }
);

// ==================== INTEL OFFICERS ====================

router.get(
  '/organizations/:orgId/intel/officers',
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.queryOfficers, 'query'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { IntelOfficerService } = await import('../../services/intel/IntelOfficerService');
      const service = new IntelOfficerService();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const { includeInactive, rank } = req.query;
      const validRanks = Object.values(IntelOfficerRank);
      const validatedRank =
        typeof rank === 'string' && validRanks.includes(rank as IntelOfficerRank)
          ? (rank as IntelOfficerRank)
          : undefined;
      const officers = await service.getOfficers(req.params.orgId, userId, {
        includeInactive: includeInactive === 'true',
        rank: validatedRank,
      });
      res.json({ success: true, data: officers });
    } catch (error: unknown) {
      logger.error('Failed to get intel officers', {
        orgId: req.params.orgId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to get intel officers' });
    }
  }
);

router.get(
  '/organizations/:orgId/intel/officers/:officerId',
  validateSchema(intelSchemas.officerIdParam, 'params'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { IntelOfficerService } = await import('../../services/intel/IntelOfficerService');
      const service = new IntelOfficerService();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const officer = await service.getOfficer(req.params.officerId, userId, req.params.orgId);
      res.json({ success: true, data: officer });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Intel officer not found' });
      } else {
        logger.error('Failed to get intel officer', {
          officerId: req.params.officerId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to get intel officer' });
      }
    }
  }
);

router.post(
  '/organizations/:orgId/intel/officers',
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.appointOfficer, 'body'),
  intelOfficerManagementRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { IntelOfficerService } = await import('../../services/intel/IntelOfficerService');
      const service = new IntelOfficerService();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(getRequestBodyRecord(req), [
        'userId',
        'rank',
        'accessLevel',
        'specializations',
        'notes',
      ]);

      const officer = await service.appointOfficer(
        { ...safeBody, organizationId: req.params.orgId } as AppointOfficerInput,
        userId,
        ipAddress,
        userAgent
      );
      res.status(201).json({ success: true, data: officer });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('owner') || message.includes('permission')) {
        res.status(403).json({ error: message });
      } else {
        logger.error('Failed to appoint intel officer', {
          orgId: req.params.orgId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to appoint intel officer' });
      }
    }
  }
);

router.patch(
  '/organizations/:orgId/intel/officers/:officerId',
  validateSchema(intelSchemas.officerIdParam, 'params'),
  validateSchema(intelSchemas.updateOfficer, 'body'),
  intelOfficerManagementRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { IntelOfficerService } = await import('../../services/intel/IntelOfficerService');
      const service = new IntelOfficerService();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(getRequestBodyRecord(req), [
        'rank',
        'accessLevel',
        'specializations',
        'notes',
        'isActive',
      ]);

      const updated = await service.updateOfficer(
        req.params.officerId,
        userId,
        req.params.orgId,
        safeBody,
        ipAddress,
        userAgent
      );
      res.json({ success: true, data: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Intel officer not found' });
      } else if (message.includes('owner') || message.includes('permission')) {
        res.status(403).json({ error: message });
      } else {
        logger.error('Failed to update intel officer', {
          officerId: req.params.officerId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to update intel officer' });
      }
    }
  }
);

router.delete(
  '/organizations/:orgId/intel/officers/:officerId',
  validateSchema(intelSchemas.officerIdParam, 'params'),
  intelOfficerManagementRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { IntelOfficerService } = await import('../../services/intel/IntelOfficerService');
      const service = new IntelOfficerService();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');
      await service.removeOfficer(
        req.params.officerId,
        userId,
        req.params.orgId,
        undefined,
        ipAddress,
        userAgent
      );
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Intel officer not found' });
      } else if (message.includes('owner') || message.includes('permission')) {
        res.status(403).json({ error: message });
      } else {
        logger.error('Failed to remove intel officer', {
          officerId: req.params.officerId,
          error: message,
        });
        res.status(500).json({ error: 'Failed to remove intel officer' });
      }
    }
  }
);

// ==================== AUDIT LOGS ====================

router.get(
  '/organizations/:orgId/intel/audit-logs',
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.queryAuditLogs, 'query'),
  intelOperationsRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { IntelVaultService } = await import('../../services/intel/IntelVaultService');
      const service = new IntelVaultService();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const {
        intelEntryId,
        action,
        userId: filterUserId,
        startDate,
        endDate,
        limit,
        offset,
      } = req.query;
      const result = await service.getAuditLogs(req.params.orgId, userId, {
        intelEntryId: intelEntryId as string | undefined,
        action: action as IntelAuditAction | undefined,
        userId: filterUserId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? Number.parseInt(limit as string, 10) : undefined,
        offset: offset ? Number.parseInt(offset as string, 10) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('Failed to get intel audit logs', {
        orgId: req.params.orgId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to get intel audit logs' });
    }
  }
);

// Audit flags, watchlist, and member profile routes are served by
// memberAuditRouter (mounted in v2/index.ts). No stubs needed here.

export { router as intelRoutes };
