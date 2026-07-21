import {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  Client,
  Interaction,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { logger } from '../utils/logger';

import { BotCommand } from './commands/types';
import { CommandAnalytics } from './utils/commandAnalytics';
import { CooldownManager } from './utils/cooldownManager';
import { customIdScope, parseCustomId } from './utils/customId';
import { executeInteraction, trackInteractionLatency } from './utils/interactionExecutor';

// Re-export so existing importers (e.g. botApp.ts slash path) keep a stable path.
export { trackInteractionLatency };

/**
 * Interaction Router — dispatches non-command interactions (buttons, modals, select menus)
 * to the appropriate BotCommand handler based on customId prefix matching.
 *
 * Convention: customId format is `{prefix}_{action}_{resourceId}`
 * The prefix maps to a command name via COMMAND_PREFIX_MAP.
 *
 * Example: `event_join_abc123` → events command → handleButton()
 */

/**
 * Maps customId prefixes to command names.
 * When a button/modal/select has customId starting with a key here,
 * it routes to the command named by the value.
 *
 * After Phase 6 full flattening, all commands are standalone so prefix maps
 * directly to the command name (e.g. 'event' → 'events').
 */
const COMMAND_PREFIX_MAP: Record<string, string> = {
  // Standalone promoted commands (prefix → command name)
  announce: 'announce',
  attend: 'attend',
  bounty: 'bounty',
  briefing: 'briefing',
  commlink: 'commlink',
  community: 'community',
  discover: 'discover',
  event: 'events',
  hunter: 'hunter',
  mission: 'mission',
  moderation: 'moderation',
  notify: 'notify',
  reminder: 'reminder',
  schedule: 'schedule',
  stats: 'stats',
  user: 'user',
  org: 'org',
  verify: 'verify',
  // Original interactive commands
  lfg: 'lfg',
  voice: 'voice',
  giveaway: 'giveaway',
  diplomacy: 'diplomacy',
  recruitment: 'recruitment',
  ticket: 'ticket',
  // Phase 6 — formerly grouped, now standalone
  federation: 'federation',
  poll: 'poll',
  reactionrole: 'roles',
  embed: 'embed',
  // Phase 7 — panel-only commands
  guild: 'guild',
  faq: 'faq',
  wiki: 'wiki',
  help: 'help',
  readycheck: 'readycheck',
  rsistatus: 'rsistatus',
  rsisync: 'rsisync',
};

/** Button interaction cooldown: 2 seconds per user per customId action scope */
const BUTTON_COOLDOWN_SECONDS = 2;
/** Modal/select interaction cooldown: 2 seconds per user per customId prefix */
const MODAL_SELECT_COOLDOWN_SECONDS = 2;

/**
 * Extracts the command prefix from a customId.
 * e.g., 'event_join_abc123' → 'event'
 *       'diplomacy_propose' → 'diplomacy'
 */
function extractPrefix(customId: string): string {
  return parseCustomId(customId).prefix;
}

/**
 * Extracts the action-level cooldown scope for button interactions.
 * e.g., 'event_join_abc123' -> 'event_join'
 *       'faq_panel_list' -> 'faq_panel'
 */
function extractButtonCooldownScope(customId: string): string {
  return customIdScope(customId);
}

/**
 * Resolves a customId prefix to a BotCommand that can handle the interaction.
 */
function resolveCommand(client: Client, customId: string): BotCommand | undefined {
  const prefix = extractPrefix(customId);
  const commandName = COMMAND_PREFIX_MAP[prefix];

  if (!commandName) {
    return undefined;
  }

  return client.commands.get(commandName);
}

interface ResolvedButtonCommand {
  command: BotCommand & {
    handleButton: NonNullable<BotCommand['handleButton']>;
  };
  prefix: string;
}

async function handleLfgMuteButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId } = interaction;
  if (!customId.startsWith('lfg_mute_')) {
    return false;
  }

  const lfgStart = Date.now();
  let lfgSuccess = true;
  try {
    const guildId = customId.replace('lfg_mute_', '');
    const { DiscordUserPreferenceService } =
      await import('../services/discord/DiscordUserPreferenceService');
    const prefService = DiscordUserPreferenceService.getInstance();
    await prefService.update(interaction.user.id, guildId, { lfgPingOptIn: false });
    await interaction.reply({
      content: '🔇 LFG pings muted for this server. Use `/notify my-toggle` to re-enable.',
      flags: MessageFlags.Ephemeral,
    });
  } catch {
    lfgSuccess = false;
    await interaction.reply({
      content: '❌ Failed to mute. Try `/notify my-toggle setting:lfgPingOptIn value:false`.',
      flags: MessageFlags.Ephemeral,
    });
  } finally {
    trackInteractionLatency(
      'button',
      'btn:lfg_mute',
      Date.now() - lfgStart,
      lfgSuccess,
      interaction.guildId ?? undefined
    );
  }

  return true;
}

function resolveButtonCommand(client: Client, customId: string): ResolvedButtonCommand | null {
  const command = resolveCommand(client, customId);
  if (!command) {
    logger.warn(`No command handler found for button customId: ${customId}`);
    return null;
  }

  if (!command.handleButton) {
    logger.warn(`Command "${command.data.name}" has no handleButton method for: ${customId}`);
    return null;
  }

  return {
    command: command as BotCommand & {
      handleButton: NonNullable<BotCommand['handleButton']>;
    },
    prefix: extractPrefix(customId),
  };
}

/**
 * Handles a button interaction by routing to the appropriate command.
 */
