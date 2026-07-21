/**
 * Voice Server Routes — External voice server integration endpoints.
 *
 * Org-scoped:   /api/v2/organizations/:orgId/voice-server/*
 * Fed-scoped:   /api/v2/federations/:federationId/voice-server/*
 * Platform:     /api/v2/voice-server/platform/*
 */

import { NextFunction, Response, Router } from 'express';

import { VoiceServerController } from '../../controllers/v2/VoiceServerController';
import { AppDataSource } from '../../data-source';
import { authenticate, type AuthRequest } from '../../middleware/auth';
import { internalServiceAuthRequired } from '../../middleware/internalServiceAuth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  rsiSidLookupSchema,
  voiceChannelDataSchema,
  voiceServerConfigSchema,
  voiceServerFedParamsSchema,
  voiceServerOrgParamsSchema,
  voiceServerStatsQuerySchema,
  voiceTokenValidateSchema,
} from '../../schemas/voiceServerSchemas';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';

const router = Router();
const controller = new VoiceServerController();
const membershipRepo = AppDataSource.getRepository(OrganizationMembership);

async function resolveOrgVoiceWriteRoleContext(
  userId: string | undefined,
  targetOrgId: string | undefined
): Promise<{
  resolvedRole: string | undefined;
  membershipRole: string | undefined;
  usedMembershipLookup: boolean;
}> {
  if (!userId || !targetOrgId) {
    return {
      resolvedRole: undefined,
      membershipRole: undefined,
      usedMembershipLookup: false,
    };
  }

  const membership = await membershipRepo.findOne({
    where: { userId, organizationId: targetOrgId, isActive: true },
    relations: ['role'],
  });

  const membershipRole = getRoleName(membership?.role) || undefined;

  // IMPORTANT: Do NOT fall back to tenantContextRole (user's active org role).
  // Voice server config writes MUST be authorized against the TARGET organization membership only.
  // This prevents users from cross-org writes by leveraging their role in their active org.
  // See voice-server-write-auth-target-org.md for the security rationale.
  return {
    resolvedRole: membershipRole,
    membershipRole,
    usedMembershipLookup: true,
  };
}

// Middleware stacks
// Note: 'founder' is the primary org-creator role; 'owner' is a legacy alias
// (see backend/src/utils/roleUtils.ts DEFAULT_ROLE_PERMISSIONS).
const ORG_VOICE_WRITE_ROLES = ['founder', 'owner', 'admin'];
const VOICE_SERVER_WRITE_MESSAGE =
  'Only organization founders, owners, and admins can manage voice server settings';
const orgRead = [authenticate, tenantContextMiddleware, requireTenantContext];
const orgWrite = [
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const targetOrgId = req.params.orgId;
    const activeOrgId = req.tenantContext?.organizationId;
    const tenantContextRole = req.tenantContext?.organizationRole;
    const { resolvedRole, membershipRole, usedMembershipLookup } =
      await resolveOrgVoiceWriteRoleContext(req.user?.id, targetOrgId);

    if (!resolvedRole || !ORG_VOICE_WRITE_ROLES.includes(resolvedRole)) {
      logger.warn('Denied organization voice server write', {
        userId: req.user?.id,
        targetOrgId,
        activeOrgId,
        tenantContextOrganizationRole: tenantContextRole,
        requestedOrganizationRole: membershipRole,
        resolvedOrganizationRole: resolvedRole,
        usedMembershipLookup,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        error: 'Insufficient permissions',
        message: VOICE_SERVER_WRITE_MESSAGE,
        required: ORG_VOICE_WRITE_ROLES,
        current: resolvedRole,
      });
      return;
    }

    next();
  },
];

// ── Organization-scoped endpoints ─────────────────────────────

router.get(
  '/organizations/:orgId/voice-server/config',
  ...orgRead,
  validateSchema(voiceServerOrgParamsSchema, 'params'),
  controller.getOrgConfig
);

router.get(
  '/organizations/:orgId/voice-server/status',
  ...orgRead,
  validateSchema(voiceServerOrgParamsSchema, 'params'),
  controller.getOrgStatus
);

router.get(
  '/organizations/:orgId/voice-server/stats',
  ...orgRead,
  validateSchema(voiceServerOrgParamsSchema, 'params'),
  validateSchema(voiceServerStatsQuerySchema, 'query'),
  controller.getOrgStats
);

router.put(
  '/organizations/:orgId/voice-server/config',
  validateSchema(voiceServerOrgParamsSchema, 'params'),
  ...orgWrite,
  validateSchema(voiceServerConfigSchema, 'body'),
  controller.updateOrgConfig
);

router.delete(
  '/organizations/:orgId/voice-server/config',
  validateSchema(voiceServerOrgParamsSchema, 'params'),
  ...orgWrite,
  controller.deleteOrgConfig
);

router.get(
  '/organizations/:orgId/voice-server/sharing/suggestions',
  validateSchema(voiceServerOrgParamsSchema, 'params'),
  ...orgWrite,
  controller.getOrgWhitelistSuggestions
);

// ── Federation-scoped endpoints ───────────────────────────────

router.get(
  '/federations/:federationId/voice-server/config',
  authenticate,
  validateSchema(voiceServerFedParamsSchema, 'params'),
  controller.getFedConfig
);

router.get(
  '/federations/:federationId/voice-server/status',
  authenticate,
  validateSchema(voiceServerFedParamsSchema, 'params'),
  controller.getFedStatus
);

router.get(
  '/federations/:federationId/voice-server/stats',
  authenticate,
  validateSchema(voiceServerFedParamsSchema, 'params'),
  validateSchema(voiceServerStatsQuerySchema, 'query'),
  controller.getFedStats
);

router.put(
  '/federations/:federationId/voice-server/config',
  authenticate,
  validateSchema(voiceServerFedParamsSchema, 'params'),
  validateSchema(voiceServerConfigSchema, 'body'),
  controller.updateFedConfig
);

router.delete(
  '/federations/:federationId/voice-server/config',
  authenticate,
  validateSchema(voiceServerFedParamsSchema, 'params'),
  controller.deleteFedConfig
);

router.get(
  '/federations/:federationId/voice-server/sharing/suggestions',
  authenticate,
  validateSchema(voiceServerFedParamsSchema, 'params'),
  controller.getFedWhitelistSuggestions
);

// ── Accessible voice servers (per-user) ───────────────────────

router.get('/voice-server/accessible', authenticate, controller.listAccessible);

// ── RSI SID Lookups ────────────────────────────────────────────

// Lookup organization by RSI SID (for voice settings auto-population)
router.get(
  '/voice/org-lookup',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(rsiSidLookupSchema, 'query'),
  controller.lookupOrgByRsiSid
);

// Get federations with positive relationships (for voice settings)
router.get(
  '/voice/federations-with-relationships',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  controller.getPositiveRelationshipFederations
);

// ── Platform Mumble endpoints (legacy CVP bridge + auth token) ─

// Internal: CVP bridge pushes channel data (HMAC service auth)
router.post(
  '/voice-server/platform/channel-data',
  internalServiceAuthRequired,
  validateSchema(voiceChannelDataSchema, 'body'),
  controller.updatePlatformChannelData
);

// Voice auth: generate token for authenticated users
router.post('/voice-server/auth/token', authenticate, controller.generateVoiceToken);

// Voice auth: validate token (internal service auth from ICE authenticator)
router.post(
  '/voice-server/auth/validate',
  internalServiceAuthRequired,
  validateSchema(voiceTokenValidateSchema, 'body'),
  controller.validateVoiceToken
);

export { router as voiceServerRouter };
