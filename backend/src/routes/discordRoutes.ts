import { Router } from 'express';

import { router as discordSettingsRouter } from '../controllers/discord/discordSettingsController';
import { authenticateToken, authenticateWithTenant, type AuthRequest } from '../middleware/auth';
import { autoRefreshDiscordToken } from '../middleware/autoRefreshToken';
import { getDiscordService } from '../services/discord/DiscordService';
import { discordSettingsService } from '../services/discord/DiscordSettingsService';
import { ForbiddenError } from '../utils/apiErrors';
import { discordIdSchema } from '../utils/joiValidators';
import { logger } from '../utils/logger';

const router = Router();

// Auth middleware stack applied per-route to avoid leaking to all /api/* routes.
// Tenant-scoped auth populates req.user.currentOrganizationId for guild access checks.
const discordTenantAuth = [authenticateWithTenant, autoRefreshDiscordToken] as const;

// Discord Settings routes (for organization-specific Discord guild settings)
router.use('/orgs', authenticateToken, autoRefreshDiscordToken, discordSettingsRouter);

/**
 * Verify that the authenticated user's current organization is linked to the
 * given Discord guild. Sends a 403 response and returns false on failure.
 * Returns true when the caller is authorized to act on the guild.
 */
async function ensureGuildAccess(
  req: AuthRequest,
  res: import('express').Response,
  guildId: string
): Promise<boolean> {
  try {
    await discordSettingsService.requireGuildAccess(req.user?.currentOrganizationId, guildId);
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
      return false;
    }
    logger.error('Unexpected error during guild access check', {
      guildId,
      orgId: req.user?.currentOrganizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Authorization check failed' });
    return false;
  }
}

router.get(
  '/discord/roles/:guildId/:userId',
  ...discordTenantAuth,
  async (req: AuthRequest, res) => {
    const { guildId, userId } = req.params;

    // Validate Discord IDs to prevent injection
    const guildIdValidation = discordIdSchema.validate(guildId);
    const userIdValidation = discordIdSchema.validate(userId);

    if (guildIdValidation.error || userIdValidation.error) {
      res.status(400).json({ error: 'Invalid Discord ID format' });
      return;
    }

    if (!(await ensureGuildAccess(req, res, guildId))) {
      return;
    }

    try {
      const discordService = getDiscordService();
      const roles = await discordService.getUserRoles(guildId, userId);
      res.status(200).json(roles);
    } catch (error: unknown) {
      logger.error('Failed to fetch user roles', {
        guildId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  }
);

router.post(
  '/discord/roles/:guildId/:userId',
  ...discordTenantAuth,
  async (req: AuthRequest, res) => {
    const { guildId, userId } = req.params;
    const { roleId = '' } = (req.body ?? {}) as { roleId?: string };

    // Validate Discord IDs to prevent injection
    const guildIdValidation = discordIdSchema.validate(guildId);
    const userIdValidation = discordIdSchema.validate(userId);
    const roleIdValidation = discordIdSchema.validate(roleId);

    if (guildIdValidation.error || userIdValidation.error || roleIdValidation.error) {
      res.status(400).json({ error: 'Invalid Discord ID format' });
      return;
    }

    if (!(await ensureGuildAccess(req, res, guildId))) {
      return;
    }

    try {
      const discordService = getDiscordService();
      const message = await discordService.assignRole(guildId, userId, roleId);
      res.status(200).json({ message });
    } catch (error: unknown) {
      logger.error('Failed to assign Discord role', {
        guildId,
        userId,
        roleId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to assign role' });
    }
  }
);

router.delete(
  '/discord/roles/:guildId/:userId',
  ...discordTenantAuth,
  async (req: AuthRequest, res) => {
    const { guildId, userId } = req.params;
    const { roleId = '' } = (req.body ?? {}) as { roleId?: string };

    // Validate Discord IDs to prevent injection
    const guildIdValidation = discordIdSchema.validate(guildId);
    const userIdValidation = discordIdSchema.validate(userId);
    const roleIdValidation = discordIdSchema.validate(roleId);

    if (guildIdValidation.error || userIdValidation.error || roleIdValidation.error) {
      res.status(400).json({ error: 'Invalid Discord ID format' });
      return;
    }

    if (!(await ensureGuildAccess(req, res, guildId))) {
      return;
    }

    try {
      const discordService = getDiscordService();
      const message = await discordService.removeRole(guildId, userId, roleId);
      res.status(200).json({ message });
    } catch (error: unknown) {
      logger.error('Failed to remove Discord role', {
        guildId,
        userId,
        roleId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to remove role' });
    }
  }
);

// ── Guild Roles & Channels (for dropdown population) ──────────────

/**
 * GET /discord/guild/:guildId/roles
 * Returns all roles for a guild (for dropdown population in settings UI)
 */
router.get('/discord/guild/:guildId/roles', ...discordTenantAuth, async (req: AuthRequest, res) => {
  const { guildId } = req.params;

  const guildIdValidation = discordIdSchema.validate(guildId);
  if (guildIdValidation.error) {
    res.status(400).json({ error: 'Invalid guild ID format' });
    return;
  }

  if (!(await ensureGuildAccess(req, res, guildId))) {
    return;
  }

  try {
    const discordService = getDiscordService();
    const roles = await discordService.getGuildRoles(guildId);
    res.json({ success: true, data: roles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch guild roles', { guildId, error: message });
    res.status(500).json({ error: 'Failed to fetch guild roles' });
  }
});

/**
 * GET /discord/guild/:guildId/channels
 * Returns all text/voice channels for a guild (for dropdown population)
 */
router.get(
  '/discord/guild/:guildId/channels',
  ...discordTenantAuth,
  async (req: AuthRequest, res) => {
    const { guildId } = req.params;

    const guildIdValidation = discordIdSchema.validate(guildId);
    if (guildIdValidation.error) {
      res.status(400).json({ error: 'Invalid guild ID format' });
      return;
    }

    if (!(await ensureGuildAccess(req, res, guildId))) {
      return;
    }

    try {
      const discordService = getDiscordService();
      const channels = await discordService.getGuildChannels(guildId);
      res.json({ success: true, data: channels });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch guild channels', { guildId, error: message });
      res.status(500).json({ error: 'Failed to fetch guild channels' });
    }
  }
);

export { router };
