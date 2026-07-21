import {
  ButtonInteraction,
  LabelBuilder,
  type Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { redisRateLimiter } from '../../services/shared/RedisRateLimiter';
import { SocialGroupService } from '../../services/social';
import { ReputationService } from '../../services/social/ReputationService';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import {
  emitLfgMemberJoined,
  emitLfgMemberLeft,
  emitLfgSessionCancelled,
} from '../../websocket/controllers/lfgWebSocketController';
import { JOIN_LIMIT_PER_HOUR, lfgJoinRateLimitKey } from '../commands/lfg';
import {
  buildLfgButtons,
  buildLfgEmbed,
  buildLfgRatingDetailButton,
  buildLfgRatingStarButtons,
  buildTeamSuggestionButtons,
  buildTeamSuggestionEmbed,
  parseLfgButtonId,
  parseLfgRatingId,
  STAR_LABELS,
  THUMB_LABELS,
} from '../embeds/lfgEmbed';
import { buildConfirmationPrompt, respondConfirmationCancelled } from '../utils/confirmationPrompt';
import { buildCustomId, parseCustomId } from '../utils/customId';

let _lfgService: SocialGroupService | null = null;

function getLfgService(): SocialGroupService {
  _lfgService ??= SocialGroupService.getInstance();
  return _lfgService;
}

function buildLfgCommentModalCustomId(sessionId: string, targetUserId: string): string {
  return buildCustomId('lfg', 'rate', 'comment', 'modal', sessionId, targetUserId);
}

export function parseLfgCommentModalCustomId(
  customId: string
): { sessionId: string; targetUserId: string } | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== 'lfg' || parsed.action !== 'rate') {
    return null;
  }

  const [mode = '', kind = '', sessionId = '', targetUserId = ''] = parsed.params;
  if (mode !== 'comment' || kind !== 'modal' || !sessionId || !targetUserId) {
    return null;
  }

  return { sessionId, targetUserId };
}

export function parseLfgTeamSuggestionCustomId(
  customId: string
):
  | { action: 'dismiss' | 'later'; guildId: string }
  | { action: 'create'; guildId: string; memberIds: string[] }
  | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== 'lfg' || parsed.action !== 'team') {
    return null;
  }

  const [teamAction = '', guildId = '', rawMemberIds = ''] = parsed.params;
  if (!guildId) {
    return null;
  }

  if (teamAction === 'dismiss' || teamAction === 'later') {
    return { action: teamAction, guildId };
  }

  if (teamAction === 'create') {
    const memberIds = rawMemberIds.length > 0 ? rawMemberIds.split('-') : [];
    return memberIds.length > 0 ? { action: 'create', guildId, memberIds } : null;
  }

  return null;
}

/**
 * Handles all lfg_* button interactions (join / leave / close).
 * Called from the lfg.ts command via handleButton().
 */
