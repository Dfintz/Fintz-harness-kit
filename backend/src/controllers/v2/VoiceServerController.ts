/**
 * VoiceServerController — REST endpoints for voice server integration.
 *
 * Organization-scoped:
 *   GET  /api/v2/organizations/:orgId/voice-server/config
 *   GET  /api/v2/organizations/:orgId/voice-server/status
 *   GET  /api/v2/organizations/:orgId/voice-server/stats
 *   PUT  /api/v2/organizations/:orgId/voice-server/config
 *   DELETE /api/v2/organizations/:orgId/voice-server/config
 *
 * Federation-scoped:
 *   GET  /api/v2/federations/:federationId/voice-server/config
 *   GET  /api/v2/federations/:federationId/voice-server/status
 *   GET  /api/v2/federations/:federationId/voice-server/stats
 *   PUT  /api/v2/federations/:federationId/voice-server/config
 *   DELETE /api/v2/federations/:federationId/voice-server/config
 *   GET  /api/v2/federations/:federationId/voice-server/sharing/suggestions
 *
 * User-scoped:
 *   GET  /api/v2/voice-server/accessible — list every voice server the caller can use
 *
 * Voice token (legacy platform Mumble plumbing — see VoiceAuthService):
 *   POST /api/v2/voice-server/auth/token
 *   POST /api/v2/voice-server/auth/validate
 *   POST /api/v2/voice-server/platform/channel-data  (internal CVP bridge)
 */

