import { ButtonInteraction, MessageFlags } from 'discord.js';

import type { GuestContext } from './eventButtons.guestContext';
import { preJoinChecks } from './eventButtons.preJoinChecks';
import { handleRSVPAction, RSVP_ACTIONS } from './eventButtons.rsvp';
import { getActivityService } from './eventButtons.services';

export interface ExecuteNonDirectActionParams {
  interaction: ButtonInteraction;
  action: string;
  activityId: string;
  userId: string;
  userName: string;
  isDiscordGuest: boolean;
  guestContext: GuestContext | null;
}

export async function executeNonDirectAction({
  interaction,
  action,
  activityId,
  userId,
  userName,
  isDiscordGuest,
  guestContext,
}: ExecuteNonDirectActionParams): Promise<boolean> {
  if (action === 'join' || action === 'tentative') {
    const joinCheck = await preJoinChecks(
      interaction,
      activityId,
      userId,
      isDiscordGuest,
      guestContext
    );
    if (!joinCheck.allowed) {
      await interaction.followUp({
        content: joinCheck.reason ?? '❌ Unable to join this event right now.',
        flags: MessageFlags.Ephemeral,
      });
      return false;
    }
  }

  if (action in RSVP_ACTIONS) {
    const guestMeta = isDiscordGuest
      ? { discordGuest: true, discordId: interaction.user.id }
      : undefined;
    await handleRSVPAction(activityId, userId, userName, action, guestMeta);
    return true;
  }

  if (action === 'leave') {
    await getActivityService().leaveActivity(activityId, userId);
    return true;
  }

  if (action === 'leavecrew') {
    await getActivityService().leaveShipCrew(activityId, userId);
    return true;
  }

  if (action === 'leavepassenger') {
    await getActivityService().leaveShipAsPassenger(activityId, userId);
    return true;
  }

  return true;
}