export async function handleLfgButton(interaction: ButtonInteraction): Promise<void> {
  // Close-confirmation follow-ups (confirm-by-default) are routed before
  // parseLfgButtonId because their action words ('confirmclose'/'canceldismiss')
  // are outside its join|leave|close grammar.
  if (await routeLfgCloseConfirmation(interaction)) {
    return;
  }

  const parsed = parseLfgButtonId(interaction.customId);
  if (!parsed) {
    await interaction.reply({
      content: '❌ Unknown button action.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { action, postId } = parsed;
  const userId = interaction.user.id;

  // Hydrate in-memory post store from Redis after bot restart so
  // joinPost/leavePost can find posts that only exist in Redis.
  if (interaction.guildId) {
    await getLfgService().getActivePostsByGuild(interaction.guildId);
  }

  // Closing is destructive → confirm by default. The prompt (and the real close
  // it routes to) lives outside this in-place join/leave update path because the
  // confirm click's interaction.message is the ephemeral prompt, not the post.
  if (action === 'close') {
    await handleClosePrompt(interaction, postId);
    return;
  }

  try {
    let post;
    if (action === 'join') {
      // Issue #6: same hourly rate limit as /lfg join, distributed via Redis so
      // the limit holds across bot shards.
      const rateLimit = await redisRateLimiter.check(
        lfgJoinRateLimitKey(interaction.guildId, userId),
        JOIN_LIMIT_PER_HOUR,
        60 * 60
      );
      if (!rateLimit.allowed) {
        await interaction.reply({
          content: '⏱️ You have reached the join limit. Please try again later.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      post = getLfgService().joinPost(postId, userId);
    } else {
      post = getLfgService().leavePost(postId, userId);
    }

    if (!post) {
      // Post was removed from memory (expired + past grace period). Disable the
      // buttons on the original message and show a clear "expired" notice.
      try {
        await interaction.update({ components: [buildLfgButtons(postId, true)] });
      } catch {
        // If we can't update (already acknowledged), fall back to the reply below.
      }
      await interaction.followUp({
        content: '⏰ This LFG session has expired and is no longer available.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Update the embed in-place with new player counts.
    await interaction.update({
      embeds: [buildLfgEmbed(post)],
      components: [buildLfgButtons(postId, post.status === 'closed')],
    });

    await emitLfgMembershipEvent(interaction.guildId, action, postId, userId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: interaction.user.id,
      username: interaction.user.username,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: `LFG_BUTTON_${action.toUpperCase()}`,
      message: `User ${action} LFG post via button: ${postId}`,
      metadata: { postId, action },
    });
  } catch (error: unknown) {
    await replyLfgButtonError(interaction, getErrorMessage(error), postId);
  }
}

/**
 * Route the close-confirmation follow-up buttons. Returns `true` when handled.
 * Kept separate from the join/leave path so the destructive close converges on
 * the shared confirmation primitive (C2 / CMD-01).
 */
async function routeLfgCloseConfirmation(interaction: ButtonInteraction): Promise<boolean> {
  if (interaction.customId.startsWith('lfg_confirmclose_')) {
    await handleCloseConfirmed(interaction);
    return true;
  }
  if (interaction.customId.startsWith('lfg_canceldismiss_')) {
    await respondConfirmationCancelled(interaction);
    return true;
  }
  return false;
}

/**
 * Emit the real-time membership WebSocket event for a join/leave so web users
 * see the change immediately. No-op outside a guild or when the guild isn't
 * linked to an organization.
 */
async function emitLfgMembershipEvent(
  guildId: string | null,
  action: 'join' | 'leave',
  postId: string,
  userId: string
): Promise<void> {
  if (!guildId) {
    return;
  }
  const orgId = await GuildOrganizationService.getInstance().resolveOrganization(guildId);
  if (!orgId) {
    return;
  }
  if (action === 'join') {
    emitLfgMemberJoined(orgId, postId, userId);
  } else {
    emitLfgMemberLeft(orgId, postId, userId);
  }
}

/**
 * Map a join/leave failure to the appropriate friendly ephemeral response.
 */
async function replyLfgButtonError(
  interaction: ButtonInteraction,
  errorMsg: string,
  postId: string
): Promise<void> {
  // Expired/not-found: disable the buttons on the original message + notice.
  if (errorMsg.includes('expired') || errorMsg.includes('not found')) {
    try {
      await interaction.update({ components: [buildLfgButtons(postId, true)] });
    } catch {
      // Fall through to the ephemeral reply.
    }
    await interaction.followUp({
      content: '⏰ This LFG session has expired and is no longer available.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (errorMsg.includes('full')) {
    await interaction.reply({
      content: '❌ This group is already full!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (errorMsg.includes('creator') || errorMsg.includes('permission')) {
    await interaction.reply({
      content: '❌ Only the creator can close this LFG post.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: `❌ Error: ${errorMsg}`,
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Show the confirm-by-default prompt for closing an LFG post (C2 / CMD-01).
 *
 * The originating `lfg_close_<postId>` button lives on the public LFG message,
 * so we capture `interaction.message.id` into the confirm customId. The real
 * close ({@link handleCloseConfirmed}) then edits/deletes THAT message instead of
 * the ephemeral prompt the confirm button will live on. Creator/existence are
 * pre-checked here for fast feedback; {@link SocialGroupService.closePost} remains
 * the authoritative auth check on confirm.
 */
async function handleClosePrompt(interaction: ButtonInteraction, postId: string): Promise<void> {
  const post = getLfgService().getPost(postId);
  if (!post) {
    await interaction.reply({
      content: '⏰ This LFG session has expired and is no longer available.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (post.creatorId !== interaction.user.id) {
    await interaction.reply({
      content: '❌ Only the creator can close this LFG post.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const prompt = buildConfirmationPrompt({
    confirmCustomId: `lfg_confirmclose_${interaction.message.id}_${postId}`,
    cancelCustomId: `lfg_canceldismiss_${postId}`,
    message: `close the **${post.activity}** LFG post`,
    confirmLabel: 'Close Post',
  });
  await interaction.reply(prompt);
}

/**
 * Execute a confirmed LFG close (C2 / CMD-01).
 *
 * The confirm button lives on an ephemeral prompt, so `interaction.message` is
 * that prompt — NOT the public LFG post. We therefore resolve the public message
 * from the id encoded in the customId (`lfg_confirmclose_<messageId>_<postId>`)
 * and edit/delete THAT message. The interaction itself is only used to
 * acknowledge/collapse the ephemeral prompt.
 */
async function handleCloseConfirmed(interaction: ButtonInteraction): Promise<void> {
  const match = /^lfg_confirmclose_(\d+)_(.+)$/.exec(interaction.customId);
  if (!match) {
    await respondConfirmationCancelled(interaction);
    return;
  }
  const publicMessageId = match[1];
  const postId = match[2];
  const userId = interaction.user.id;

  // Hydrate so closePost can find a post that only exists in Redis (after a bot
  // restart, or when the confirm is handled by a different shard).
  if (interaction.guildId) {
    await getLfgService().getActivePostsByGuild(interaction.guildId);
  }

  // Authoritative auth + status check. On failure, collapse the prompt into the
  // error (the interaction has not been acknowledged yet).
  let post;
  try {
    post = getLfgService().closePost(postId, userId);
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    await interaction
      .update({ content: `❌ ${errorMsg}`, components: [] })
      .catch(() => interaction.reply({ content: `❌ ${errorMsg}`, flags: MessageFlags.Ephemeral }))
      .catch(() => {});
    return;
  }

  // Acknowledge promptly (within the interaction token window) by collapsing the
  // ephemeral prompt; the public-message work below does not need the token.
  await interaction.update({ content: '✅ LFG post closed.', components: [] }).catch(() => {});

  // Refresh the PUBLIC message to its closed state, then schedule its deletion so
  // the "CLOSED" state is briefly visible — mirroring the prior in-place behavior
  // but targeting the real message by id (never the ephemeral prompt).
  let publicMessage: Message | null = null;
  const channel = interaction.channel;
  if (channel && 'messages' in channel) {
    publicMessage = await channel.messages.fetch(publicMessageId).catch(() => null);
    if (publicMessage) {
      await publicMessage
        .edit({ embeds: [buildLfgEmbed(post)], components: [buildLfgButtons(postId, true)] })
        .catch(() => {});
    }
  }

  // Emit WebSocket cancellation so web users see it in real-time.
  if (interaction.guildId) {
    const orgId = await GuildOrganizationService.getInstance().resolveOrganization(
      interaction.guildId
    );
    if (orgId) {
      emitLfgSessionCancelled(orgId, postId, userId);
    }
  }

  // Record session history + send DM rating prompts (idempotent via _finalized).
  await getLfgService().finalizeClosedSession(post);

  // Delete the public message after a short delay, then drop the post from memory
  // so any lingering button clicks immediately show "expired".
  setTimeout(() => {
    void (async () => {
      try {
        await publicMessage?.delete();
      } catch {
        // Message may already be deleted — not fatal.
      }
      getLfgService().deletePost(postId);
    })();
  }, 5_000);

  logAuditEvent({
    eventType: AuditEventType.ACTIVITY_ACTION,
    userId: interaction.user.id,
    username: interaction.user.username,
    resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
    action: 'LFG_BUTTON_CLOSE',
    message: `User closed LFG post via button: ${postId}`,
    metadata: { postId, action: 'close' },
  });
}

/**
 * Handles lfg_rate_* button interactions (thumb ratings, comments, legacy star ratings, detail, done).
 */
export async function handleLfgRatingButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseLfgRatingId(interaction.customId);
  if (!parsed) {
    return; // Not a rating button — let the main handler deal with it
  }

  const userId = interaction.user.id;

  try {
    switch (parsed.type) {
      case 'thumb': {
        const targetUserId = parsed.targetUserId;
        const stars = parsed.stars;
        const thumbType = parsed.thumbType;
        if (!targetUserId || !stars || !thumbType) {
          await interaction.reply({
            content: '❌ Invalid rating payload.',
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        // DM-based thumb rating: 👍/😐/👎
        const reputationService = new ReputationService();
        await reputationService.submitRating({
          sessionId: parsed.sessionId,
          userId: targetUserId,
          raterId: userId,
          overallRating: stars, // mapped from THUMB_TO_RATING
        });

        const label = THUMB_LABELS[thumbType] ?? 'Rating';
        await interaction.reply({
          content: `${label} — Rating submitted for <@${targetUserId}>!`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case 'comment': {
        const targetUserId = parsed.targetUserId;
        if (!targetUserId) {
          await interaction.reply({
            content: '❌ Invalid rating payload.',
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        // Open a simplified comment-only modal
        const modal = new ModalBuilder()
          .setCustomId(buildLfgCommentModalCustomId(parsed.sessionId, targetUserId))
          .setTitle('Add Comment');

        const commentInput = new TextInputBuilder()
          .setCustomId('comment')
          .setPlaceholder('Any feedback about this player...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500);

        const commentLabel = new LabelBuilder()
          .setLabel('Comment (optional)')
          .setTextInputComponent(commentInput);
        modal.addLabelComponents(commentLabel);

        await interaction.showModal(modal);
        break;
      }

      case 'star': {
        const targetUserId = parsed.targetUserId;
        const stars = parsed.stars;
        if (!targetUserId || !stars) {
          await interaction.reply({
            content: '❌ Invalid rating payload.',
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        // Legacy: User clicked a star rating — submit the quick rating
        const reputationService = new ReputationService();
        await reputationService.submitRating({
          sessionId: parsed.sessionId,
          userId: targetUserId,
          raterId: userId,
          overallRating: stars,
        });

        // Show the detail/done buttons
        const detailRow = buildLfgRatingDetailButton(parsed.sessionId, targetUserId, stars);
        const starLabel = STAR_LABELS[stars as 1 | 2 | 3 | 4 | 5] ?? 'Rating';

        await interaction.reply({
          content: `${starLabel} — Rating submitted for <@${targetUserId}>! You can add detailed feedback or select another teammate.`,
          components: [detailRow],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case 'detail': {
        // Legacy: Open a modal for detailed category ratings + comment
        const modal = new ModalBuilder()
          .setCustomId(`lfg_rate_modal_${parsed.sessionId}_${parsed.targetUserId}_${parsed.stars}`)
          .setTitle('Detailed Rating Feedback');

        const communicationInput = new TextInputBuilder()
          .setCustomId('communication')
          .setPlaceholder('Rate their communication skills 1-5')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(1);

        const teamworkInput = new TextInputBuilder()
          .setCustomId('teamwork')
          .setPlaceholder('Rate their teamwork 1-5')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(1);

        const skillInput = new TextInputBuilder()
          .setCustomId('skill')
          .setPlaceholder('Rate their skill level 1-5')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(1);

        const reliabilityInput = new TextInputBuilder()
          .setCustomId('reliability')
          .setPlaceholder('Rate their reliability 1-5')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(1);

        const commentInput = new TextInputBuilder()
          .setCustomId('comment')
          .setPlaceholder('Any additional feedback...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500);

        modal.addLabelComponents(
          new LabelBuilder()
            .setLabel('Communication (1-5)')
            .setTextInputComponent(communicationInput),
          new LabelBuilder().setLabel('Teamwork (1-5)').setTextInputComponent(teamworkInput),
          new LabelBuilder().setLabel('Skill (1-5)').setTextInputComponent(skillInput),
          new LabelBuilder().setLabel('Reliability (1-5)').setTextInputComponent(reliabilityInput),
          new LabelBuilder().setLabel('Comment (optional)').setTextInputComponent(commentInput)
        );

        await interaction.showModal(modal);
        break;
      }

      case 'done': {
        await interaction.reply({
          content:
            '✅ Thanks for rating your teammates! Your feedback helps build a better community.',
          flags: MessageFlags.Ephemeral,
        });

        // Check for frequent positive matches → team suggestion (async, non-blocking)
        checkAndSuggestTeam(interaction, userId, parsed.sessionId).catch((err: unknown) => {
          logger.debug('Team suggestion check failed (non-critical)', {
            err: err instanceof Error ? err.message : String(err),
          });
        });
        break;
      }
    }
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    logger.error(`LFG rating button error: ${errorMsg}`, error);

    let content = `❌ Error: ${errorMsg}`;
    if (errorMsg.includes('Cannot rate yourself')) {
      content = '❌ You cannot rate yourself.';
    } else if (errorMsg.includes('not in this session')) {
      content = '❌ You were not in this session.';
    }

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  }
}

/**
 * Handles lfg_rate_select_* select menu interactions (player selection for rating).
 */
export async function handleLfgRatingSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const parsed = parseLfgRatingId(interaction.customId);
  if (parsed?.type !== 'select') {
    await interaction.reply({
      content: '❌ Unknown select action.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedValue = interaction.values[0]; // format: {sessionId}:{targetUserId}
  const parts = selectedValue.split(':');
  const targetUserId = parts.at(-1);
  if (!targetUserId || parts.length < 2) {
    await interaction.reply({
      content: '❌ Invalid selection.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Show star rating buttons for the selected player
  const starButtons = buildLfgRatingStarButtons(parsed.sessionId, targetUserId);

  await interaction.reply({
    content: `Rate <@${targetUserId}>:`,
    components: [starButtons],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handles lfg_rate_modal_* modal submissions (detailed category ratings).
 */
export async function handleLfgRatingModal(interaction: ModalSubmitInteraction): Promise<void> {
  // Format: lfg_rate_modal_{sessionId}_{targetUserId}_{stars}
  const modalRe = /^lfg_rate_modal_([0-9a-f-]{36})_(\d+)_(\d)$/;
  const match = modalRe.exec(interaction.customId);
  if (!match) {
    await interaction.reply({
      content: '❌ Invalid modal submission.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sessionId = match[1];
  const targetUserId = match[2];
  const stars = Number.parseInt(match[3], 10);
  const raterId = interaction.user.id;

  // Parse category ratings from modal fields
  const parseCategory = (fieldId: string): number | undefined => {
    const raw = interaction.fields.getTextInputValue(fieldId).trim();
    if (!raw) {
      return undefined;
    }
    const val = Number.parseInt(raw, 10);
    return val >= 1 && val <= 5 ? val : undefined;
  };

  const categoryRatings: Record<string, number> = {};
  const communication = parseCategory('communication');
  const teamwork = parseCategory('teamwork');
  const skill = parseCategory('skill');
  const reliability = parseCategory('reliability');

  if (communication) {
    categoryRatings.communication = communication;
  }
  if (teamwork) {
    categoryRatings.teamwork = teamwork;
  }
  if (skill) {
    categoryRatings.skill = skill;
  }
  if (reliability) {
    categoryRatings.reliability = reliability;
  }

  const comment = interaction.fields.getTextInputValue('comment').trim() || undefined;

  try {
    const reputationService = new ReputationService();
    await reputationService.submitRating({
      sessionId,
      userId: targetUserId,
      raterId,
      overallRating: stars,
      categoryRatings: Object.keys(categoryRatings).length > 0 ? categoryRatings : undefined,
      comment,
    });

    await interaction.reply({
      content: `✅ Detailed rating submitted for <@${targetUserId}>! ${STAR_LABELS[stars as 1 | 2 | 3 | 4 | 5]}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    logger.error(`LFG rating modal error: ${errorMsg}`, error);
    await interaction.reply({
      content: `❌ Error submitting rating: ${errorMsg}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handles lfg_rate_comment_modal_* modal submissions (DM comment-only feedback).
 */
export async function handleLfgCommentModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parsed = parseLfgCommentModalCustomId(interaction.customId);
  if (!parsed) {
    return; // Not a comment modal — ignore
  }

  const { sessionId, targetUserId } = parsed;
  const raterId = interaction.user.id;
  const comment = interaction.fields.getTextInputValue('comment').trim() || undefined;

  if (!comment) {
    await interaction.reply({
      content: '💬 No comment provided — skipped.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const reputationService = new ReputationService();
    await reputationService.submitRating({
      sessionId,
      userId: targetUserId,
      raterId,
      overallRating: 3, // neutral — comment-only submission
      comment,
    });

    await interaction.reply({
      content: `💬 Comment submitted for <@${targetUserId}>!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    logger.error(`LFG comment modal error: ${errorMsg}`, error);
    await interaction.reply({
      content: `❌ Error submitting comment: ${errorMsg}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

// ==================== TEAM SUGGESTION ====================

/** Users who clicked "Don't Suggest Again" — Map<`${guildId}:${userId}`, true> */
const teamSuggestionDismissals = new Map<string, boolean>();

/**
 * After "Done Rating", check if the user has frequent positive co-players and send a team suggestion DM.
 */
async function checkAndSuggestTeam(
  interaction: ButtonInteraction,
  userId: string,
  sessionId: string
): Promise<void> {
  // Look up the session to get the guildId
  const session = await getLfgService().getSession(sessionId);
  if (!session) {
    return;
  }

  const guildId = session.guildId;
  const dismissKey = `${guildId}:${userId}`;

  // Skip if user dismissed suggestions
  if (teamSuggestionDismissals.get(dismissKey)) {
    return;
  }

  const matches = await getLfgService().findFrequentPositiveMatches(userId, guildId, 3);
  if (matches.length === 0) {
    return;
  }

  // Cap to 4 co-players (+ the user = 5 max team)
  const topMatches = matches.slice(0, 4);

  try {
    const user = await interaction.client.users.fetch(userId);
    const embed = buildTeamSuggestionEmbed(topMatches);
    const buttons = buildTeamSuggestionButtons(
      guildId,
      topMatches.map(m => m.userId)
    );

    await user.send({
      embeds: [embed],
      components: [buttons],
    });
  } catch {
    // DMs disabled — ignore
  }
}

/**
 * Handle lfg_team_* button interactions (create / later / dismiss).
 */
export async function handleTeamSuggestionButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseLfgTeamSuggestionCustomId(interaction.customId);
  if (!parsed) {
    return;
  }

  if (parsed.action === 'dismiss') {
    const guildId = parsed.guildId;
    const dismissKey = `${guildId}:${interaction.user.id}`;
    teamSuggestionDismissals.set(dismissKey, true);

    await interaction.reply({
      content:
        '🔇 Team suggestions disabled for this server. You can re-enable by playing more sessions.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (parsed.action === 'later') {
    await interaction.reply({
      content: '⏰ No problem! We may suggest again after future sessions.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (parsed.action === 'create') {
    const guildId = parsed.guildId;
    const memberIds = parsed.memberIds;
    const allMembers = [interaction.user.id, ...memberIds];

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const teamName = `Team ${new Date().toISOString().slice(0, 10)}`;
      const result = await getLfgService().convertToTeamFromUsers(
        guildId,
        allMembers,
        teamName,
        interaction.user.id
      );

      logAuditEvent({
        eventType: AuditEventType.BOT_TEAM_CREATED,
        userId: interaction.user.id,
        message: `Team created from suggestion: ${result.teamId}`,
        metadata: { guildId, teamId: result.teamId, memberCount: result.memberCount },
      });

      await interaction.editReply({
        content: `🎯 Team created! **${teamName}** with ${result.memberCount} members.`,
      });
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      logger.error(`Team creation from suggestion failed: ${errorMsg}`, error);
      await interaction.editReply({
        content: `❌ Could not create team: ${errorMsg}`,
      });
    }
  }
}
