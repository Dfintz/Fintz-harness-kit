import { ButtonInteraction, MessageFlags } from 'discord.js';

import { getErrorMessage } from '../../utils/errorHandler';
import { parseEventButtonId } from '../embeds/eventEmbed';

import { resolveActionActorContext } from './eventButtons.actorContext';
import { dispatchDirectAction } from './eventButtons.directActions';
import { getUserFriendlyError } from './eventButtons.messages';
import { runDeferredNonDirectPipeline } from './eventButtons.nonDirectPipeline';
import { sanitizeErrorForUser } from './eventButtons.security';

// Embed-data assembly (the Activity → EventEmbedData pipeline) lives in a sibling
// module (E5 decomposition); re-exported so external importers keep their paths.
export { handleBringFleetSelect, handleFleetInviteResponse } from './eventButtons.bringFleet';
export {
  handleBringShipModal,
  handleHangarPageSelect,
  handleHangarShipSelect,
  handleNestShipSelect,
} from './eventButtons.bringShip';
export { handleEditEventModal } from './eventButtons.edit';
export {
  buildEmbedDataFromActivity,
  collectUserIdsForEmbed,
  resolveDiscordIdMap,
} from './eventButtons.embedData';
export {
  buildHangarGroups,
  type HangarGroup,
  type HangarSuggestion,
} from './eventButtons.hangarGroups';
export { handleManageSlotsModal, handleManageSlotsShipSelect } from './eventButtons.manageSlots';
export { handlePassengerSelectMenu } from './eventButtons.passenger';
export {
  handleReqShipModal,
  handleReqShipRoleSelect,
  handleReqShipTypeSelect,
} from './eventButtons.requestShip';
export { handleCrewSelectMenu, handleRemoveShipSelectMenu } from './eventButtons.shipCrew';

/**
 * Handles all event_* button interactions.
 * Called from the events.ts command via handleButton().
 *
 * Flow:
 * 1. Defer the update immediately (extends Discord's 3s window to 15 min)
 * 2. Parse the customId → extract action + activityId
 * 3. Execute the RSVP action via ActivityService
 * 4. Re-fetch the event to get updated participants
 * 5. Edit the original message embed with updated RSVP counts
 *
 * Ship/Crew actions:
 *  - bringship → opens a modal to register a ship
 *  - removeship → opens a select menu of your contributed ships
 *  - joincrew → opens a select menu of ships with open crew slots
 *  - leavecrew → immediately leaves the ship crew
 */

/* ------------------------------------------------------------------ */
/*  Hangar suggestion helpers (Feature: ship suggestions from hangar)  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Main button handler                                                */
/* ------------------------------------------------------------------ */

export async function handleEventButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseEventButtonId(interaction.customId);
  if (!parsed) {
    await interaction.reply({
      content: '❌ Unknown button action.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { action, activityId } = parsed;
  const userName = interaction.user.username;

  // ── Actions that issue their own interaction response ──
  // These handlers resolve the internal user UUID themselves (via resolveInternalUserId)
  // and either open an ephemeral follow-up or the "Ship & Crew" panel, so we do NOT
  // translate the snowflake here. Dispatched via a lookup map to keep this router flat.
  const handledDirectly = await dispatchDirectAction(interaction, action, activityId);
  if (handledDirectly) {
    return;
  }

  const actorContext = await resolveActionActorContext(interaction);
  if (!actorContext) {
    return;
  }
  const { userId, isDiscordGuest, guestContext } = actorContext;

  // ── All other actions: defer update first ──
  // Crew/passenger leave actions can arrive from the ephemeral "Ship & Crew"
  // panel rather than the public event message. The panel is not the event
  // message, so we refresh the public embed by channel lookup (and collapse the
  // panel) instead of editing the interaction's own message.
  const isEphemeralSource = interaction.message?.flags?.has(MessageFlags.Ephemeral) ?? false;
  await interaction.deferUpdate();

  try {
    await runDeferredNonDirectPipeline({
      interaction,
      action,
      activityId,
      userId,
      userName,
      isDiscordGuest,
      guestContext,
      isEphemeralSource,
    });
  } catch (error: unknown) {
    await interaction.followUp({
      content: getUserFriendlyError(sanitizeErrorForUser(getErrorMessage(error))),
      flags: MessageFlags.Ephemeral,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: refresh the event embed from a non-ButtonInteraction       */
/*  (modal or select menu — can't use editReply on the original msg)   */
/* ------------------------------------------------------------------ */
