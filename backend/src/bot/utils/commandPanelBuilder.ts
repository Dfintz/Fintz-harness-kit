/**
 * CommandPanelBuilder — Shared utility for building interactive button panels
 * that replace subcommand-only slash commands with visual menus.
 *
 * Pattern: User types `/command` → ephemeral embed with buttons for each action.
 * Each button triggers the corresponding subcommand handler.
 *
 * This follows the same interaction style as the Event Creation Wizard
 * but is simpler: buttons map directly to existing subcommand handlers
 * rather than managing stateful wizard sessions.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  type ColorResolvable,
  type InteractionReplyOptions,
} from 'discord.js';

import { EmbedColors } from './embedBuilder';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PanelButton {
  /** The subcommand name this button triggers (e.g. 'create', 'list'). */
  subcommand: string;
  /** Display label on the button. */
  label: string;
  /** Emoji shown on the button (optional). */
  emoji?: string;
  /** Button style (defaults to Secondary). */
  style?: ButtonStyle;
}

export interface CommandPanelConfig {
  /** The command prefix for customId routing (e.g. 'announce', 'bounty'). */
  prefix: string;
  /** Title shown in the panel embed. */
  title: string;
  /** Description text for the panel. */
  description: string;
  /** Embed color (defaults to SC_BLUE). */
  color?: ColorResolvable;
  /** Footer text (optional). */
  footer?: string;
  /** The buttons to display, grouped into rows (max 5 buttons per row, max 5 rows). */
  buttons: PanelButton[];
}

/* ------------------------------------------------------------------ */
/*  Custom ID helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Build the customId for a panel button.
 * Format: `{prefix}_panel_{subcommand}`
 */
export function buildPanelCustomId(prefix: string, subcommand: string): string {
  return `${prefix}_panel_${subcommand}`;
}

/**
 * Parse a panel button customId.
 * Returns the subcommand name or null if not a panel button.
 */
export function parsePanelCustomId(customId: string, prefix: string): string | null {
  const panelPrefix = `${prefix}_panel_`;
  if (!customId.startsWith(panelPrefix)) {
    return null;
  }
  return customId.slice(panelPrefix.length);
}

/**
 * Build a single button component.
 * Shared by command panel implementations that compose their own row layouts.
 */
export function buildButton(
  customId: string,
  label: string,
  emoji: string,
  style: ButtonStyle = ButtonStyle.Secondary
): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setEmoji(emoji).setStyle(style);
}

/**
 * Build one action row from preconfigured button components.
 */
export function buildRow(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

/* ------------------------------------------------------------------ */
/*  Builder                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build the panel embed + button rows from a config.
 */
export function buildCommandPanel(config: CommandPanelConfig): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(config.color ?? EmbedColors.SC_BLUE)
    .setTitle(config.title)
    .setDescription(config.description);

  if (config.footer) {
    embed.setFooter({ text: config.footer });
  }

  // Build button rows (max 5 per row, max 5 rows = 25 buttons)
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let buttonsInRow = 0;

  for (const btn of config.buttons) {
    if (buttonsInRow >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
      buttonsInRow = 0;
    }
    if (rows.length >= 5) {
      break; // Discord max 5 action rows
    }

    const button = new ButtonBuilder()
      .setCustomId(buildPanelCustomId(config.prefix, btn.subcommand))
      .setLabel(btn.label)
      .setStyle(btn.style ?? ButtonStyle.Secondary);

    if (btn.emoji) {
      button.setEmoji(btn.emoji);
    }

    currentRow.addComponents(button);
    buttonsInRow++;
  }

  if (buttonsInRow > 0) {
    rows.push(currentRow);
  }

  return { embed, components: rows };
}

export type CommandPanelReplyOptions = Omit<InteractionReplyOptions, 'embeds' | 'components'>;

const DEFAULT_COMMAND_PANEL_REPLY_OPTIONS: CommandPanelReplyOptions = {
  flags: MessageFlags.Ephemeral,
};

/**
 * Reply to an interaction with a command panel.
 * Defaults to ephemeral, but callers can override reply options for public panels.
 */
export async function replyWithCommandPanel(
  interaction: ChatInputCommandInteraction,
  config: CommandPanelConfig,
  replyOptions: CommandPanelReplyOptions = DEFAULT_COMMAND_PANEL_REPLY_OPTIONS
): Promise<void> {
  const { embed, components } = buildCommandPanel(config);
  await interaction.reply({
    embeds: [embed],
    components,
    ...replyOptions,
  });
}

/* ------------------------------------------------------------------ */
/*  Ephemeral subpanel replies (button-driven hubs)                   */
/* ------------------------------------------------------------------ */

/**
 * Content for an ephemeral subpanel reply produced from a button click.
 * `rows` is optional: link/info panels reply with an embed only.
 */
export interface EphemeralPanelContent {
  /** Title shown in the panel embed. */
  title: string;
  /** Description text for the panel. */
  description: string;
  /** Optional action rows. When omitted or empty the reply is embed-only. */
  rows?: ActionRowBuilder<ButtonBuilder>[];
  /**
   * Optional breadcrumb trail (root → current), rendered as a navigation line in
   * the embed author (e.g. `🧭 Org Hub › Activities`) so users see where they are
   * within a multi-step panel hub (CMD-06). Omitted/empty → no author line.
   */
  breadcrumb?: string[];
}

