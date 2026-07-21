/**
 * API v2 - Auth Routes
 * Authentication endpoints with standardized responses
 */

import crypto from 'node:crypto';

import { Router } from 'express';

import { getBackendUrl, getFrontendUrl } from '../../config/urls';
import { AuthControllerV2 } from '../../controllers/v2/authController';
import { UserControllerV2 } from '../../controllers/v2/userController';
import { authenticate } from '../../middleware/auth';
import {
  authenticationRateLimiter,
  loginRateLimiter,
  refreshTokenRateLimiter,
  twoFactorRateLimiter,
} from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { authSchemas } from '../../schemas';
import { logger } from '../../utils/logger';
import { getOAuthSecret } from '../../utils/oauthState';

const router = Router();
const controller = new AuthControllerV2();
const userController = new UserControllerV2();

// Login - generates access token and refresh token
router.post(
  '/auth/login',
  loginRateLimiter,
  validateSchema(authSchemas.login, 'body'),
  controller.login.bind(controller)
);

// Development/demo login - convenience for local environments
router.post(
  '/auth/demo',
  loginRateLimiter,
  validateSchema(authSchemas.demoLogin, 'body'),
  controller.demoLogin.bind(controller)
);

// Production-safe sandbox login (feature-flagged)
router.post(
  '/auth/sandbox',
  loginRateLimiter,
  validateSchema(authSchemas.sandboxLogin, 'body'),
  controller.sandboxLogin.bind(controller)
);

// Discord OAuth initiation - redirects to Discord authorization
router.get('/auth/discord', controller.discordInitiate.bind(controller));

// Discord OAuth callback - exchanges code for tokens
// Supports both GET (direct Discord redirect) and POST (frontend-mediated)
// Rate limiting applied to prevent brute force attacks on OAuth flow
router.get(
  '/auth/discord/callback',
  authenticationRateLimiter,
  controller.discordCallback.bind(controller)
);

router.post(
  '/auth/discord/callback',
  authenticationRateLimiter,
  controller.discordCallback.bind(controller)
);

// Azure AD OAuth callback - exchanges code for tokens
// Rate limiting applied to prevent brute force attacks on OAuth flow
router.post(
  '/auth/azuread/callback',
  authenticationRateLimiter,
  controller.azureADCallback.bind(controller)
);

// Google OAuth initiation - redirects to Google authorization
router.get('/auth/google', controller.googleInitiate.bind(controller));

// Google OAuth callback - exchanges code for tokens
router.get(
  '/auth/google/callback',
  authenticationRateLimiter,
  controller.googleCallback.bind(controller)
);

router.post(
  '/auth/google/callback',
  authenticationRateLimiter,
  controller.googleCallback.bind(controller)
);

// Link Google account to authenticated user
router.post(
  '/auth/google/link',
  authenticate,
  authenticationRateLimiter,
  controller.googleLink.bind(controller)
);

// Twitch OAuth initiation - redirects to Twitch authorization
router.get('/auth/twitch', controller.twitchInitiate.bind(controller));

// Twitch OAuth callback - exchanges code for tokens
router.get(
  '/auth/twitch/callback',
  authenticationRateLimiter,
  controller.twitchCallback.bind(controller)
);

router.post(
  '/auth/twitch/callback',
  authenticationRateLimiter,
  controller.twitchCallback.bind(controller)
);

// Link Twitch account to authenticated user
router.post(
  '/auth/twitch/link',
  authenticate,
  authenticationRateLimiter,
  controller.twitchLink.bind(controller)
);

// Refresh token - exchanges refresh token for new access token
router.post(
  '/auth/refresh',
  refreshTokenRateLimiter,
  validateSchema(authSchemas.refresh, 'body'),
  controller.refresh.bind(controller)
);

// Logout - revokes a single refresh token
// No authenticate middleware — logout must work even with an expired/invalid access token
router.post(
  '/auth/logout',
  validateSchema(authSchemas.logout, 'body'),
  controller.logout.bind(controller)
);

// Logout all - revokes all refresh tokens for the user
router.post('/auth/logout-all', authenticate, controller.logoutAll.bind(controller));

// Get active sessions - returns all active refresh tokens
router.get('/auth/sessions', authenticate, controller.getActiveSessions.bind(controller));

// Session management
router.post(
  '/auth/sessions/:sessionId/revoke',
  authenticate,
  controller.revokeSession.bind(controller)
);

router.get('/auth/tokens/verify', authenticate, controller.verifyToken.bind(controller));

// Current user - returns the authenticated user's profile
// This endpoint is used by the frontend to validate cookie-based sessions
router.get('/auth/me', authenticate, userController.getCurrentUser.bind(userController));

// 2FA (Two-Factor Authentication) endpoints
router.post(
  '/auth/2fa/enable',
  authenticate,
  twoFactorRateLimiter,
  controller.enable2FA.bind(controller)
);

