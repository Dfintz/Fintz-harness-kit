/**
 * Pre-join validation for the event interaction handlers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the
 * consolidated pre-join checks their own ownership boundary, separate from the Discord
 * interaction handlers.
 *
 * `preJoinChecks` runs the gate every join passes through — guest visibility,
 * orphaned-guest-row cleanup after account linking, and the advanced event settings
 * (`checkAdvancedEventSettings`: signup deadline, lock-when-full, prevent-duplicate). The
 * settings check fails open (allows the join) on any error, so a transient settings
 * lookup failure never blocks participation. `eventButtons.ts` imports `preJoinChecks`
 * back for internal use; `checkAdvancedEventSettings` stays private to this module.
 *
 * The module depends only on data/service collaborators and the guest-context sibling —
 * it never imports `eventButtons.ts`, keeping the import graph acyclic (one-way:
 * handlers → pre-join checks).
 */
import type { ButtonInteraction } from 'discord.js';
import { v5 as uuidv5 } from 'uuid';

import type { AdvancedEventSettings } from '../../models/DiscordGuildSettings';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

import {
  checkGuestVisibility,
  DISCORD_GUEST_NAMESPACE,
  type GuestContext,
} from './eventButtons.guestContext';
import { getActivityService, getParticipantService } from './eventButtons.services';

/**
 * Consolidated pre-join validation: guest visibility, orphan cleanup,
 * and advanced event settings. Loads activity and settings once.
 */
export async function preJoinChecks(
  interaction: ButtonInteraction,
  activityId: string,
  userId: string,
  isDiscordGuest: boolean,
  guestContext: GuestContext | null
): Promise<{ allowed: boolean; reason?: string }> {
  // Guest visibility check
  if (isDiscordGuest) {
    const activity = await getActivityService().getActivityById(activityId);
    if (activity) {
      const visCheck = checkGuestVisibility(
        interaction,
        activity,
        guestContext?.guestMemberRoleIds ?? []
      );
      if (!visCheck.allowed) {
        return visCheck;
      }
    }
  }

  // Linked-user dedup: clean up orphaned guest row from before account linking
  if (!isDiscordGuest) {
    const guestUuid = uuidv5(interaction.user.id, DISCORD_GUEST_NAMESPACE);
    if (guestUuid !== userId) {
      await getParticipantService().removeParticipantFromTable(activityId, guestUuid);
    }
  }

  // Advanced event settings (lockWhenFull, signupDeadline, preventDuplicate)
  // Pass pre-loaded settings when available to avoid a redundant DB query
  return checkAdvancedEventSettings(
    interaction,
    activityId,
    userId,
    guestContext?.advancedEventSettings
  );
}

async function checkAdvancedEventSettings(
  interaction: ButtonInteraction,
  activityId: string,
  userId: string,
  preloadedSettings?: AdvancedEventSettings
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    let advanced = preloadedSettings;
    if (!advanced) {
      if (!interaction.guildId) {
        return { allowed: true };
      }
      const guildOrgService = GuildOrganizationService.getInstance();
      const orgId = await guildOrgService.resolveOrganization(interaction.guildId);
      if (!orgId) {
        return { allowed: true };
      }
      const settings = await discordSettingsService.getSettings(orgId, interaction.guildId);
      advanced = settings?.advancedEventSettings ?? undefined;
    }
    if (!advanced) {
      return { allowed: true };
    }

    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      return { allowed: true };
    }

    // Check signup deadline
    if (advanced.signupDeadlineHours && activity.scheduledStartDate) {
      const deadline = new Date(activity.scheduledStartDate);
      deadline.setHours(deadline.getHours() - advanced.signupDeadlineHours);
      if (new Date() > deadline) {
        return {
          allowed: false,
          reason: `⏰ Signups for this event closed ${advanced.signupDeadlineHours} hour(s) before the start time.`,
        };
      }
    }

    // Check lockWhenFull
    if (advanced.lockWhenFull && activity.maxParticipants) {
      const participants = await getParticipantService().getParticipants(activityId);
      const accepted = participants.filter(p => p.status === 'accepted').length;
      if (accepted >= activity.maxParticipants) {
        const alreadyIn = participants.some(p => p.userId === userId && p.status === 'accepted');
        if (!alreadyIn) {
          return {
            allowed: false,
            reason:
              '🔒 This event is full and locked. Try joining the waitlist with `/events waitlist`.',
          };
        }
      }
    }

    // Check preventDuplicateRsvp (prevents user from being in multiple active events)
    if (advanced.preventDuplicateRsvp) {
      // No-op: blocking cross-event duplicate RSVPs requires a dedicated
      // service method to scan other activities for the user. Allowing
      // re-RSVP to the SAME event is the safe default.
    }

    return { allowed: true };
  } catch (err) {
    logger.warn('Failed to check advanced event settings', { error: getErrorMessage(err) });
    return { allowed: true }; // Fail open
  }
}
