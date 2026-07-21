import { ButtonInteraction } from 'discord.js';

import { handleBringFleet } from './eventButtons.bringFleet';
import { handleBringShip } from './eventButtons.bringShip';
import {
  handleCancelEvent,
  handleCancelEventDismiss,
  handleCancelEventPrompt,
} from './eventButtons.cancel';
import { handleCloneEvent } from './eventButtons.clone';
import { handleEditEvent } from './eventButtons.edit';
import { handleManageSlots } from './eventButtons.manageSlots';
import {
  ephemeralLeaveConfirmation,
  handleOpenActionsPanel,
  handleRemindMe,
} from './eventButtons.panelReminder';
import { handleJoinPassenger } from './eventButtons.passenger';
import { handleRequestShip } from './eventButtons.requestShip';
import { handleJoinCrew, handleRemoveShip } from './eventButtons.shipCrew';

type DirectActionHandler = (interaction: ButtonInteraction, activityId: string) => Promise<void>;

const handleCancelEventPromptAction: DirectActionHandler = async (interaction, activityId) => {
  await handleCancelEventPrompt(interaction, activityId);
};

const handleCancelEventAction: DirectActionHandler = async (interaction, activityId) => {
  await handleCancelEvent(interaction, activityId);
};

const handleCancelEventDismissAction: DirectActionHandler = async (interaction, activityId) => {
  await handleCancelEventDismiss(interaction, activityId);
};

const handleOpenActionsPanelAction: DirectActionHandler = async (interaction, activityId) => {
  await handleOpenActionsPanel(interaction, activityId);
};

const handleRemindMeAction: DirectActionHandler = async (interaction, activityId) => {
  await handleRemindMe(interaction, activityId);
};

const directActionHandlers: Record<string, DirectActionHandler> = {
  actions: handleOpenActionsPanelAction,
  bringship: handleBringShip,
  removeship: handleRemoveShip,
  joincrew: handleJoinCrew,
  joinpassenger: handleJoinPassenger,
  requestship: handleRequestShip,
  manageslots: handleManageSlots,
  bringfleet: handleBringFleet,
  remindme: handleRemindMeAction,
  cancel: handleCancelEventPromptAction,
  confirmcancel: handleCancelEventAction,
  canceldismiss: handleCancelEventDismissAction,
  edit: handleEditEvent,
  clone: handleCloneEvent,
};

export async function dispatchDirectAction(
  interaction: ButtonInteraction,
  action: string,
  activityId: string
): Promise<boolean> {
  const directHandler = directActionHandlers[action];
  if (!directHandler) {
    return false;
  }

  await directHandler(interaction, activityId);
  return true;
}

export function getEphemeralLeaveConfirmation(action: string): string {
  return ephemeralLeaveConfirmation(action);
}
