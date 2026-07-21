import {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { trackEvent, trackMetric } from '../../config/applicationInsights';
import {
  buildRateLimitKey,
  rateLimitRetryAfterSeconds,
} from '../../services/shared/rateLimitPolicy';
import { RedisRateLimiter } from '../../services/shared/RedisRateLimiter';
import { logger } from '../../utils/logger';

import type { CommandAnalytics } from './commandAnalytics';
import type { CooldownManager } from './cooldownManager';
import { deferInteraction, type InteractionDeferMode } from './deferInteraction';
import { classifyInteractionError, type InteractionErrorClass } from './interactionErrorTaxonomy';

/**
 * Shared interaction execution wrapper (C1).
 *
 * Every interaction kind — slash command, button, modal submit, and select menu —
 * runs through {@link executeInteraction}, which owns the common lifecycle:
 * cooldown gating (with a uniform denial), handler invocation inside a guarded
 * try/catch, a single uniform error response, and analytics + latency telemetry.
 *
 * Resolution of the concrete handler (slash command lookup vs customId prefix
 * routing) stays with each call site; only the execution policy lives here so the
 * bot enforces one consistent taxonomy and "speaks with one voice".
 */

/** Interaction kinds the executor recognizes for telemetry and copy. */
export type InteractionKind = 'slash' | 'button' | 'modal' | 'select';

/** Interactions the executor can respond to — all share the members used here. */
type ExecutableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction;

/**
 * Uniform cooldown denial copy. Centralized so the wait message is identical
 * across every interaction kind (C1 taxonomy).
 */
export function interactionCooldownMessage(remainingSeconds: number): string {
  return `⏱️ Please wait ${remainingSeconds.toFixed(1)}s before trying that again.`;
}

/**
 * Whether to gate interaction cooldowns through the distributed limiter
 * (`RedisRateLimiter`) instead of the per-process in-memory `CooldownManager`.
 *
 * Read per-call (cheap env lookup) so it can be flipped without a redeploy and
 * toggled in tests. Default **off** — the in-memory path is preserved exactly,
 * so enabling this is an observe-then-flip decision (the in-memory manager drifts
 * across shards; the distributed limiter makes a user's cooldown consistent
 * cluster-wide). C6 / ARCH-06 follow-on.
 */
function isDistributedCooldownEnabled(): boolean {
  return process.env.BOT_DISTRIBUTED_COOLDOWN === 'true';
}

/** Redis key prefix for distributed interaction cooldowns. */
const COOLDOWN_RATE_LIMIT_DOMAIN = 'cooldown';

/**
 * Apply the interaction cooldown gate and consume the user's slot for this
 * command bucket. Returns the remaining wait in seconds (`> 0` ⇒ denied, the
 * caller must reject; `0` ⇒ allowed and the slot is now consumed).
 *
 * A command cooldown is "1 use per `cooldownSeconds`", which maps exactly to the
 * distributed limiter's `check(key, 1, cooldownSeconds)` (atomic INCR + first-write
 * `EXPIRE NX`, so the window is fixed from first use and never extends on retries).
 * The distributed path therefore checks-and-consumes in one round-trip — there is
 * no separate "set" step. The in-memory path preserves the original read-then-set
 * behaviour. The limiter fails open and falls back to an in-memory store when Redis
 * is unavailable, so enabling distributed cooldowns cannot hard-fail interactions.
 */
export async function consumeInteractionCooldown(
  cooldownKey: string,
  userId: string,
  cooldownSeconds: number,
  cooldownManager: CooldownManager
): Promise<number> {
  if (isDistributedCooldownEnabled()) {
    const key = buildRateLimitKey(COOLDOWN_RATE_LIMIT_DOMAIN, cooldownKey, userId);
    const result = await RedisRateLimiter.getInstance().check(key, 1, cooldownSeconds);
    return result.allowed ? 0 : rateLimitRetryAfterSeconds(result);
  }

  const remaining = cooldownManager.checkCooldown(cooldownKey, userId, cooldownSeconds);
  if (remaining > 0) {
    return remaining;
  }
  cooldownManager.setCooldown(cooldownKey, userId);
  return 0;
}

/**
 * Uniform handler-failure copy per kind. User-facing messages never include
 * internal error detail (avoids leaking internals); the full error is logged.
 *
 * Used for genuine/unclassified failures. Transient degradation (IPC timeout,
 * downstream dependency outage) and rate limits get their own copy below so
 * users see that the platform is busy rather than a confusing hard error
 * (ARCH-05: IPC degradation visible to users).
 */
const INTERACTION_ERROR_MESSAGE: Record<InteractionKind, string> = {
  slash: '❌ Something went wrong running that command.',
  button: '❌ Something went wrong processing that action.',
  modal: '❌ Something went wrong processing that form.',
  select: '❌ Something went wrong processing that selection.',
};

/**
 * Graceful copy for transient degradation (IPC timeout / downstream dependency
 * outage). The action wasn't wrong — the platform is momentarily busy — so we
 * tell the user to retry rather than implying their action failed.
 */
const INTERACTION_DEGRADED_MESSAGE =
  '⏳ The service is a bit busy right now — please try that again in a moment.';

/**
 * Copy for a downstream rate limit (distinct from the per-interaction cooldown:
 * this means an upstream/Discord limit was hit, not the user's own cooldown).
 */
const INTERACTION_RATE_LIMITED_MESSAGE =
  '⏱️ That action is being rate-limited right now — please wait a moment and try again.';

/**
 * Choose the user-facing failure copy for a classified error. Transient classes
 * (`timeout`, `dependency`) surface the degradation message and `rate_limit`
 * surfaces the rate-limit message; everything else (including unclassified
 * `internal` failures and user-correctable classes that reached the executor)
 * keeps the uniform per-kind copy. Never includes internal error detail.
 */
export function interactionErrorMessage(
  kind: InteractionKind,
  errorClass: InteractionErrorClass
): string {
  if (errorClass === 'timeout' || errorClass === 'dependency') {
    return INTERACTION_DEGRADED_MESSAGE;
  }
  if (errorClass === 'rate_limit') {
    return INTERACTION_RATE_LIMITED_MESSAGE;
  }
  return INTERACTION_ERROR_MESSAGE[kind];
}

/**
 * Emit per-interaction latency telemetry to App Insights.
 * Safe no-op when App Insights is not configured.
 *
 * On failure, the {@link InteractionErrorClass} is attached so command-failure
 * percentiles can be broken down by cause (user-correctable vs system failure).
 */
export function trackInteractionLatency(
  kind: InteractionKind,
  commandName: string,
  durationMs: number,
  success: boolean,
  guildId?: string,
  errorClass?: InteractionErrorClass
): void {
  trackMetric(`bot_${kind}_latency_ms`, durationMs);
  trackEvent('BotCommandExecuted', {
    kind,
    commandName,
    success: String(success),
    durationMs: String(durationMs),
    guildId: guildId ?? 'DM',
    ...(errorClass ? { errorClass } : {}),
  });
}

/**
 * Count interaction failures by taxonomy class so triage can break failures
 * down by cause (and alerting can suppress user-correctable spikes). Safe no-op
 * when App Insights is not configured.
 */
function trackInteractionFailure(
  kind: InteractionKind,
  commandName: string,
  errorClass: InteractionErrorClass,
  guildId?: string
): void {
  trackMetric(`bot_interaction_failed_${errorClass}`, 1);
  trackEvent('BotInteractionFailed', {
    kind,
    commandName,
    errorClass,
    guildId: guildId ?? 'DM',
  });
}

/**
 * Count cooldown-rejected interactions so rate-limit pressure is observable.
 * Safe no-op when App Insights is not configured.
 */
function trackCooldownRejection(
  kind: InteractionKind,
  commandName: string,
  guildId?: string
): void {
  trackMetric(`bot_${kind}_cooldown_rejected`, 1);
  trackEvent('BotInteractionCooldownRejected', {
    kind,
    commandName,
    guildId: guildId ?? 'DM',
  });
}

/**
 * Send an ephemeral response, choosing reply vs followUp based on whether the
 * interaction has already been answered. Best-effort — a failed response never
 * masks the original outcome.
 */
async function respondEphemeral(
  interaction: ExecutableInteraction,
  content: string
): Promise<void> {
  const payload = { content, flags: MessageFlags.Ephemeral } as const;
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

/** Options describing a single interaction execution. */
export interface ExecuteInteractionOptions {
  /** The Discord interaction being handled. */
  interaction: ExecutableInteraction;
  /** Interaction kind, used for uniform copy and telemetry. */
  kind: InteractionKind;
  /**
   * Label used for analytics, latency, and cooldown-rejection telemetry
   * (e.g. a slash command name, `btn:event`, `modal:poll`, `select:guild`).
   */
  analyticsLabel: string;
  /** Cooldown bucket key within the CooldownManager namespace. */
  cooldownKey: string;
  /** Cooldown window in seconds. */
  cooldownSeconds: number;
  /** Shared cooldown manager. */
  cooldownManager: CooldownManager;
  /** Optional analytics sink. */
  commandAnalytics?: CommandAnalytics;
  /**
   * When set, the executor acknowledges the interaction with a deferral (via the
   * shared {@link deferInteraction} primitive) immediately after the cooldown
   * gate passes and before {@link run} executes — keeping slow handlers within
   * Discord's ~3s interaction-token window. Only set this for handlers that
   * always produce a response and never call `showModal` (a deferred interaction
   * can no longer show a modal, and an unanswered deferral leaves a dangling
   * "thinking…").
   */
  defer?: InteractionDeferMode;
  /** Invokes the resolved handler. Throwing routes to the uniform error response. */
  run: () => Promise<void>;
}

/**
 * Run an interaction handler through the shared cooldown → execute → telemetry
 * lifecycle. Returns once the interaction has been fully handled (including a
 * cooldown denial or an error response).
 */
export async function executeInteraction(options: ExecuteInteractionOptions): Promise<void> {
  const {
    interaction,
    kind,
    analyticsLabel,
    cooldownKey,
    cooldownSeconds,
    cooldownManager,
    commandAnalytics,
    defer,
    run,
  } = options;

  const userId = interaction.user.id;
  const guildId = interaction.guildId ?? undefined;

  const remaining = await consumeInteractionCooldown(
    cooldownKey,
    userId,
    cooldownSeconds,
    cooldownManager
  );
  if (remaining > 0) {
    trackCooldownRejection(kind, analyticsLabel, guildId);
    await respondEphemeral(interaction, interactionCooldownMessage(remaining));
    return;
  }

  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let errorClass: InteractionErrorClass | undefined;

  try {
    // Defer-first (C3): acknowledge before slow work so the interaction token
    // does not expire. Idempotent — a handler that already deferred is unaffected.
    if (defer) {
      await deferInteraction(interaction, defer);
    }
    await run();
  } catch (error: unknown) {
    success = false;
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    errorMessage = normalizedError.message;
    errorClass = classifyInteractionError(normalizedError);
    logger.error(
      `Interaction handler failed (kind=${kind}, label=${analyticsLabel}, class=${errorClass}, guild=${guildId ?? 'DM'}, user=${userId}): ${errorMessage}`,
      normalizedError
    );
    await respondEphemeral(interaction, interactionErrorMessage(kind, errorClass));
  } finally {
    const executionTime = Date.now() - startTime;
    commandAnalytics?.logCommandUsage({
      commandName: analyticsLabel,
      userId,
      userName: interaction.user.username,
      guildId: interaction.guildId ?? 'DM',
      guildName: interaction.guild?.name ?? 'Direct Message',
      success,
      executionTime,
      error: errorMessage,
      timestamp: new Date(),
    });
    trackInteractionLatency(kind, analyticsLabel, executionTime, success, guildId, errorClass);
    if (errorClass) {
      trackInteractionFailure(kind, analyticsLabel, errorClass, guildId);
    }
  }
}
