"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MirrorEnforcementService = void 0;
const discord_js_1 = require("discord.js");
const BotClientManager_1 = require("../../bot/BotClientManager");
const discord_1 = require("../../bot/utils/discord");
const MirrorAction_1 = require("../../models/MirrorAction");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const MirrorActionService_1 = require("./MirrorActionService");
class MirrorEnforcementService {
    static instance = null;
    mirrorActionService;
    constructor() {
        this.mirrorActionService = MirrorActionService_1.MirrorActionService.getInstance();
    }
    static getInstance() {
        MirrorEnforcementService.instance ??= new MirrorEnforcementService();
        return MirrorEnforcementService.instance;
    }
    async executeAction(organizationId, mirrorAction) {
        const { actionType, targetDiscordId, targetGuildId } = mirrorAction;
        if (actionType === MirrorAction_1.MirrorActionType.BAN) {
            logger_1.logger.warn(`Refusing to auto-execute ban for ${targetDiscordId} in guild ${targetGuildId}`);
            return {
                success: false,
                actionType,
                targetDiscordId,
                guildId: targetGuildId,
                errorMessage: 'Ban actions cannot be auto-enforced',
            };
        }
        if (actionType === MirrorAction_1.MirrorActionType.WARNING) {
            await this.mirrorActionService.markAsExecuted(organizationId, mirrorAction.id);
            return {
                success: true,
                actionType,
                targetDiscordId,
                guildId: targetGuildId,
            };
        }
        try {
            const client = BotClientManager_1.BotClientManager.getInstance().getClient();
            const guild = client.guilds.cache.get(targetGuildId);
            if (!guild) {
                const msg = `Guild ${targetGuildId} not found in cache`;
                await this.mirrorActionService.markAsFailed(organizationId, mirrorAction.id, msg);
                return {
                    success: false,
                    actionType,
                    targetDiscordId,
                    guildId: targetGuildId,
                    errorMessage: msg,
                };
            }
            const requiredPerm = actionType === MirrorAction_1.MirrorActionType.KICK
                ? discord_js_1.PermissionFlagsBits.KickMembers
                : discord_js_1.PermissionFlagsBits.ModerateMembers;
            if (!(0, discord_1.checkBotGuildPermissions)(guild, requiredPerm)) {
                const permName = actionType === MirrorAction_1.MirrorActionType.KICK ? 'KickMembers' : 'ModerateMembers';
                const msg = `Bot lacks ${permName} permission in guild ${guild.name}`;
                logger_1.logger.warn(msg);
                await this.mirrorActionService.markAsFailed(organizationId, mirrorAction.id, msg);
                return {
                    success: false,
                    actionType,
                    targetDiscordId,
                    guildId: targetGuildId,
                    errorMessage: msg,
                };
            }
            const member = await guild.members.fetch(targetDiscordId).catch(() => null);
            if (!member) {
                const msg = `Member ${targetDiscordId} not found in guild ${guild.name}`;
                await this.mirrorActionService.markAsFailed(organizationId, mirrorAction.id, msg);
                return {
                    success: false,
                    actionType,
                    targetDiscordId,
                    guildId: targetGuildId,
                    errorMessage: msg,
                };
            }
            const reason = mirrorAction.reason
                ? `[Mirror] ${mirrorAction.reason}`
                : '[Mirror] Auto-enforced from allied organization';
            if (actionType === MirrorAction_1.MirrorActionType.TIMEOUT) {
                const durationMs = (mirrorAction.durationMinutes ?? 60) * 60 * 1000;
                const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000;
                const clampedMs = Math.min(durationMs, maxTimeoutMs);
                await member.timeout(clampedMs, reason);
            }
            else if (actionType === MirrorAction_1.MirrorActionType.KICK) {
                await member.kick(reason);
            }
            await this.mirrorActionService.markAsExecuted(organizationId, mirrorAction.id);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                resource: `mirror_action/${mirrorAction.id}`,
                action: MirrorActionService_1.MirrorAuditAction.MIRROR_EXECUTED,
                message: `Auto-enforced ${actionType} on ${targetDiscordId} in guild ${guild.name}`,
                metadata: {
                    mirrorActionId: mirrorAction.id,
                    actionType,
                    targetDiscordId,
                    targetGuildId,
                    guildName: guild.name,
                    isAutoEnforce: true,
                },
            });
            logger_1.logger.info(`Auto-enforced ${actionType} on ${targetDiscordId} in ${guild.name} (mirror ${mirrorAction.id})`);
            return { success: true, actionType, targetDiscordId, guildId: targetGuildId };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown enforcement error';
            logger_1.logger.error(`Failed to auto-enforce ${actionType} on ${targetDiscordId}: ${errorMessage}`);
            await this.mirrorActionService.markAsFailed(organizationId, mirrorAction.id, errorMessage);
            return {
                success: false,
                actionType,
                targetDiscordId,
                guildId: targetGuildId,
                errorMessage,
            };
        }
    }
}
exports.MirrorEnforcementService = MirrorEnforcementService;
//# sourceMappingURL=MirrorEnforcementService.js.map