import { NextFunction, Request, Response } from 'express';

import { GuildOrganizationService } from '../services/discord/GuildOrganizationService';
import { logger } from '../utils/logger';

/**
 * Bot request authentication middleware.
 *
 * Two-layer guard for routes called by the co-located Discord bot:
 *
 * 1. Shared-secret check — the caller must supply a matching X-Bot-Internal-Token
 *    header.  BOT_INTERNAL_SECRET is **required unless NODE_ENV is 'development' or
 *    'test'**.  This means staging and any other non-dev/test environment also fails
 *    closed if the secret is absent, guarding against misconfigured deployments.
 *
 * 2. Guild-to-org ownership check (org-scoped routes only) — the caller must
 *    include an X-Discord-Guild-Id header whose linked organization matches the
 *    :orgId URL parameter.  This prevents external callers from targeting
 *    arbitrary organizations even if they reach the endpoint.
 *
 * Usage:
 *   router.post('/organizations/:orgId/rsi-user-links', validateBotRequest, handler)
 *   router.get('/guild-organizations/:guildId', validateBotToken, handler)
 */

/** Returns true when the environment is known non-production (dev or test). */
const isNonProductionEnv = (): boolean =>
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

/** Validates the shared-secret token only (for routes without an orgId param). */
export const validateBotToken = (req: Request, res: Response, next: NextFunction): void => {
  const secret = process.env.BOT_INTERNAL_SECRET;
  const provided = req.headers['x-bot-internal-token'];
  if (!secret) {
    // Fail closed everywhere except explicit development/test environments.
    // This guards against misconfigured staging or production deployments where
    // the env var is missing but NODE_ENV is not 'production'.
    if (!isNonProductionEnv()) {
      res.status(401).json({ error: 'Unauthorized: BOT_INTERNAL_SECRET is not configured' });
      return;
    }
    next();
    return;
  }
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

/**
 * Validates the shared-secret token AND verifies that the guild ID in the request
 * headers belongs to the organization specified in the :orgId URL parameter.
 */
export const validateBotRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Layer 1: shared-secret check
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret) {
    if (!isNonProductionEnv()) {
      res.status(401).json({ error: 'Unauthorized: BOT_INTERNAL_SECRET is not configured' });
      return;
    }
  } else {
    const provided = req.headers['x-bot-internal-token'];
    if (provided !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  // Layer 2: guild-to-org ownership check
  const guildId = req.headers['x-discord-guild-id'] as string | undefined;
  const { orgId } = req.params;

  if (!orgId) {
    // No orgId param — skip ownership check (token-only route)
    next();
    return;
  }

  if (!guildId) {
    res.status(400).json({ error: 'X-Discord-Guild-Id header is required' });
    return;
  }

  try {
    const guildOrgService = GuildOrganizationService.getInstance();
    const resolvedOrgId = await guildOrgService.resolveOrganization(guildId);
    if (resolvedOrgId !== orgId) {
      logger.warn('Bot request guild/org mismatch', { guildId, orgId, resolvedOrgId });
      res.status(403).json({ error: 'Forbidden: guild does not belong to organization' });
      return;
    }
    next();
  } catch (err) {
    logger.error('Failed to validate bot request', { err });
    res.status(500).json({ error: 'Internal server error during auth' });
  }
};
