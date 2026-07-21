/**
 * RSI User Link Bot Routes
 *
 * Routes called by the co-located Discord bot to manage RSI user links.
 * All routes are protected by the botRequestAuth middleware.
 *
 * Base path: /api/bot/rsi (set in app.ts)
 */

import { NextFunction, Request, Response, Router, type Express } from 'express';

import { getBackendUrl } from '../config/urls';
import { triggerManualSync } from '../jobs/rsiSyncScheduler';
import { validateBotRequest, validateBotToken } from '../middleware/botRequestAuth';
import { RsiUserLink, VerificationMethod } from '../models/RsiUserLink';
import { rsiUserLinkBotSchemas } from '../schemas/rsiUserLinkBotSchemas';
import { discordSettingsService } from '../services/discord/DiscordSettingsService';
import {
  rsiBotUserLookupService,
  rsiSyncAuditService,
  rsiSyncScheduleService,
  rsiUserLinkService,
} from '../services/rsi';
import { DISCORD_ACCOUNT_NOT_LINKED_CODE } from '../utils/discordAccountLink';
import { logger } from '../utils/logger';
import { buildRsiVerificationUrl } from '../utils/rsiVerificationToken';

const router = Router();
interface BotRsiLinkResponse {
  id: string;
  userId: string;
  organizationId: string;
  rsiHandle: string;
  verificationMethod: VerificationMethod;
  verificationCode?: string;
  verifiedAt?: Date;
  lastSyncedAt?: Date;
  syncStatus: string;
  discordUserId?: string;
  lastKnownRank?: string;
  isAffiliate: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  verificationUrl?: string;
}

/**
 * Validation middleware for bot routes
 */
const validateSchema =
  (
    schema: {
      validate: (
        data: unknown,
        opts?: Record<string, unknown>
      ) => { error?: { details: { message: string }[] }; value: unknown };
    },
    source: 'body' | 'params' | 'query' = 'body'
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    let data: unknown;
    if (source === 'body') {
      data = req.body;
    } else if (source === 'params') {
      data = req.params;
    } else {
      data = req.query;
    }

    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }
    if (source === 'body') {
      req.body = value;
    } else if (source === 'params') {
      req.params = value as Record<string, string>;
    } else {
      req.query = value as Record<string, string>;
    }
    next();
  };

function toBotLinkResponse(link: RsiUserLink): BotRsiLinkResponse {
  const verificationCode = link.verificationCode;

  return {
    id: link.id,
    userId: link.userId,
    organizationId: link.organizationId,
    rsiHandle: link.rsiHandle,
    verificationMethod: link.verificationMethod,
    verificationCode,
    verifiedAt: link.verifiedAt,
    lastSyncedAt: link.lastSyncedAt,
    syncStatus: link.syncStatus,
    discordUserId: link.discordUserId,
    lastKnownRank: link.lastKnownRank,
    isAffiliate: link.isAffiliate,
    metadata: link.metadata,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    verificationUrl: verificationCode ? buildRsiVerificationUrl(verificationCode) : undefined,
  };
}

function buildDiscordSsoLoginUrl(): string {
  const backendUrl = getBackendUrl().replace(/\/$/, '');
  return `${backendUrl}/api/v2/auth/discord`;
}

/**
 * GET /api/bot/rsi/guild-organizations/:guildId
 * Resolve which organization a guild belongs to.
 * Used by the bot to get orgId from guildId.
 */
router.get(
  '/guild-organizations/:guildId',
  validateBotToken,
  async (req: Request, res: Response) => {
    try {
      const { guildId } = req.params;
      if (!/^\d{17,20}$/.test(guildId)) {
        res.status(400).json({ error: 'Invalid guildId format' });
        return;
      }
      // Use DiscordSettingsService to find the org by guild
      const settings = await discordSettingsService.getSettingsByGuildId(guildId);
      if (!settings || settings.length === 0) {
        res.status(404).json({ error: 'Guild not found or not linked to any organization' });
        return;
      }
      res.json({
        success: true,
        data: { organizationId: settings[0].organizationId, guildId },
      });
    } catch (err: unknown) {
      logger.error('Failed to resolve guild organization', { err });
      res.status(500).json({ error: 'Failed to resolve guild organization' });
    }
  }
);

