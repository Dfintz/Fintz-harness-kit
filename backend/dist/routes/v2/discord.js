"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const discordController_1 = require("../../controllers/v2/discordController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new discordController_1.DiscordControllerV2();
router.use(auth_1.authenticateToken);
router.get('/guilds/:guildId/roles', (req, res, next) => controller.getGuildRoles(req, res).catch(next));
router.get('/guilds/:guildId/roles/:userId', (req, res, next) => controller.getUserRoles(req, res).catch(next));
router.post('/guilds/:guildId/roles/:userId', (req, res, next) => controller.assignRole(req, res).catch(next));
router.delete('/guilds/:guildId/roles/:userId', (req, res, next) => controller.removeRole(req, res).catch(next));
router.get('/guilds/:guildId', (req, res, next) => controller.getGuildInfo(req, res).catch(next));
router.get('/guilds/:guildId/my-membership', (req, res, next) => controller.checkMyMembership(req, res).catch(next));
router.get('/guilds/:guildId/channels', (req, res, next) => controller.getGuildChannels(req, res).catch(next));
router.get('/guilds/:guildId/members', (req, res, next) => controller.getGuildMembers(req, res).catch(next));
//# sourceMappingURL=discord.js.map