async function handleButtonInteraction(
  interaction: ButtonInteraction,
  client: Client,
  cooldownManager: CooldownManager,
  commandAnalytics?: CommandAnalytics
): Promise<void> {
  const { customId } = interaction;

  if (await handleLfgMuteButton(interaction)) {
    return;
  }

  const resolved = resolveButtonCommand(client, customId);
  if (!resolved) {
    return;
  }

  const { command, prefix } = resolved;
  const buttonScope = extractButtonCooldownScope(customId);

  // Button cooldown is scoped to the action (e.g. `event_join`) so different
  // actions on the same panel aren't rate-limited against each other.
  await executeInteraction({
    interaction,
    kind: 'button',
    analyticsLabel: `btn:${prefix}`,
    cooldownKey: `btn_${buttonScope}`,
    cooldownSeconds: BUTTON_COOLDOWN_SECONDS,
    cooldownManager,
    commandAnalytics,
    run: () => command.handleButton(interaction),
  });
}

/**
 * Handles a modal submit interaction by routing to the appropriate command.
 */
async function handleModalInteraction(
  interaction: ModalSubmitInteraction,
  client: Client,
  cooldownManager: CooldownManager,
  commandAnalytics?: CommandAnalytics
): Promise<void> {
  const { customId } = interaction;
  const command = resolveCommand(client, customId);

  if (!command) {
    logger.warn(`No command handler found for modal customId: ${customId}`);
    return;
  }

  if (!command.handleModal) {
    logger.warn(`Command "${command.data.name}" has no handleModal method for: ${customId}`);
    return;
  }

  // Capture the narrowed handler so the executor callback stays type-safe.
  const handleModal = command.handleModal;
  const prefix = extractPrefix(customId);

  await executeInteraction({
    interaction,
    kind: 'modal',
    analyticsLabel: `modal:${prefix}`,
    cooldownKey: `modal_${prefix}`,
    cooldownSeconds: MODAL_SELECT_COOLDOWN_SECONDS,
    cooldownManager,
    commandAnalytics,
    run: () => handleModal(interaction),
  });
}

/**
 * Union of the two select-menu interaction shapes the router dispatches.
 * They share every member the dispatcher touches (customId, user, guild, reply, etc.).
 */
type AnySelectMenuInteraction = StringSelectMenuInteraction | ChannelSelectMenuInteraction;

/**
 * Shared dispatch for string and channel select menus — resolves the command,
 * enforces the select cooldown, invokes the supplied handler, and records telemetry.
 */
async function dispatchSelectMenuInteraction<T extends AnySelectMenuInteraction>(
  interaction: T,
  client: Client,
  cooldownManager: CooldownManager,
  commandAnalytics: CommandAnalytics | undefined,
  getHandler: (command: BotCommand) => ((interaction: T) => Promise<void>) | undefined
): Promise<void> {
  const { customId } = interaction;
  const command = resolveCommand(client, customId);

  if (!command) {
    logger.warn(`No command handler found for select menu customId: ${customId}`);
    return;
  }

  const handler = getHandler(command);
  if (!handler) {
    logger.warn(`Command "${command.data.name}" has no select handler for: ${customId}`);
    return;
  }

  const prefix = extractPrefix(customId);

  await executeInteraction({
    interaction,
    kind: 'select',
    analyticsLabel: `select:${prefix}`,
    cooldownKey: `select_${prefix}`,
    cooldownSeconds: MODAL_SELECT_COOLDOWN_SECONDS,
    cooldownManager,
    commandAnalytics,
    run: () => handler(interaction),
  });
}

/**
 * Handles a string select menu interaction by routing to the appropriate command.
 */
async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
  client: Client,
  cooldownManager: CooldownManager,
  commandAnalytics?: CommandAnalytics
): Promise<void> {
  await dispatchSelectMenuInteraction(
    interaction,
    client,
    cooldownManager,
    commandAnalytics,
    command => command.handleSelectMenu
  );
}

/**
 * Handles a channel select menu interaction by routing to the appropriate command.
 * Channel select menus give users native search across all guild channels.
 */
async function handleChannelSelectMenuInteraction(
  interaction: ChannelSelectMenuInteraction,
  client: Client,
  cooldownManager: CooldownManager,
  commandAnalytics?: CommandAnalytics
): Promise<void> {
  await dispatchSelectMenuInteraction(
    interaction,
    client,
    cooldownManager,
    commandAnalytics,
    command => command.handleChannelSelectMenu
  );
}

/**
 * Main interaction dispatcher. Call from botApp.ts interactionCreate event.
 *
 * Routes non-command interactions to the appropriate handler:
 * - ButtonInteraction → handleButtonInteraction
 * - ModalSubmitInteraction → handleModalInteraction
 * - StringSelectMenuInteraction → handleSelectMenuInteraction
 * - ChannelSelectMenuInteraction → handleChannelSelectMenuInteraction
 *
 * Command interactions (ChatInputCommandInteraction) are NOT handled here —
 * they continue to be handled by the existing slash command logic in botApp.ts.
 */
export async function routeInteraction(
  interaction: Interaction,
  client: Client,
  cooldownManager: CooldownManager,
  commandAnalytics?: CommandAnalytics
): Promise<boolean> {
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction, client, cooldownManager, commandAnalytics);
    return true;
  }

  if (interaction.isModalSubmit()) {
    await handleModalInteraction(interaction, client, cooldownManager, commandAnalytics);
    return true;
  }

  if (interaction.isStringSelectMenu()) {
    await handleSelectMenuInteraction(interaction, client, cooldownManager, commandAnalytics);
    return true;
  }

  if (interaction.isChannelSelectMenu()) {
    await handleChannelSelectMenuInteraction(
      interaction,
      client,
      cooldownManager,
      commandAnalytics
    );
    return true;
  }

  // Not handled — let botApp.ts handle it (slash commands, etc.)
  return false;
}
