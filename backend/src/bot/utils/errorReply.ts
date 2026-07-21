/**
 * Bot error reply helper.
 *
 * Maps `ApiError` subclasses to user-friendly Discord messages so bot users
 * see the same kind of clean errors REST clients see, while preserving
 * full stack traces in server-side logs.
 *
 * Usage:
 *   } catch (error: unknown) {
 *     await replyWithError(interaction, error, { context: 'bounty.create' });
 *   }
 */

import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { MessageFlags } from 'discord.js';
import type { ValidationError as JoiValidationError, ValidationErrorItem } from 'joi';

import {
  ApiError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  isApiError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;

interface ReplyOptions {
  /** Short identifier for log correlation, e.g. `'bounty.create'`. */
  readonly context?: string;
  /** Extra structured fields to attach to the server log. */
  readonly logExtra?: Record<string, unknown>;
}

/**
 * Type guard for Joi validation errors. We test for the `isJoi` brand so we
 * don't have to import Joi's runtime in every call site.
 */
function isJoiError(error: unknown): error is JoiValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { isJoi?: unknown }).isJoi === true &&
    Array.isArray((error as { details?: unknown }).details)
  );
}

function formatJoiDetails(items: ReadonlyArray<ValidationErrorItem>): string {
  // Cap at the first 5 issues to avoid embed bloat.
  return items
    .slice(0, 5)
    .map(item => `• ${item.message}`)
    .join('\n');
}

/**
 * Convert an unknown error into a user-safe Discord message.
 * Returns a short string suitable for `interaction.editReply` content.
 */
export function formatErrorForUser(error: unknown): string {
  if (isJoiError(error)) {
    return `❌ Invalid input:\n${formatJoiDetails(error.details)}`;
  }

  if (isApiError(error)) {
    return formatApiErrorForUser(error);
  }

  // Unexpected error — never leak internals to Discord.
  return '❌ An unexpected error occurred. Please try again or contact an administrator.';
}

function formatApiErrorForUser(error: ApiError): string {
  if (error instanceof ValidationError) {
    return `❌ ${error.message}`;
  }
  if (error instanceof NotFoundError) {
    return `❌ ${error.message || 'Not found.'}`;
  }
  if (error instanceof UnauthorizedError) {
    return '🔒 You need to authenticate before using this command.';
  }
  if (error instanceof ForbiddenError) {
    return "🚫 You don't have permission to perform this action.";
  }
  if (error instanceof ConflictError) {
    return `⚠️ ${error.message}`;
  }
  if (error instanceof RateLimitError) {
    return '⏳ You are doing that too often. Please wait a moment and try again.';
  }
  // Other operational ApiError subclasses — message is curated by the service.
  return `❌ ${error.message}`;
}

/**
 * Reply (or edit reply) with a user-safe error message and log the full error.
 */
export async function replyWithError(
  interaction: RepliableInteraction,
  error: unknown,
  options: ReplyOptions = {}
): Promise<void> {
  const userMessage = formatErrorForUser(error);

  // Server-side: full detail with stack.
  const logFields = {
    context: options.context,
    interactionId: interaction.id,
    userId: interaction.user?.id,
    guildId: interaction.guildId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...options.logExtra,
  };

  if (isApiError(error) || isJoiError(error)) {
    // Operational errors — info level is enough.
    logger.info('Bot command operational error', logFields);
  } else {
    logger.error('Bot command unexpected error', logFields);
  }

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: userMessage });
    } else {
      await interaction.reply({ content: userMessage, flags: MessageFlags.Ephemeral });
    }
  } catch (replyErr) {
    logger.warn('Failed to send error reply to Discord interaction', {
      context: options.context,
      interactionId: interaction.id,
      replyError: replyErr instanceof Error ? replyErr.message : String(replyErr),
    });
  }
}
