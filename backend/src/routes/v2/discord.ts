import { Router } from 'express';

import { DiscordControllerV2 } from '../../controllers/v2/discordController';
import { authenticateToken } from '../../middleware/auth';

const router = Router();
const controller = new DiscordControllerV2();

// Apply authentication to all Discord routes
router.use(authenticateToken);

/**
 * GET /api/v2/discord/guilds/:guildId/roles
 * Get all roles in a Discord guild (must be before :userId routes)
 */
router.get('/guilds/:guildId/roles', (req, res, next) =>
  controller.getGuildRoles(req, res).catch(next)
);

/**
 * GET /api/v2/discord/guilds/:guildId/roles/:userId
 * Get user roles in a Discord guild
 */
router.get('/guilds/:guildId/roles/:userId', (req, res, next) =>
  controller.getUserRoles(req, res).catch(next)
);

/**
 * POST /api/v2/discord/guilds/:guildId/roles/:userId
 * Assign a role to a user in a Discord guild
 */
router.post('/guilds/:guildId/roles/:userId', (req, res, next) =>
  controller.assignRole(req, res).catch(next)
);

/**
 * DELETE /api/v2/discord/guilds/:guildId/roles/:userId
 * Remove a role from a user in a Discord guild
 */
router.delete('/guilds/:guildId/roles/:userId', (req, res, next) =>
  controller.removeRole(req, res).catch(next)
);

/**
 * GET /api/v2/discord/guilds/:guildId
 * Get Discord guild information
 */
router.get('/guilds/:guildId', (req, res, next) => controller.getGuildInfo(req, res).catch(next));

/**
 * GET /api/v2/discord/guilds/:guildId/my-membership
 * Check if the current authenticated user is a member of this Discord guild
 */
router.get('/guilds/:guildId/my-membership', (req, res, next) =>
  controller.checkMyMembership(req, res).catch(next)
);

/**
 * GET /api/v2/discord/guilds/:guildId/channels
 * Get all channels in a Discord guild
 */
router.get('/guilds/:guildId/channels', (req, res, next) =>
  controller.getGuildChannels(req, res).catch(next)
);

/**
 * GET /api/v2/discord/guilds/:guildId/members
 * Get members of a Discord guild
 */
router.get('/guilds/:guildId/members', (req, res, next) =>
  controller.getGuildMembers(req, res).catch(next)
);

export { router };
