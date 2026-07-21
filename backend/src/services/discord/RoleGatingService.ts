import { GuildMember } from 'discord.js';

import { logger } from '../../utils/logger';

import { DiscordSettingsService } from './DiscordSettingsService';

/**
 * Role gating rule configuration
 */
export interface RoleGateRule {
  /** Action this rule applies to */
  action: 'apply' | 'create_ticket' | 'join_event' | 'create_lfg' | 'giveaway';
  /** Roles required to perform the action (user needs at least one) */
  requiredRoleIds: string[];
  /** Roles restricted from performing the action (user must have none of these) */
  restrictedRoleIds: string[];
  /** Custom denial message */
  denyMessage?: string;
}

/**
 * Role gating settings per guild
 */
export interface RoleGatingSettings {
  enabled: boolean;
  rules: RoleGateRule[];
}

export const DEFAULT_ROLE_GATING: RoleGatingSettings = {
  enabled: false,
  rules: [],
};

/**
 * Result of a gate check
 */
export interface GateCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Role Gating Service
 *
 * Configures required/restricted Discord roles for specific bot actions.
 * Can restrict recruitment applications, ticket creation, event signups,
 * LFG posting, and giveaway entries based on Discord roles.
 */
export class RoleGatingService {
  private static instance: RoleGatingService;
  private readonly settingsService = new DiscordSettingsService();

  static getInstance(): RoleGatingService {
    if (!RoleGatingService.instance) {
      RoleGatingService.instance = new RoleGatingService();
    }
    return RoleGatingService.instance;
  }

  /**
   * Check if a member is allowed to perform an action
   */
  async checkGate(
    guildId: string,
    member: GuildMember,
    action: RoleGateRule['action']
  ): Promise<GateCheckResult> {
    try {
      const settings = await this.settingsService.getSettingsByGuildId(guildId);
      const gating = settings?.[0]?.roleGatingSettings as RoleGatingSettings | undefined;

      if (!gating?.enabled || !gating.rules || gating.rules.length === 0) {
        return { allowed: true };
      }

      const rule = gating.rules.find(r => r.action === action);
      if (!rule) {
        return { allowed: true };
      }

      // Check restricted roles first
      if (rule.restrictedRoleIds.length > 0) {
        const hasRestricted = rule.restrictedRoleIds.some(id => member.roles.cache.has(id));
        if (hasRestricted) {
          return {
            allowed: false,
            reason: rule.denyMessage || 'You have a role that restricts this action.',
          };
        }
      }

      // Check required roles (need at least one)
      if (rule.requiredRoleIds.length > 0) {
        const hasRequired = rule.requiredRoleIds.some(id => member.roles.cache.has(id));
        if (!hasRequired) {
          return {
            allowed: false,
            reason:
              rule.denyMessage ||
              `You need one of the required roles: ${rule.requiredRoleIds.map(id => `<@&${id}>`).join(', ')}`,
          };
        }
      }

      return { allowed: true };
    } catch (error: unknown) {
      logger.warn('Role gate check failed, allowing by default:', error);
      return { allowed: true }; // Fail open to prevent blocking
    }
  }
}