router.post(
  '/auth/2fa/verify',
  authenticate,
  twoFactorRateLimiter,
  controller.verify2FA.bind(controller)
);

router.post(
  '/auth/2fa/disable',
  authenticate,
  twoFactorRateLimiter,
  controller.disable2FA.bind(controller)
);

/**
 * GET /api/v2/auth/bot-invite
 * Redirect to the Discord bot invite URL with OAuth2 redirect flow.
 *
 * When orgId and userId are provided (authenticated flow from org settings),
 * includes redirect_uri and state so Discord returns guild_id after authorization.
 * This enables auto-connecting the guild to the organization.
 *
 * Without orgId (public/landing page flow), redirects directly to Discord
 * with no callback — user must manually link the guild afterward.
 */
router.get('/auth/bot-invite', (req, res) => {
  const clientId = process.env.DISCORD_BOT_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: 'Bot invite not configured' });
    return;
  }

  const permissions = '1419813317751';
  const orgId = typeof req.query.orgId === 'string' ? req.query.orgId.trim() : '';
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';

  // If orgId + userId provided, use redirect flow for auto-connection
  if (orgId && userId) {
    const backendUrl = getBackendUrl();
    const redirectUri = `${backendUrl}/api/v2/auth/bot-invite/callback`;

    // Generate HMAC-signed state containing orgId and userId
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString(36);
    const payload = `${nonce}.${timestamp}.${orgId}.${userId}`;
    const secret = getOAuthSecret();
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = `${payload}.${signature}`;

    const url =
      `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}` +
      `&scope=bot+applications.commands` +
      `&permissions=${permissions}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    res.redirect(url);
    return;
  }

  // Public flow: no redirect, Discord shows success page
  const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot+applications.commands&permissions=${permissions}`;
  res.redirect(url);
});

/**
 * GET /api/v2/auth/bot-invite/callback
 * Discord redirects here after the user authorizes the bot.
 * Receives guild_id, code, and state. Validates state, auto-creates
 * the guild-org mapping, and redirects to the frontend org settings.
 */
router.get('/auth/bot-invite/callback', authenticationRateLimiter, async (req, res) => {
  const frontendUrl = getFrontendUrl();
  const settingsUrl = `${frontendUrl}/discord`;

  try {
    const { guild_id: guildId, state, error: oauthError } = req.query;

    // Handle OAuth errors from Discord
    if (oauthError) {
      logger.warn('Bot invite OAuth error from Discord', { error: oauthError });
      res.redirect(`${settingsUrl}?bot_error=oauth_denied`);
      return;
    }

    if (typeof state !== 'string' || typeof guildId !== 'string') {
      logger.warn('Bot invite callback missing state or guild_id');
      res.redirect(`${settingsUrl}?bot_error=missing_params`);
      return;
    }

    // Validate HMAC-signed state
    const parts = state.split('.');
    if (parts.length !== 5) {
      logger.warn('Bot invite callback invalid state format');
      res.redirect(`${settingsUrl}?bot_error=invalid_state`);
      return;
    }

    const [nonce, timestamp, orgId, userId, signature] = parts;
    const payload = `${nonce}.${timestamp}.${orgId}.${userId}`;
    const secret = getOAuthSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (
      !signature ||
      !expectedSignature ||
      !crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))
    ) {
      logger.warn('Bot invite callback state signature mismatch');
      res.redirect(`${settingsUrl}?bot_error=invalid_state`);
      return;
    }

    // Verify timestamp is not too old (15 minutes)
    const stateTimestamp = Number.parseInt(timestamp, 36);
    const MAX_STATE_AGE_MS = 15 * 60 * 1000;
    if (Date.now() - stateTimestamp > MAX_STATE_AGE_MS) {
      logger.warn('Bot invite callback state expired');
      res.redirect(`${settingsUrl}?bot_error=state_expired`);
      return;
    }

    // Auto-create the guild-org mapping
    const { GuildOrganizationService } =
      await import('../../services/discord/GuildOrganizationService');
    const guildOrgService = GuildOrganizationService.getInstance();

    // Fetch real guild name from Discord API (falls back to placeholder)
    const guildName = await guildOrgService.fetchGuildName(guildId, `Guild ${guildId}`);

    await guildOrgService.syncOnDiscordConnection(guildId, orgId, guildName, userId);

    logger.info(`Auto-connected guild ${guildId} to org ${orgId} via bot invite callback`);

    // Redirect to frontend with success indicator
    res.redirect(`${settingsUrl}?bot_connected=true&guild_id=${encodeURIComponent(guildId)}`);
  } catch (error) {
    logger.error('Bot invite callback error:', error);
    res.redirect(`${settingsUrl}?bot_error=connection_failed`);
  }
});

export { router };
