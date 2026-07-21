import type { ButtonInteraction } from 'discord.js';

import type { GuestContext } from './eventButtons.guestContext';
import { executeNonDirectAction } from './eventButtons.nonDirectActions';
import { runPostActionEffects } from './eventButtons.postActionEffects';

export interface RunDeferredNonDirectPipelineParams {
  interaction: ButtonInteraction;
  action: string;
  activityId: string;
  userId: string;
  userName: string;
  isDiscordGuest: boolean;
  guestContext: GuestContext | null;
  isEphemeralSource: boolean;
}

export async function runDeferredNonDirectPipeline({
  interaction,
  action,
  activityId,
  userId,
  userName,
  isDiscordGuest,
  guestContext,
  isEphemeralSource,
}: RunDeferredNonDirectPipelineParams): Promise<void> {
  const continuePostActionFlow = await executeNonDirectAction({
    interaction,
    action,
    activityId,
    userId,
    userName,
    isDiscordGuest,
    guestContext,
  });
  if (!continuePostActionFlow) {
    return;
  }

  await runPostActionEffects({
    interaction,
    action,
    activityId,
    userId,
    userName,
    isDiscordGuest,
    isEphemeralSource,
  });
}
