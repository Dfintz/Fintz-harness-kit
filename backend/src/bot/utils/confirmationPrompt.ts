import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  type InteractionReplyOptions,
} from 'discord.js';

/**
 * Shared confirmation primitive (C2 / CMD-01).
 *
 * Destructive bot actions (cancel, delete, close, disband, …) should confirm by
 * default. This module is the single source of truth for that two-step flow so
 * every domain presents the same "are you sure?" taxonomy instead of bespoke,
 * inconsistent prompts.
 *
 * Usage pattern:
 *  1. The first (destructive) button shows the prompt via {@link buildConfirmationPrompt},
 *     supplying confirm/cancel customIds that keep the domain's routing prefix so the
 *     follow-up clicks dispatch back to the same command handler.
 *  2. The confirm customId runs the real action; the cancel customId calls
 *     {@link respondConfirmationCancelled}.
 *
 * customIds are caller-supplied (not generated here) because each domain owns its
 * own customId → handler routing (see `interactionRouter` prefix map). Keeping the
 * domain prefix as the first segment (e.g. `event_confirmcancel_<id>`) is what makes
 * the follow-up interaction route correctly.
 */

/** Default confirm (destructive) button label. */
const DEFAULT_CONFIRM_LABEL = 'Confirm';
/** Default cancel (dismiss) button label. */
const DEFAULT_CANCEL_LABEL = 'Cancel';
/** Default confirm button emoji. */
const DEFAULT_CONFIRM_EMOJI = '✅';
/** Default cancel button emoji. */
const DEFAULT_CANCEL_EMOJI = '❌';

/** Uniform copy shown after a user dismisses a confirmation. */
export const CONFIRMATION_CANCELLED_MESSAGE = '❎ Cancelled — no changes were made.';

/** Options describing a single confirmation prompt. */
export interface ConfirmationPromptOptions {
  /**
   * customId for the confirm (destructive) button. Must keep the domain's routing
   * prefix (e.g. `event_confirmcancel_<id>`) so the follow-up click routes back to
   * the owning command handler.
   */
  confirmCustomId: string;
  /**
   * customId for the cancel (dismiss) button. Must keep the domain's routing prefix
   * (e.g. `event_canceldismiss_<id>`).
   */
  cancelCustomId: string;
  /**
   * Short verb phrase describing what will happen, rendered into the uniform
   * question — e.g. `'cancel this event'` → "Are you sure you want to cancel this
   * event?". Ignored when {@link content} is supplied.
   */
  message: string;
  /** Confirm button label. Defaults to `'Confirm'`. */
  confirmLabel?: string;
  /** Cancel button label. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Confirm button emoji. Defaults to `'✅'`. */
  confirmEmoji?: string;
  /** Cancel button emoji. Defaults to `'❌'`. */
  cancelEmoji?: string;
  /** Full prompt content override. When set, {@link message} is not used. */
  content?: string;
}

/**
 * Compose the uniform confirmation question from a short verb phrase.
 * Centralized so the wording is identical across every destructive action.
 */
export function confirmationQuestion(message: string): string {
  return `⚠️ Are you sure you want to ${message}? **This can't be undone.**`;
}

/**
 * Build an ephemeral confirmation prompt (uniform copy + Confirm/Cancel buttons).
 *
 * Returns an {@link InteractionReplyOptions} payload the caller passes to
 * `interaction.reply(...)`. The confirm button uses {@link ButtonStyle.Danger}; the
 * cancel button uses {@link ButtonStyle.Secondary}.
 */
export function buildConfirmationPrompt(
  options: ConfirmationPromptOptions
): InteractionReplyOptions {
  const {
    confirmCustomId,
    cancelCustomId,
    message,
    confirmLabel = DEFAULT_CONFIRM_LABEL,
    cancelLabel = DEFAULT_CANCEL_LABEL,
    confirmEmoji = DEFAULT_CONFIRM_EMOJI,
    cancelEmoji = DEFAULT_CANCEL_EMOJI,
    content,
  } = options;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmCustomId)
      .setLabel(confirmLabel)
      .setStyle(ButtonStyle.Danger)
      .setEmoji(confirmEmoji),
    new ButtonBuilder()
      .setCustomId(cancelCustomId)
      .setLabel(cancelLabel)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(cancelEmoji)
  );

  return {
    content: content ?? confirmationQuestion(message),
    components: [row],
    flags: MessageFlags.Ephemeral,
  };
}

/**
 * Respond to a dismissed confirmation with uniform copy. Best-effort — chooses
 * reply vs followUp based on whether the interaction was already answered, and a
 * failed response never throws.
 */
export async function respondConfirmationCancelled(
  interaction: ButtonInteraction,
  message: string = CONFIRMATION_CANCELLED_MESSAGE
): Promise<void> {
  const payload = { content: message, flags: MessageFlags.Ephemeral } as const;
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}