/**
 * POST /api/bot/rsi/organizations/:orgId/users/:discordUserId/rsi-link
 * Create or update an RSI user link for a Discord user.
 */
router.post(
  '/organizations/:orgId/users/:discordUserId/rsi-link',
  validateBotRequest,
  validateSchema(rsiUserLinkBotSchemas.createLinkParams, 'params'),
  validateSchema(rsiUserLinkBotSchemas.createLinkBody, 'body'),
  async (req: Request, res: Response) => {
    try {
      const { orgId, discordUserId } = req.params;
      const safeDiscordUserId = discordUserId.trim();
      const { rsiHandle, verificationMethod } = req.body as {
        rsiHandle: string;
        verificationMethod: string;
      };

      if (!/^\d{17,20}$/.test(safeDiscordUserId)) {
        res.status(400).json({ error: 'Invalid discordUserId format' });
        return;
      }

      const existing = await rsiUserLinkService.getLinkByDiscordAndOrg(safeDiscordUserId, orgId);

      if (existing) {
        // Update existing link
        const updated = await rsiUserLinkService.updateLink(existing.id, { rsiHandle });
        if (!updated) {
          res.status(404).json({ error: 'No RSI link found for this user in this organization' });
          return;
        }

        res.json({ success: true, data: toBotLinkResponse(updated), created: false });
        return;
      }

      if (!rsiBotUserLookupService.isAvailable()) {
        res.status(503).json({ error: 'User lookup is temporarily unavailable' });
        return;
      }

      const platformUserId =
        await rsiBotUserLookupService.getPlatformUserIdByDiscordId(safeDiscordUserId);

      if (!platformUserId) {
        res.status(404).json({
          error: 'No platform user linked to this Discord account',
          errorCode: DISCORD_ACCOUNT_NOT_LINKED_CODE,
          message: 'Sign in with Discord SSO on the web app, then retry this command.',
          loginUrl: buildDiscordSsoLoginUrl(),
        });
        return;
      }

      const link = await rsiUserLinkService.createLink({
        userId: platformUserId,
        discordUserId: safeDiscordUserId,
        organizationId: orgId,
        rsiHandle,
        verificationMethod: verificationMethod as VerificationMethod,
      });

      res.status(201).json({ success: true, data: toBotLinkResponse(link), created: true });
    } catch (err: unknown) {
      logger.error('Failed to create RSI user link', { err });
      res.status(500).json({ error: 'Failed to create RSI user link' });
    }
  }
);

/**
 * GET /api/bot/rsi/organizations/:orgId/users/:discordUserId/rsi-link
 * Get the RSI link status for a Discord user in an organization.
 */
router.get(
  '/organizations/:orgId/users/:discordUserId/rsi-link',
  validateBotRequest,
  validateSchema(rsiUserLinkBotSchemas.statusParams, 'params'),
  validateSchema(rsiUserLinkBotSchemas.statusQuery, 'query'),
  async (req: Request, res: Response) => {
    try {
      const { orgId, discordUserId } = req.params;

      const link = await rsiUserLinkService.getLinkByDiscordAndOrg(discordUserId, orgId);
      if (!link) {
        res.status(404).json({ error: 'No RSI link found for this user in this organization' });
        return;
      }

      res.json({ success: true, data: toBotLinkResponse(link) });
    } catch (err: unknown) {
      logger.error('Failed to get RSI user link status', { err });
      res.status(500).json({ error: 'Failed to get RSI user link status' });
    }
  }
);

/**
 * DELETE /api/bot/rsi/organizations/:orgId/users/:discordUserId/rsi-link
 * Remove the RSI link for a Discord user in an organization.
 */
router.delete(
  '/organizations/:orgId/users/:discordUserId/rsi-link',
  validateBotRequest,
  validateSchema(rsiUserLinkBotSchemas.deleteLinkParams, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { orgId, discordUserId } = req.params;

      const link = await rsiUserLinkService.getLinkByDiscordAndOrg(discordUserId, orgId);
      if (!link) {
        res.status(404).json({ error: 'No RSI link found for this user in this organization' });
        return;
      }

      await rsiUserLinkService.deleteLink(link.id);
      res.json({ success: true, message: 'RSI link removed successfully' });
    } catch (err: unknown) {
      logger.error('Failed to delete RSI user link', { err });
      res.status(500).json({ error: 'Failed to delete RSI user link' });
    }
  }
);

