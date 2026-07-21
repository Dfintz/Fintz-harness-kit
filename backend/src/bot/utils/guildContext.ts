import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { FederationRoleSyncService } from '../../services/federation/FederationRoleSyncService';
import { logger } from '../../utils/logger';

import { safeReply } from './commandErrorHandler';

export interface GuildContext {
  guildId: string;
  organizationId: string;
  /** When resolved via federation fallback, contains the federation ID */
  federationId?: string;
}

type RepliableGuildInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;

/**
 * Resolve the organization for the current guild.
 * Returns null (with ephemeral guidance) if the guild isn't linked.
 * Accepts an optional explicit orgId override for power users managing multiple orgs.
 *
 * Falls back to federation context: if the guild is a federation's central server,
 * uses the federation's founder org as the organization context.
 */
export async function resolveGuildContext(
  interaction: RepliableGuildInteraction,
  explicitOrgId?: string | null
): Promise<GuildContext | null> {
  if (!interaction.guildId) {
    await safeReply(interaction, {
      content: '❌ This command can only be used in a server, not in DMs.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  // If an explicit orgId was provided, use it directly
  if (explicitOrgId) {
    return { guildId: interaction.guildId, organizationId: explicitOrgId };
  }

  // Auto-resolve from guild link
  const guildOrgService = GuildOrganizationService.getInstance();
  const orgId = await guildOrgService.resolveOrganization(interaction.guildId);

  if (orgId) {
    return { guildId: interaction.guildId, organizationId: orgId };
  }

  // Federation fallback: if this is a federation central guild, use the founder org
  const federation = await FederationRoleSyncService.getInstance().findFederationByGuildId(
    interaction.guildId
  );

  if (federation?.founderOrgId) {
    logger.debug(
      `Guild ${interaction.guildId} resolved via federation fallback: federation=${federation.id}, founderOrg=${federation.founderOrgId}`
    );
    return {
      guildId: interaction.guildId,
      organizationId: federation.founderOrgId,
      federationId: federation.id,
    };
  }

  await safeReply(interaction, {
    content:
      '❌ This server is not linked to an organization or federation.\n' +
      '💡 Use `/guild setup` or `/federation setup` to link this server first.',
    flags: MessageFlags.Ephemeral,
  });
  return null;
}

/**
 * Resolve org ID for a guild (non-interactive version for background handlers).
 * Returns the org ID or null without replying to any interaction.
 * Falls back to federation founder org if available.
 */
export async function resolveOrgIdForGuild(guildId: string): Promise<string | null> {
  const guildOrgService = GuildOrganizationService.getInstance();
  const orgId = await guildOrgService.resolveOrganization(guildId);
  if (orgId) {
    return orgId;
  }

  const federation = await FederationRoleSyncService.getInstance().findFederationByGuildId(guildId);
  if (federation?.founderOrgId) {
    logger.debug(
      `Guild ${guildId} resolved via federation fallback (non-interactive): federation=${federation.id}, founderOrg=${federation.founderOrgId}`
    );
    return federation.founderOrgId;
  }

  return null;
}