import { Request, Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { VoiceAuthService } from '../../services/communication/voice/VoiceAuthService';
import { VoiceServerService } from '../../services/communication/voice/VoiceServerService';
import { ForbiddenError } from '../../utils/apiErrors';
import { sanitizeObject } from '../../utils/prototypePollutionPrevention';
import { BaseController } from '../BaseController';

export class VoiceServerController extends BaseController {
  private readonly voiceService = VoiceServerService.getInstance();

  // ── Organization Endpoints ────────────────────────────────

  getOrgConfig = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.getOrgVoiceConfigForUser(authReq.params.orgId, userId);
    });
  };

  getOrgStatus = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.getOrgVoiceStatusForUser(authReq.params.orgId, userId);
    });
  };

  getOrgStats = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.getOrgVoiceStatsForUser(authReq.params.orgId, userId);
    });
  };

  updateOrgConfig = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.updateOrgVoiceConfig(
        authReq.params.orgId,
        userId,
        sanitizeObject(authReq.body)
      );
    });
  };

  deleteOrgConfig = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      await this.voiceService.deleteOrgVoiceConfig(authReq.params.orgId, userId);
      return { success: true };
    });
  };

  getOrgWhitelistSuggestions = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.voiceService.getWhitelistSuggestions(req.params.orgId)
    );
  };

  // ── Federation Endpoints ──────────────────────────────────

  getFedConfig = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.getFederationVoiceConfigForUser(req.params.federationId, userId);
    });
  };

  getFedStatus = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.getFederationVoiceStatusForUser(req.params.federationId, userId);
    });
  };

  getFedStats = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.getFederationVoiceStatsForUser(req.params.federationId, userId);
    });
  };

  updateFedConfig = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const orgId = this.getAuthUser(authReq).currentOrganizationId
        ? this.getOrganizationId(authReq)
        : await this.voiceService.resolveFederationActorOrganizationId(
            userId,
            authReq.params.federationId
          );
      return this.voiceService.updateFedVoiceConfig(
        authReq.params.federationId,
        orgId,
        userId,
        sanitizeObject(authReq.body)
      );
    });
  };

  deleteFedConfig = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const orgId = this.getAuthUser(authReq).currentOrganizationId
        ? this.getOrganizationId(authReq)
        : await this.voiceService.resolveFederationActorOrganizationId(
            userId,
            authReq.params.federationId
          );
      await this.voiceService.deleteFedVoiceConfig(authReq.params.federationId, orgId, userId);
      return { success: true };
    });
  };

  getFedWhitelistSuggestions = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.getFederationWhitelistSuggestionsForUser(
        authReq.params.federationId,
        userId
      );
    });
  };

  // ── Accessible Voice Servers (per-user) ───────────────────

  /**
   * List every voice server the current user can connect to — their own org
   * servers, federation servers, and any third-party servers shared with them
   * via whitelist.
   */
  listAccessible = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      return this.voiceService.listAccessibleVoiceServers(userId);
    });
  };

  // ── RSI SID Lookups ─────────────────────────────────────────

  /**
   * Lookup organization by RSI SID.
   * GET /api/v2/voice/org-lookup?rsiSid=ACME
   *
   * Used by voice settings UI to auto-populate org ID from RSI SID.
   * Enforces tenant scoping — org must belong to requesting user's tenant.
   */
  lookupOrgByRsiSid = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const { rsiSid } = authReq.query as { rsiSid: string };
      const userOrgId = this.getAuthUser(authReq).currentOrganizationId;

      if (!userOrgId) {
        throw new ForbiddenError('User has no active organization context');
      }

      return this.voiceService.getOrganizationByRsiSid(rsiSid, userOrgId);
    });
  };

  /**
   * Get federations with positive relationships for user's organization.
   * GET /api/v2/voice/federations-with-relationships
   *
   * Used by voice settings UI to auto-populate federation list.
   * Returns only federations where user's org is a member and has active positive relationships.
   */
  getPositiveRelationshipFederations = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const user = this.getAuthUser(authReq);
      const userOrgId = user.currentOrganizationId;

      if (!userOrgId) {
        throw new ForbiddenError('User has no active organization context');
      }

      return this.voiceService.getFederationsWithPositiveRelationshipsForUser(user.id, userOrgId);
    });
  };

  // ── Platform Mumble Endpoints (legacy CVP bridge + token) ─

  /**
   * Receive Mumble channel data pushed from a CVP bridge
   * (internal service auth). Writes data to Redis for consumption by
   * queryMumbleServer().
   *
   * Per-server scoping: the bridge may pass `?scope=<ownerScope>` (e.g.
   * `fed:<federationId>` or `org:<orgId>`) so each voice server gets its
   * own Redis bucket. Omitting the param falls back to the legacy
   * `'platform'` scope for backwards compatibility with existing bridges.
   */
  updatePlatformChannelData = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const rawScope = req.query.scope;
      const ownerScope =
        typeof rawScope === 'string' && rawScope.length > 0 && rawScope.length <= 128
          ? rawScope
          : 'platform';
      await this.voiceService.cachePlatformChannelData(req.body, ownerScope);
      return { success: true };
    });
  };

  // ── Voice Auth Token Endpoints ────────────────────────────

  /**
   * Generate a voice auth token for the current user.
   * Returns a mumble:// URL with embedded credentials.
   *
   * Tenant isolation: only users in an org that is an active member of
   * PLATFORM_MUMBLE_FEDERATION_ID can mint a token. Without this check, any
   * authenticated platform user could connect to the federation's private Mumble.
   */
  generateVoiceToken = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const user = this.getAuthUser(authReq);

      const hasAccess = await this.voiceService.checkPlatformMumbleAccess(user.id);
      if (!hasAccess) {
        throw new ForbiddenError(
          'You must be a member of the platform federation to access this voice server'
        );
      }

      const connectInfo = await this.voiceService.getPlatformConnectInfo();
      if (!connectInfo.connectUrl) {
        return { error: 'Platform voice server not configured' };
      }
      const authService = VoiceAuthService.getInstance();
      return authService.generateToken(user.id, user.username ?? user.id, connectInfo.connectUrl);
    });
  };

  /**
   * Validate a voice auth token (called by ICE authenticator on Mumble VM).
   */
  validateVoiceToken = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { token, username } = req.body as { token: string; username: string };
      const authService = VoiceAuthService.getInstance();
      return authService.validateToken(token, username);
    });
  };
}