/**
 * POST /api/bot/rsi/organizations/:orgId/sync
 * Trigger an RSI sync for an organization (uses existing schedule config).
 */
router.post(
  '/organizations/:orgId/sync',
  validateBotRequest,
  validateSchema(rsiUserLinkBotSchemas.syncParams, 'params'),
  validateSchema(rsiUserLinkBotSchemas.syncBody, 'body'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { force } = req.body as {
        force: boolean;
        targetDiscordUserIds?: string[];
      };

      // Delegate to the schedule service which handles org-level sync config
      const status = await rsiSyncScheduleService.getScheduleStatus(orgId);

      if (!status) {
        res.status(404).json({ error: 'No sync schedule found for this organization' });
        return;
      }

      await triggerManualSync(orgId, `bot-sync${force ? '-forced' : ''}`);

      res.json({ success: true, data: { triggered: true, organizationId: orgId } });
    } catch (err: unknown) {
      logger.error('Failed to run RSI organization sync', { err });
      res.status(500).json({ error: 'Failed to run RSI organization sync' });
    }
  }
);

/**
 * GET /api/bot/rsi/organizations/:orgId/audit
 * Get RSI sync audit logs for an organization.
 */
router.get(
  '/organizations/:orgId/audit',
  validateBotRequest,
  validateSchema(rsiUserLinkBotSchemas.auditParams, 'params'),
  validateSchema(rsiUserLinkBotSchemas.auditQuery, 'query'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { limit, offset, since } = req.query as {
        limit?: string;
        offset?: string;
        discordUserId?: string;
        action?: string;
        since?: string;
      };

      const { logs, total } = await rsiSyncAuditService.getLogs({
        organizationId: orgId,
        limit: limit ? Number.parseInt(limit, 10) : 20,
        offset: offset ? Number.parseInt(offset, 10) : 0,
        fromDate: since ? new Date(since) : undefined,
      });

      res.json({ success: true, data: { logs, total } });
    } catch (err: unknown) {
      logger.error('Failed to get RSI audit logs', { err });
      res.status(500).json({ error: 'Failed to get RSI audit logs' });
    }
  }
);

/**
 * POST /api/bot/rsi/organizations/:orgId/users/:discordUserId/verify-check
 * Trigger bio-code verification check for a user's RSI link.
 * Only checks that the verification code is in the user's RSI bio —
 * does NOT require org membership (that is a sync concern).
 */
router.post(
  '/organizations/:orgId/users/:discordUserId/verify-check',
  validateBotRequest,
  validateSchema(rsiUserLinkBotSchemas.verifyCheckParams, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { orgId, discordUserId } = req.params;

      const link = await rsiUserLinkService.getLinkByDiscordAndOrg(discordUserId, orgId);
      if (!link) {
        res.status(404).json({ error: 'No RSI link found for this user in this organization' });
        return;
      }

      if (link.isVerified()) {
        res.json({
          success: true,
          data: {
            verified: true,
            rsiHandle: link.rsiHandle,
            verificationUrl: link.verificationCode
              ? buildRsiVerificationUrl(link.verificationCode)
              : undefined,
            message: 'Already verified',
          },
        });
        return;
      }

      const result = await rsiUserLinkService.verifyBioCodeOnly(link);

      res.json({
        success: true,
        data: {
          verified: result.verified,
          rsiHandle: link.rsiHandle,
          verificationUrl: link.verificationCode
            ? buildRsiVerificationUrl(link.verificationCode)
            : undefined,
          error: result.error,
        },
      });
    } catch (err: unknown) {
      logger.error('Failed to verify RSI user link', { err });
      res.status(500).json({ error: 'Failed to verify RSI user link' });
    }
  }
);

export function setRsiUserLinkBotRoutes(app: Express): void {
  app.use('/api/bot/rsi', router);
}
