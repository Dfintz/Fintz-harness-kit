import crypto from 'node:crypto';

import { NextFunction, Response } from 'express';

import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { GuildOrganizationService } from '../services/discord/GuildOrganizationService';
import { logger } from '../utils/logger';

import { authenticateToken, AuthRequest } from './auth';
import { requireTenantContext, TenantAuthRequest, tenantContextMiddleware } from './tenantContext';

/**
 * Composite authentication middleware: accepts either
 *   (a) a Discord-bot internal call authenticated by BOT_INTERNAL_SECRET +
 *       X-Discord-Guild-Id (and optional X-Discord-User-Id), or
 *   (b) a normal authenticated user request with tenant context.
 *
 * For bot calls we resolve the guild → organization mapping and synthesize
 * req.user / req.tenantContext so downstream controllers behave identically
 * to a JWT-authenticated, org-scoped request. When X-Discord-User-Id is
 * supplied and matches a linked SC Fleet Manager user, that user's ID is
 * used; otherwise a synthetic system-bot identity is set so read-only
 * controllers continue to work.
 */
const isNonProductionEnv = (): boolean =>
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

// Nil UUID used as fallback when the Discord user has no linked platform account.
// Must be a valid UUID so TypeORM queries don't fail with "invalid input syntax for type uuid".
const SYSTEM_BOT_USER_ID = '00000000-0000-0000-0000-000000000000';

async function handleBotRequest(
  req: TenantAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const secret = process.env.BOT_INTERNAL_SECRET;
  const provided = req.headers['x-bot-internal-token'];

  if (secret) {
    // CWE-208: Use constant-time comparison to prevent timing attacks.
    const providedStr = typeof provided === 'string' ? provided : '';
    const providedBuf = Buffer.from(providedStr);
    const secretBuf = Buffer.from(secret);
    const isValid =
      providedBuf.length === secretBuf.length && crypto.timingSafeEqual(providedBuf, secretBuf);
    if (!isValid) {
      logger.error('Bot auth rejected: token mismatch', {
        path: req.path,
        method: req.method,
        providedLength: providedStr.length,
        expectedLength: secret.length,
        providedPrefix: providedStr.substring(0, 4) || 'none',
        expectedPrefix: secret.substring(0, 4),
      });
      res.status(401).json({ error: 'Unauthorized: invalid bot token' });
      return;
    }
  } else if (!isNonProductionEnv()) {
    logger.error('Bot auth rejected: BOT_INTERNAL_SECRET is not configured on API side', {
      path: req.path,
      method: req.method,
    });
    res.status(401).json({ error: 'Unauthorized: BOT_INTERNAL_SECRET is not configured' });
    return;
  }

  const guildId = req.headers['x-discord-guild-id'] as string | undefined;
  if (!guildId) {
    res.status(400).json({ error: 'X-Discord-Guild-Id header is required for bot requests' });
    return;
  }

  try {
    const guildOrgService = GuildOrganizationService.getInstance();
    const orgId = await guildOrgService.resolveOrganization(guildId);
    if (!orgId) {
      logger.warn('Bot request: guild not linked to any organization', { guildId });
      res
        .status(403)
        .json({ error: 'Forbidden: this Discord guild is not linked to an organization' });
      return;
    }

    const discordUserId = req.headers['x-discord-user-id'] as string | undefined;
    let userId = SYSTEM_BOT_USER_ID;
    let username = 'discord-bot';
    if (discordUserId && AppDataSource.isInitialized) {
      const userRepo = AppDataSource.getRepository(User);
      const linkedUser = await userRepo.findOne({ where: { discordId: discordUserId } });
      if (linkedUser) {
        userId = linkedUser.id;
        username = linkedUser.username ?? username;
      }
    }

    req.user = {
      id: userId,
      username,
      role: 'bot',
      discordId: discordUserId,
      currentOrganizationId: orgId,
    };
    req.tenantContext = {
      organizationId: orgId,
      userId,
      userRole: 'bot',
    };

    next();
  } catch (err) {
    logger.error('Failed to resolve bot org context', { err, guildId });
    res.status(500).json({ error: 'Internal server error during bot auth' });
  }
}

/**
 * Use this in place of `[authenticateToken, tenantContextMiddleware, requireTenantContext]`
 * on routes that need to be callable by both end users and the Discord bot.
 */
export const botOrUserAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void | Promise<void> => {
  const botToken = req.headers['x-bot-internal-token'];
  if (botToken) {
    logger.info('botOrUserAuth: bot token detected, routing to handleBotRequest', {
      path: req.path,
      method: req.method,
      hasGuildId: !!req.headers['x-discord-guild-id'],
    });
    return handleBotRequest(req, res, next);
  }

  void authenticateToken(req, res, (authErr?: unknown) => {
    if (authErr) {
      return next(authErr);
    }
    if (res.headersSent) {
      return;
    }
    void tenantContextMiddleware(req, res, (tcErr?: unknown) => {
      if (tcErr) {
        return next(tcErr);
      }
      if (res.headersSent) {
        return;
      }
      requireTenantContext(req, res, next);
    });
  });
};
