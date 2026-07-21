/**
 * Discord guest (unlinked-account) participation logic for the event handlers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the guest
 * identity/eligibility logic its own ownership boundary, separate from the Discord
 * interaction handlers. Unlike the earlier pure-function slices, this module legitimately
 * depends on services (`GuildOrganizationService`, `discordSettingsService`), the logger,
 * and domain models — so it owns those collaborators for the guest concern.
 *
 * `eventButtons.ts` imports `DISCORD_GUEST_NAMESPACE`, `GuestContext`,
 * `resolveGuestContext`, and `checkGuestVisibility` back for internal use; they are not
 * re-exported (no external or test consumers). The import graph stays acyclic — none of
 * the collaborators import the bot interaction handlers (one-way: handlers → guest logic).
 */
import type { ButtonInteraction } from 'discord.js';
import { v5 as uuidv5 } from 'uuid';

import { ActivityVisibility } from '../../models/Activity';
import type { AdvancedEventSettings } from '../../models/DiscordGuildSettings';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { logger } from '../../utils/logger';

/**
 * Fixed UUID v5 namespace for generating deterministic participant UUIDs
 * from Discord snowflake IDs. Changing this value would orphan all existing
 * guest participant rows — do NOT modify.
 */
export const DISCORD_GUEST_NAMESPACE = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

/** Activity visibilities that allow guest (unlinked Discord user) participation. */
const GUEST_ALLOWED_VISIBILITIES = new Set<string>([
  ActivityVisibility.PUBLIC,
  ActivityVisibility.LISTED,
]);

/** Visibilities where a guestMemberRoleId can grant guest access. */
const ROLE_GRANTABLE_VISIBILITIES = new Set<string>([
  ActivityVisibility.ORGANIZATION,
  ActivityVisibility.CROSS_ORG,
  ActivityVisibility.ALLIANCE,
]);

/** Result of resolving a Discord guest's identity and settings context. */
export interface GuestContext {
  guestId: string;
  guestMemberRoleIds: string[];
  advancedEventSettings: AdvancedEventSettings;
}

/**
 * Resolve a guest's identity and guild settings in a single pass.
 * Returns `null` when guest joins are not enabled for this guild's org.
 */
export async function resolveGuestContext(
  interaction: ButtonInteraction
): Promise<GuestContext | null> {
  try {
    if (!interaction.guildId) {
      return null;
    }

    const guildOrgService = GuildOrganizationService.getInstance();
    const orgId = await guildOrgService.resolveOrganization(interaction.guildId);
    if (!orgId) {
      return null;
    }

    const settings = await discordSettingsService.getSettings(orgId, interaction.guildId);
    const advanced = settings?.advancedEventSettings;
    if (!advanced?.allowDiscordGuests) {
      return null;
    }

    return {
      guestId: uuidv5(interaction.user.id, DISCORD_GUEST_NAMESPACE),
      guestMemberRoleIds: advanced.guestMemberRoleIds ?? [],
      advancedEventSettings: advanced,
    };
  } catch (err: unknown) {
    logger.warn('Failed to resolve guest context', {
      discordId: interaction.user.id,
      guildId: interaction.guildId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Check whether a guest is allowed to join an activity based on its visibility
 * and the guest's Discord roles.
 *
 * - PUBLIC / LISTED → always allowed
 * - ORGANIZATION / CROSS_ORG / ALLIANCE → allowed if guest holds a guestMemberRoleId
 * - PRIVATE → never allowed for guests (invitation-only requires a linked account)
 */
export function checkGuestVisibility(
  interaction: ButtonInteraction,
  activity: { visibility: string },
  guestMemberRoleIds: string[]
): { allowed: boolean; reason?: string } {
  if (GUEST_ALLOWED_VISIBILITIES.has(activity.visibility)) {
    return { allowed: true };
  }

  if (activity.visibility === (ActivityVisibility.PRIVATE as string)) {
    return {
      allowed: false,
      reason:
        '❌ This is an invitation-only event. Please link your account to receive an invitation.',
    };
  }

  if (!ROLE_GRANTABLE_VISIBILITIES.has(activity.visibility)) {
    return { allowed: false, reason: '❌ This event is restricted. Please link your account.' };
  }

  if (!guestMemberRoleIds.length || !interaction.member) {
    return {
      allowed: false,
      reason:
        '❌ This event is restricted to organization members. Please link your account or ask an admin to assign you the member role.',
    };
  }

  // interaction.member.roles is string[] from the API or GuildMemberRoleManager when cached
  const memberRoles = new Set(
    Array.isArray(interaction.member.roles)
      ? interaction.member.roles
      : [...(interaction.member.roles as { cache: Map<string, unknown> }).cache.keys()]
  );

  if (guestMemberRoleIds.some(roleId => memberRoles.has(roleId))) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      '❌ This event is restricted to organization members. Please link your account or ask an admin to assign you the member role.',
  };
}
