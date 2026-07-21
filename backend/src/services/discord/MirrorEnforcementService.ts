import { PermissionFlagsBits } from 'discord.js';

import { BotClientManager } from '../../bot/BotClientManager';
import { checkBotGuildPermissions } from '../../bot/utils/discord';
import { MirrorAction, MirrorActionType } from '../../models/MirrorAction';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

import { MirrorActionService, MirrorAuditAction } from './MirrorActionService';

/**
 * Result of a Discord enforcement action
 */
export interface EnforcementResult {
  success: boolean;
  actionType: MirrorActionType;
  targetDiscordId: string;
  guildId: string;
  errorMessage?: string;
}

/**
 * MirrorEnforcementService
 *
 * Executes moderation actions on Discord (timeout / kick) for mirrored incidents.
 * Bans are NEVER executed automatically — they always require manual confirmation.
 *
 * This service is called by the sharing flow when auto-enforce is enabled.
 */
export class MirrorEnforcementService {
  private static instance: MirrorEnforcementService | null = null;
  private readonly mirrorActionService: MirrorActionService;

  private constructor() {
    this.mirrorActionService = MirrorActionService.getInstance();
  }

  public static getInstance(): MirrorEnforcementService {
    MirrorEnforcementService.instance ??= new MirrorEnforcementService();
    return MirrorEnforcementService.instance;
  }

  /**
   * Execute a mirror action on Discord.
   * Only timeout and kick are supported for auto-enforcement.
   * Bans always return failure with a message.
   */
  async executeAction(
    organizationId: string,
    mirrorAction: MirrorAction
  ): Promise<EnforcementResult> {
    const { actionType, targetDiscordId, targetGuildId } = mirrorAction;

    // Safety: never auto-execute bans
    if (actionType === MirrorActionType.BAN) {
      logger.warn(`Refusing to auto-execute ban for ${targetDiscordId} in guild ${targetGuildId}`);
      return {
        success: false,
        actionType,
        targetDiscordId,
        guildId: targetGuildId,
        errorMessage: 'Ban actions cannot be auto-enforced',
      };
    }

    // Warnings don't need Discord enforcement
    if (actionType === MirrorActionType.WARNING) {
      await this.mirrorActionService.markAsExecuted(organizationId, mirrorAction.id);
      return {
        success: true,
        actionType,
        targetDiscordId,
        guildId: targetGuildId,
      };
    }

    try {
      const client = BotClientManager.getInstance().getClient();
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

      // Permission check
      const requiredPerm =
        actionType === MirrorActionType.KICK
          ? PermissionFlagsBits.KickMembers
          : PermissionFlagsBits.ModerateMembers; // timeout uses ModerateMembers

      if (!checkBotGuildPermissions(guild, requiredPerm)) {
        const permName = actionType === MirrorActionType.KICK ? 'KickMembers' : 'ModerateMembers';
        const msg = `Bot lacks ${permName} permission in guild ${guild.name}`;
        logger.warn(msg);
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

      if (actionType === MirrorActionType.TIMEOUT) {
        const durationMs = (mirrorAction.durationMinutes ?? 60) * 60 * 1000;
        // Discord max timeout is 28 days
        const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000;
        const clampedMs = Math.min(durationMs, maxTimeoutMs);
        await member.timeout(clampedMs, reason);
      } else if (actionType === MirrorActionType.KICK) {
        await member.kick(reason);
      }

      await this.mirrorActionService.markAsExecuted(organizationId, mirrorAction.id);

      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        resource: `mirror_action/${mirrorAction.id}`,
        action: MirrorAuditAction.MIRROR_EXECUTED,
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

      logger.info(
        `Auto-enforced ${actionType} on ${targetDiscordId} in ${guild.name} (mirror ${mirrorAction.id})`
      );

      return { success: true, actionType, targetDiscordId, guildId: targetGuildId };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown enforcement error';
      logger.error(`Failed to auto-enforce ${actionType} on ${targetDiscordId}: ${errorMessage}`);
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

