"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackInteractionLatency = void 0;
exports.routeInteraction = routeInteraction;
const discord_js_1 = require("discord.js");
const logger_1 = require("../utils/logger");
const customId_1 = require("./utils/customId");
const interactionExecutor_1 = require("./utils/interactionExecutor");
Object.defineProperty(exports, "trackInteractionLatency", { enumerable: true, get: function () { return interactionExecutor_1.trackInteractionLatency; } });
const COMMAND_PREFIX_MAP = {
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
    lfg: 'lfg',
    voice: 'voice',
    giveaway: 'giveaway',
    diplomacy: 'diplomacy',
    recruitment: 'recruitment',
    ticket: 'ticket',
    federation: 'federation',
    poll: 'poll',
    reactionrole: 'roles',
    embed: 'embed',
    guild: 'guild',
    faq: 'faq',
    wiki: 'wiki',
    help: 'help',
    readycheck: 'readycheck',
    rsistatus: 'rsistatus',
    rsisync: 'rsisync',
};
const BUTTON_COOLDOWN_SECONDS = 2;
const MODAL_SELECT_COOLDOWN_SECONDS = 2;
function extractPrefix(customId) {
    return (0, customId_1.parseCustomId)(customId).prefix;
}
function extractButtonCooldownScope(customId) {
    return (0, customId_1.customIdScope)(customId);
}
function resolveCommand(client, customId) {
    const prefix = extractPrefix(customId);
    const commandName = COMMAND_PREFIX_MAP[prefix];
    if (!commandName) {
        return undefined;
    }
    return client.commands.get(commandName);
}
async function handleLfgMuteButton(interaction) {
    const { customId } = interaction;
    if (!customId.startsWith('lfg_mute_')) {
        return false;
    }
    const lfgStart = Date.now();
    let lfgSuccess = true;
    try {
        const guildId = customId.replace('lfg_mute_', '');
        const { DiscordUserPreferenceService } = await Promise.resolve().then(() => __importStar(require('../services/discord/DiscordUserPreferenceService')));
        const prefService = DiscordUserPreferenceService.getInstance();
        await prefService.update(interaction.user.id, guildId, { lfgPingOptIn: false });
        await interaction.reply({
            content: '🔇 LFG pings muted for this server. Use `/notify my-toggle` to re-enable.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch {
        lfgSuccess = false;
        await interaction.reply({
            content: '❌ Failed to mute. Try `/notify my-toggle setting:lfgPingOptIn value:false`.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    finally {
        (0, interactionExecutor_1.trackInteractionLatency)('button', 'btn:lfg_mute', Date.now() - lfgStart, lfgSuccess, interaction.guildId ?? undefined);
    }
    return true;
}
function resolveButtonCommand(client, customId) {
    const command = resolveCommand(client, customId);
    if (!command) {
        logger_1.logger.warn(`No command handler found for button customId: ${customId}`);
        return null;
    }
    if (!command.handleButton) {
        logger_1.logger.warn(`Command "${command.data.name}" has no handleButton method for: ${customId}`);
        return null;
    }
    return {
        command: command,
        prefix: extractPrefix(customId),
    };
}
async function handleButtonInteraction(interaction, client, cooldownManager, commandAnalytics) {
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
    await (0, interactionExecutor_1.executeInteraction)({
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
async function handleModalInteraction(interaction, client, cooldownManager, commandAnalytics) {
    const { customId } = interaction;
    const command = resolveCommand(client, customId);
    if (!command) {
        logger_1.logger.warn(`No command handler found for modal customId: ${customId}`);
        return;
    }
    if (!command.handleModal) {
        logger_1.logger.warn(`Command "${command.data.name}" has no handleModal method for: ${customId}`);
        return;
    }
    const handleModal = command.handleModal;
    const prefix = extractPrefix(customId);
    await (0, interactionExecutor_1.executeInteraction)({
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
async function dispatchSelectMenuInteraction(interaction, client, cooldownManager, commandAnalytics, getHandler) {
    const { customId } = interaction;
    const command = resolveCommand(client, customId);
    if (!command) {
        logger_1.logger.warn(`No command handler found for select menu customId: ${customId}`);
        return;
    }
    const handler = getHandler(command);
    if (!handler) {
        logger_1.logger.warn(`Command "${command.data.name}" has no select handler for: ${customId}`);
        return;
    }
    const prefix = extractPrefix(customId);
    await (0, interactionExecutor_1.executeInteraction)({
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
async function handleSelectMenuInteraction(interaction, client, cooldownManager, commandAnalytics) {
    await dispatchSelectMenuInteraction(interaction, client, cooldownManager, commandAnalytics, command => command.handleSelectMenu);
}
async function handleChannelSelectMenuInteraction(interaction, client, cooldownManager, commandAnalytics) {
    await dispatchSelectMenuInteraction(interaction, client, cooldownManager, commandAnalytics, command => command.handleChannelSelectMenu);
}
async function routeInteraction(interaction, client, cooldownManager, commandAnalytics) {
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
        await handleChannelSelectMenuInteraction(interaction, client, cooldownManager, commandAnalytics);
        return true;
    }
    return false;
}
//# sourceMappingURL=interactionRouter.js.map