import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { logger } from '../../utils/logger';

type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;

/**
 * Safe reply that works regardless of interaction state.
 * Handles replied, deferred, and fresh interactions.
 */
export async function safeReply(
  interaction: RepliableInteraction,
  options: { content: string; flags?: (typeof MessageFlags)['Ephemeral'] }
): Promise<void> {
  const flags = options.flags ?? MessageFlags.Ephemeral;

  try {
    if (interaction.replied) {
      await interaction.followUp({ content: options.content, flags });
    } else if (interaction.deferred) {
      await interaction.editReply({ content: options.content });
    } else {
      await interaction.reply({ content: options.content, flags });
    }
  } catch {
    // Interaction may have expired (>15 min) — nothing we can do
    logger.warn(`Could not respond to interaction ${interaction.id} — may have expired`);
  }
}

/**
 * Standard error handler for bot commands.
 * Logs the error and sends an ephemeral error message with optional guidance.
 */
export async function handleCommandError(
  interaction: RepliableInteraction,
  error: unknown,
  context: string,
  guidance?: string
): Promise<void> {
  logger.error(`Error in ${context}`, error instanceof Error ? error : new Error(String(error)));

  let content = '❌ Something went wrong. Please try again later.';
  if (guidance) {
    content += `\n💡 ${guidance}`;
  }

  await safeReply(interaction, { content, flags: MessageFlags.Ephemeral });
}
