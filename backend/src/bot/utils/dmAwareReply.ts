/**
 * DM-aware reply utility for bot commands.
 *
 * Checks the user's `botResponseViaDm` preference and either:
 *  - Sends a standard ephemeral reply in-channel (default), or
 *  - Sends the content via DM and posts a minimal ephemeral confirmation
 *    in the channel so the user knows to check their DMs.
 *
 * Usage:
 *   import { dmAwareReply, dmAwareEditReply } from '../utils/dmAwareReply';
 *   await dmAwareReply(interaction, { embeds: [embed], content: 'Done!' });
 *
 * Graceful fallback: if DMing fails (e.g. user has DMs disabled for the
 * server), falls back to an ephemeral in-channel reply automatically.
 */
import {
  type BaseMessageOptions,
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { DiscordUserPreferenceService } from '../../services/discord/DiscordUserPreferenceService';
import { logger } from '../../utils/logger';

type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;

/**
 * Reply to an interaction, routing via DM if the user has opted in.
 *
 * Must be called BEFORE `interaction.reply()` / `interaction.deferReply()`.
 * If the interaction is already replied/deferred, use `dmAwareEditReply` instead.
 */
export async function dmAwareReply(
  interaction: RepliableInteraction,
  payload: BaseMessageOptions & { content?: string }
): Promise<void> {
  const preferDm = await shouldUseDm(interaction);

  if (preferDm) {
    const sent = await trySendDm(interaction, payload);
    if (sent) {
      // Minimal ephemeral ack in-channel
      await interaction.reply({
        content: '📬 Response sent to your DMs.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // DM failed — fall through to ephemeral
  }

  await interaction.reply({
    ...payload,
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Edit-reply variant for interactions that have already been deferred.
 *
 * Must be called AFTER `interaction.deferReply()`.
 */
export async function dmAwareEditReply(
  interaction: RepliableInteraction,
  payload: BaseMessageOptions & { content?: string }
): Promise<void> {
  const preferDm = await shouldUseDm(interaction);

  if (preferDm) {
    const sent = await trySendDm(interaction, payload);
    if (sent) {
      await interaction.editReply({ content: '📬 Response sent to your DMs.' });
      return;
    }
    // DM failed — fall through to normal editReply
  }

  await interaction.editReply(payload);
}

// ─── Internals ───────────────────────────────────────────────

async function shouldUseDm(interaction: RepliableInteraction): Promise<boolean> {
  // DM preference only applies in guild contexts — DMs in DM channels are already DMs
  if (!interaction.guildId) {
    return false;
  }

  try {
    const prefService = DiscordUserPreferenceService.getInstance();
    const pref = await prefService.get(interaction.user.id, interaction.guildId);
    return pref?.botResponseViaDm ?? false;
  } catch (error: unknown) {
    logger.warn(
      `Failed to check botResponseViaDm for user ${interaction.user.id}`,
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'Unknown error')
    );
    return false;
  }
}

async function trySendDm(
  interaction: RepliableInteraction,
  payload: BaseMessageOptions & { content?: string }
): Promise<boolean> {
  try {
    const dmChannel = await interaction.user.createDM();
    await dmChannel.send(payload);
    return true;
  } catch (error: unknown) {
    logger.warn(
      `Cannot DM user ${interaction.user.id} — falling back to ephemeral`,
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'Unknown error')
    );
    return false;
  }
}