const PANEL_CONTINUE_FOOTER = 'Use the buttons below to continue';
const PANEL_RETURN_FOOTER = 'Run the command again to return to the root panel';

/** Leading icon + segment separator for the panel breadcrumb trail. */
const PANEL_BREADCRUMB_ICON = '🧭';
const PANEL_BREADCRUMB_SEPARATOR = ' › ';
/** Back-navigation emoji for panel "Back" buttons. */
const PANEL_BACK_EMOJI = '⬅️';

/**
 * Format a breadcrumb trail (root → current) as a single navigation line, e.g.
 * `🧭 Org Hub › Activities`. Blank segments are dropped. Pure — exported for
 * unit testing and reuse by any hub that renders its own breadcrumb.
 */
export function formatPanelBreadcrumb(trail: string[]): string {
  const segments = trail.map(segment => segment.trim()).filter(segment => segment.length > 0);
  return `${PANEL_BREADCRUMB_ICON} ${segments.join(PANEL_BREADCRUMB_SEPARATOR)}`;
}

/**
 * Build a standard "Back" button for stepping up one level in a panel hub
 * (CMD-06). The caller owns the customId so each hub routes Back to its own
 * root-panel re-render.
 */
export function buildPanelBackButton(customId: string, label = 'Back'): ButtonBuilder {
  return buildButton(customId, label, PANEL_BACK_EMOJI, ButtonStyle.Secondary);
}

/**
 * Strip a leading emoji/symbol run (and trailing space) from a panel title to
 * produce a clean breadcrumb label, e.g. `🚀 User Hangar` → `User Hangar`,
 * `🛰️ RSI Status` → `RSI Status`. Emoji-less titles pass through unchanged.
 * Shared by panel hubs that derive a breadcrumb segment from a subpanel title.
 */
export function stripLeadingPanelEmoji(title: string): string {
  return title.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/** Options for {@link decorateSubpanel}. */
export interface SubpanelDecoration {
  /** Breadcrumb trail (root → current) rendered as the embed author line. */
  breadcrumb: string[];
  /** customId the appended Back button routes to (caller-owned). */
  backCustomId: string;
  /** Optional Back button label (defaults to "Back"). */
  backLabel?: string;
}

/**
 * Decorate a panel with a breadcrumb trail and a trailing Back button row so the
 * user sees their location within a hub and can step up one level in place
 * (CMD-06). Shared by panel hubs (`/org`, `/user`, …) so each does not
 * re-implement the breadcrumb + Back-row composition. Pure — returns new content.
 */
export function decorateSubpanel(
  panel: EphemeralPanelContent,
  decoration: SubpanelDecoration
): EphemeralPanelContent {
  const backRow = buildRow(buildPanelBackButton(decoration.backCustomId, decoration.backLabel));
  return {
    ...panel,
    breadcrumb: decoration.breadcrumb,
    rows: [...(panel.rows ?? []), backRow],
  };
}

/**
 * Build the ephemeral hub subpanel embed.
 *
 * Single source of truth for the panel embed shared by `replyEphemeralPanel`
 * (initial reply) and any in-place `interaction.update` path (e.g. paginated
 * subpanels), so the embed style stays identical across reply and update.
 */
export function buildEphemeralPanelEmbed(content: EphemeralPanelContent): EmbedBuilder {
  const hasRows = (content.rows ?? []).length > 0;

  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(content.title)
    .setDescription(content.description)
    .setFooter({ text: hasRows ? PANEL_CONTINUE_FOOTER : PANEL_RETURN_FOOTER })
    .setTimestamp();

  const trail = content.breadcrumb ?? [];
  if (trail.length > 0) {
    embed.setAuthor({ name: formatPanelBreadcrumb(trail) });
  }

  return embed;
}

/**
 * Reply to a button interaction with an ephemeral hub subpanel embed.
 *
 * Shared by the /user, /org, and /federation hubs so each does not re-implement
 * the embed build + optional-rows reply (single source of truth).
 *
 * @param interaction - The button interaction to reply to.
 * @param content - Panel title, description, and optional action rows.
 */
export async function replyEphemeralPanel(
  interaction: ButtonInteraction,
  content: EphemeralPanelContent
): Promise<void> {
  const rows = content.rows ?? [];
  const hasRows = rows.length > 0;

  const embed = buildEphemeralPanelEmbed(content);

  await interaction.reply({
    embeds: [embed],
    ...(hasRows ? { components: rows } : {}),
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Update a button interaction's message in place with an ephemeral subpanel embed
 * — the `interaction.update` counterpart of {@link replyEphemeralPanel}. Used for
 * in-place hub navigation (breadcrumb/back) so stepping between panels edits the
 * same ephemeral message instead of stacking new replies (CMD-06). `components`
 * is always sent (empty when there are no rows) so stale buttons are cleared.
 */
export async function updateEphemeralPanel(
  interaction: ButtonInteraction,
  content: EphemeralPanelContent
): Promise<void> {
  const rows = content.rows ?? [];
  await interaction.update({
    embeds: [buildEphemeralPanelEmbed(content)],
    components: rows,
  });
}
