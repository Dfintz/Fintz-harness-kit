import {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

/**
 * Defer-first primitive (C3 / BOT-02).
 *
 * Discord gives an interaction token only ~3 seconds before it expires; any
 * handler that does slower work (DB queries, RSI/Discord REST calls) must
 * acknowledge the interaction first via a deferral, then `editReply` once the
 * work completes. This shared helper standardizes the deferral that was
 * previously hand-rolled — as `await interaction.deferReply({ flags: … })` plus
 * ad-hoc `if (!deferred && !replied)` guards — across many commands.
 *
 * It is intentionally minimal and reusable: strip the calling context and it
 * acknowledges any interaction once, in the requested style, and reports whether
 * it actually deferred.
 *
 * IMPORTANT: call this only *after* a handler has decided it will produce a
 * response. A handler that may early-return without replying (e.g. an unknown
 * customId) must not defer first, or it would leave a dangling "thinking…".
 */

/** Interactions that can be acknowledged with a deferral. */
export type DeferrableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction;

/**
 * How to acknowledge the interaction:
 * - `reply`      → public "thinking…" placeholder (`deferReply`).
 * - `ephemeral`  → ephemeral "thinking…" placeholder (`deferReply` + ephemeral flag).
 * - `update`     → acknowledge a component interaction without a new message
 *                  (`deferUpdate`); falls back to a public `deferReply` for
 *                  interactions that cannot defer an update (e.g. slash commands).
 */
export type InteractionDeferMode = 'reply' | 'ephemeral' | 'update';

/**
 * Acknowledge an interaction once, in the requested style, so subsequent slow
 * work stays within Discord's token window.
 *
 * Idempotent: if the interaction has already been replied to or deferred this is
 * a no-op and returns `false`. Returns `true` when it performed the deferral.
 * Errors from the Discord client propagate to the caller (the shared interaction
 * executor wraps this in its uniform error handling).
 */
export async function deferInteraction(
  interaction: DeferrableInteraction,
  mode: InteractionDeferMode = 'reply'
): Promise<boolean> {
  if (interaction.replied || interaction.deferred) {
    return false;
  }

  if (
    mode === 'update' &&
    'deferUpdate' in interaction &&
    typeof interaction.deferUpdate === 'function'
  ) {
    await interaction.deferUpdate();
    return true;
  }

  if (mode === 'ephemeral') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true;
  }

  await interaction.deferReply();
  return true;
}
