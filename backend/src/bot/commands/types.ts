import {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';

import type { InteractionDeferMode } from '../utils/deferInteraction';

/**
 * Extended bot command interface with cooldown, help metadata,
 * and optional interaction handlers for buttons, modals, and select menus.
 */
export interface BotCommand {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;

  // Optional cooldown in seconds (default: 3 seconds)
  cooldown?: number;

  /**
   * When set, the shared interaction executor defers the slash reply (via
   * {@link InteractionDeferMode}) before {@link execute} runs, keeping slow
   * commands within Discord's ~3s interaction-token window. Only set this for
   * commands whose `execute` always produces a response and never calls
   * `showModal` (a deferred interaction can no longer open a modal).
   */
  defer?: InteractionDeferMode;

  // Detailed help information
  category?: 'utility' | 'events' | 'organization' | 'social' | 'voice' | 'admin' | 'moderation';
  examples?: string[]; // Usage examples
  permissions?: string[]; // Required permissions
  guildOnly?: boolean; // Can only be used in guilds (not DMs)

  /**
   * Handle button interactions.
   * Called when a user clicks a button whose customId starts with this command's prefix.
   * The prefix is derived from the command name (e.g., 'events' → 'event_*', 'lfg' → 'lfg_*').
   */
  handleButton?: (interaction: ButtonInteraction) => Promise<void>;

  /**
   * Handle modal submit interactions.
   * Called when a user submits a modal whose customId starts with this command's prefix.
   */
  handleModal?: (interaction: ModalSubmitInteraction) => Promise<void>;

  /**
   * Handle string select menu interactions.
   * Called when a user selects from a menu whose customId starts with this command's prefix.
   */
  handleSelectMenu?: (interaction: StringSelectMenuInteraction) => Promise<void>;

  /**
   * Handle channel select menu interactions.
   * Called when a user picks a channel from a menu whose customId starts with this
   * command's prefix. Channel select menus provide native search across all channels.
   */
  handleChannelSelectMenu?: (interaction: ChannelSelectMenuInteraction) => Promise<void>;
}
