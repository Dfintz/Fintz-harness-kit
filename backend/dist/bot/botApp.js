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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
exports.startBot = startBot;
exports.shutdownBotRuntime = shutdownBotRuntime;
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const discordReconciliationJob_1 = require("../jobs/discordReconciliationJob");
const retryFailedDms_1 = require("../jobs/retryFailedDms");
const ActivityEventService_1 = require("../services/activity/ActivityEventService");
const communication_1 = require("../services/communication");
const BotPresenceService_1 = require("../services/discord/BotPresenceService");
const ChangelogWebhookService_1 = require("../services/discord/ChangelogWebhookService");
const DmNotificationService_1 = require("../services/discord/DmNotificationService");
const EmbedBuilderService_1 = require("../services/discord/EmbedBuilderService");
const GiveawayService_1 = require("../services/discord/GiveawayService");
const PresenceTrackingService_1 = require("../services/discord/PresenceTrackingService");
const ReactionRoleService_1 = require("../services/discord/ReactionRoleService");
const SmartLfgPingService_1 = require("../services/discord/SmartLfgPingService");
const TeamVoiceService_1 = require("../services/discord/TeamVoiceService");
const TicketAutomationService_1 = require("../services/discord/TicketAutomationService");
const TicketTranscriptService_1 = require("../services/discord/TicketTranscriptService");
const TunnelService_1 = require("../services/discord/TunnelService");
const logger_1 = require("../utils/logger");
const BotClientManager_1 = require("./BotClientManager");
const BotIPCService_1 = require("./BotIPCService");
const analytics_1 = require("./commands/analytics");
const announce_1 = require("./commands/announce");
const attend_1 = require("./commands/attend");
const bounty_1 = require("./commands/bounty");
const briefing_1 = require("./commands/briefing");
const commlink_1 = require("./commands/commlink");
const community_1 = require("./commands/community");
const diplomacy_1 = require("./commands/diplomacy");
const discover_1 = require("./commands/discover");
const embed_1 = require("./commands/embed");
const events_1 = require("./commands/events");
const faq_1 = require("./commands/faq");
const federation_1 = require("./commands/federation");
const giveaway_1 = require("./commands/giveaway");
const guild_1 = require("./commands/guild");
const help_1 = require("./commands/help");
const hunter_1 = require("./commands/hunter");
const lfg_1 = require("./commands/lfg");
const mission_1 = require("./commands/mission");
const moderation_1 = require("./commands/moderation");
const notify_1 = require("./commands/notify");
const org_1 = require("./commands/org");
const ping_1 = require("./commands/ping");
const poll_1 = require("./commands/poll");
const readycheck_1 = require("./commands/readycheck");
const recruitment_1 = require("./commands/recruitment");
const reminder_1 = require("./commands/reminder");
const roles_1 = require("./commands/roles");
const rsistatus_1 = require("./commands/rsistatus");
const rsisync_1 = require("./commands/rsisync");
const schedule_1 = require("./commands/schedule");
const stats_1 = require("./commands/stats");
const ticket_1 = require("./commands/ticket");
const user_1 = require("./commands/user");
const verify_1 = require("./commands/verify");
const voice_1 = require("./commands/voice");
const wiki_1 = require("./commands/wiki");
const slashRoots_1 = require("./constants/slashRoots");
const engagementJobs_1 = require("./engagement/engagementJobs");
const engagementTracker_1 = require("./engagement/engagementTracker");
const guildMemberIpcHandler_1 = require("./guildMemberIpcHandler");
const interactionRouter_1 = require("./interactionRouter");
const activityDiscordLifecycleListener_1 = require("./listeners/activityDiscordLifecycleListener");
const messageRelay_1 = require("./messageRelay");
const mirrorSync_1 = require("./mirrorSync");
const moderationEventHandler_1 = require("./moderationEventHandler");
const recruitmentRoleHandler_1 = require("./recruitmentRoleHandler");
const roleIpcHandler_1 = require("./roleIpcHandler");
const rsiStatusIpcHandler_1 = require("./rsiStatusIpcHandler");
const commandAnalytics_1 = require("./utils/commandAnalytics");
const cooldownManager_1 = require("./utils/cooldownManager");
const interactionExecutor_1 = require("./utils/interactionExecutor");
const startupValidation_1 = require("./utils/startupValidation");
const lfgPresenceMonitor_1 = require("./voice/lfgPresenceMonitor");
const voiceAutoCreate_1 = require("./voice/voiceAutoCreate");
dotenv_1.default.config();
const clientManager = BotClientManager_1.BotClientManager.getInstance();
const client = clientManager.getClient();
exports.client = client;
client.commands = new discord_js_1.Collection();
const topLevelSlashCommandMap = {
    user: user_1.user,
    org: org_1.org,
    federation: federation_1.federation,
};
const slashCommands = slashRoots_1.TOP_LEVEL_SLASH_COMMAND_NAMES.map(commandName => topLevelSlashCommandMap[commandName]);
const panelOnlyCommands = [
    ping_1.ping,
    help_1.help,
    events_1.events,
    lfg_1.lfg,
    bounty_1.bounty,
    mission_1.mission,
    announce_1.announce,
    ticket_1.ticket,
    recruitment_1.recruitment,
    stats_1.stats,
    verify_1.verify,
    moderation_1.moderation,
    notify_1.notify,
    voice_1.voice,
    commlink_1.commlink,
    community_1.community,
    analytics_1.analytics,
    rsistatus_1.rsistatus,
    rsisync_1.rsisync,
    attend_1.attendanceCommand,
    schedule_1.schedule,
    reminder_1.reminder,
    hunter_1.hunter,
    briefing_1.briefing,
    discover_1.discover,
    faq_1.faq,
    embed_1.embed,
    roles_1.roles,
    guild_1.guild,
    poll_1.poll,
    wiki_1.wiki,
    diplomacy_1.diplomacy,
    giveaway_1.giveaway,
    readycheck_1.readycheck,
];
const allCommands = [...slashCommands, ...panelOnlyCommands];
allCommands.forEach(command => {
    client.commands.set(command.data.name, command);
});
const tunnelService = TunnelService_1.TunnelService.getInstance();
const messageRelay = new messageRelay_1.MessageRelay(client, tunnelService);
const voiceChannelService = communication_1.VoiceChannelService.getInstance();
let activityEventService = null;
function getActivityEventService() {
    activityEventService ??= new ActivityEventService_1.ActivityEventService();
    return activityEventService;
}
const cooldownManager = cooldownManager_1.CooldownManager.getInstance();
const commandAnalytics = commandAnalytics_1.CommandAnalytics.getInstance();
const managedIntervals = new Set();
let ticketAutomationJob = null;
let engagementJobs = null;
let botRuntimeInitialized = false;
let runtimeShutdownPromise = null;
function registerManagedInterval(interval) {
    managedIntervals.add(interval);
    if (typeof interval.unref === 'function') {
        interval.unref();
    }
    return interval;
}
function clearManagedIntervals() {
    for (const interval of managedIntervals) {
        clearInterval(interval);
    }
    managedIntervals.clear();
}
function getDiscordApplicationClientId() {
    return process.env.DISCORD_BOT_CLIENT_ID ?? process.env.DISCORD_CLIENT_ID;
}
function getSlashCommandRegistrationMode() {
    const rawMode = process.env.DISCORD_SLASH_COMMAND_REGISTRATION_MODE?.trim().toLowerCase();
    if (rawMode === 'global' || rawMode === 'both' || rawMode === 'guild') {
        return rawMode;
    }
    if (rawMode) {
        logger_1.logger.warn(`Invalid DISCORD_SLASH_COMMAND_REGISTRATION_MODE="${rawMode}". Falling back to "guild".`);
    }
    return 'guild';
}
async function registerSlashCommands() {
    const mode = getSlashCommandRegistrationMode();
    logger_1.logger.info(`🧭 Slash command registration mode: ${mode}`);
    if (mode === 'guild' || mode === 'both') {
        if (mode === 'guild') {
            await clearGlobalCommands();
        }
        await registerCommandsForExistingGuilds();
    }
    if (mode === 'global' || mode === 'both') {
        await registerCommandsGlobally();
    }
}
client.once('clientReady', async () => {
    logger_1.logger.info(`✅ Discord Bot logged in as ${client.user?.tag}`);
    logger_1.logger.info(`🤖 Bot is active in ${client.guilds.cache.size} guilds`);
    await registerSlashCommands();
    const ipcService = BotIPCService_1.BotIPCService.getInstance();
    await ipcService
        .initialize()
        .catch(err => logger_1.logger.warn('BotIPCService: Failed to initialize (non-fatal):', err));
    (0, mirrorSync_1.initializeMirrorSyncHandler)(ipcService, client);
    (0, guildMemberIpcHandler_1.initializeGuildMemberHandler)(ipcService, client);
    (0, roleIpcHandler_1.initializeRoleIpcHandler)(ipcService, client);
    (0, rsiStatusIpcHandler_1.initializeRsiStatusIpcHandler)(ipcService, client);
    await tunnelService
        .initialize()
        .catch(err => logger_1.logger.warn('TunnelService: Failed to initialize (non-fatal):', err));
    logger_1.logger.info('🌉 Tunnel service initialized');
    messageRelay.initialize();
    logger_1.logger.info('🌉 Tunnel message relay initialized');
    initializeVoiceStateTracking();
    logger_1.logger.info('🎤 Voice state tracking initialized');
    await (0, rsistatus_1.restoreRsiStatusPanels)().catch(err => logger_1.logger.warn('RSI Status panel restoration failed (non-fatal):', err));
    await (0, rsistatus_1.restoreRsiStatusChannels)().catch(err => logger_1.logger.warn('RSI Status channel restoration failed (non-fatal):', err));
    initializePresenceMonitor();
    logger_1.logger.info('🤖 LFG presence monitor initialized');
    (0, moderationEventHandler_1.initializeModerationEventHandlers)(client);
    (0, recruitmentRoleHandler_1.initializeRecruitmentRoleHandler)();
    startVoiceChannelCleanup();
    logger_1.logger.info('🧹 Voice channel cleanup task started');
    startCooldownCleanup();
    logger_1.logger.info('🧹 Cooldown cleanup task started');
    startAnalyticsCleanup();
    logger_1.logger.info('🧹 Analytics cleanup task started');
    (0, moderationEventHandler_1.startIncidentExpirationTask)();
    (0, engagementTracker_1.initializeEngagementTracking)(client);
    const statRoleJob = new engagementJobs_1.StatRoleEvaluationJob(client);
    statRoleJob.start();
    const counterJob = new engagementJobs_1.ChannelCounterUpdateJob(client);
    counterJob.start();
    const cleanupJob = new engagementJobs_1.EngagementCleanupJob();
    cleanupJob.start();
    engagementJobs = { statRoleJob, counterJob, cleanupJob };
    const guildIds = client.guilds.cache.map(g => g.id);
    (0, voiceAutoCreate_1.reconcileDynamicChannels)(guildIds);
    DmNotificationService_1.DmNotificationService.getInstance().initialize(client);
    TicketTranscriptService_1.TicketTranscriptService.getInstance().initialize(client);
    SmartLfgPingService_1.SmartLfgPingService.getInstance().initialize(client);
    ticketAutomationJob = new TicketAutomationService_1.TicketAutomationJob(client);
    ticketAutomationJob.start();
    registerManagedInterval((0, retryFailedDms_1.startFailedDmRetryJob)());
    registerManagedInterval((0, discordReconciliationJob_1.startDiscordReconciliationJob)());
    logger_1.logger.info('🔔 Phase 4 services initialized (DM, Transcripts, Automation, Smart Ping, DM Retry Queue, Reconciliation)');
    PresenceTrackingService_1.PresenceTrackingService.getInstance().initialize(client);
    GiveawayService_1.GiveawayService.getInstance().initialize(client);
    ReactionRoleService_1.ReactionRoleService.getInstance().initialize(client);
    EmbedBuilderService_1.EmbedBuilderService.getInstance().initialize();
    logger_1.logger.info('📊 Phase 5+ services initialized (Presence Tracking, Giveaways, Reaction Roles, Embed Builder)');
    BotPresenceService_1.BotPresenceService.getInstance().initialize(client);
    ChangelogWebhookService_1.ChangelogWebhookService.getInstance().initialize();
    TeamVoiceService_1.TeamVoiceService.getInstance().initialize(client);
    logger_1.logger.info('🎙️ Team Voice service initialized');
    const { DiscordAuditLogService } = await Promise.resolve().then(() => __importStar(require('../services/discord/DiscordAuditLogService')));
    DiscordAuditLogService.getInstance().initialize(client);
    logger_1.logger.info('📋 Audit Log service initialized');
    try {
        const { DiscordEventService } = await Promise.resolve().then(() => __importStar(require('../services/discord/DiscordEventService')));
        DiscordEventService.getInstance().initialize(client);
        logger_1.logger.info('📅 Discord Scheduled Event service initialized');
    }
    catch {
    }
    try {
        (0, activityDiscordLifecycleListener_1.registerActivityDiscordLifecycleListeners)(client, voiceChannelService);
    }
    catch (err) {
        logger_1.logger.warn('Failed to register activity lifecycle listeners', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    try {
        const { registerActivityAnnouncementListeners } = await Promise.resolve().then(() => __importStar(require('./listeners/activityListener')));
        registerActivityAnnouncementListeners(client);
    }
    catch (err) {
        logger_1.logger.warn('Failed to register activity announcement listeners', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    try {
        const { registerRoleSyncListener } = await Promise.resolve().then(() => __importStar(require('./listeners/roleSyncListener')));
        registerRoleSyncListener(client);
    }
    catch (err) {
        logger_1.logger.warn('Failed to register role sync listener', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    try {
        const { registerNotificationPreferenceListener } = await Promise.resolve().then(() => __importStar(require('./listeners/notificationPreferenceListener')));
        registerNotificationPreferenceListener(client);
    }
    catch (err) {
        logger_1.logger.warn('Failed to register notification preference listener', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    botRuntimeInitialized = true;
});
client.on('interactionCreate', async (interaction) => {
    const handled = await (0, interactionRouter_1.routeInteraction)(interaction, client, cooldownManager, commandAnalytics);
    if (handled) {
        return;
    }
    if (!interaction.isCommand()) {
        return;
    }
    const command = client.commands.get(interaction.commandName);
    if (!command) {
        logger_1.logger.error(`Command ${interaction.commandName} not found`);
        return;
    }
    const chatInput = interaction;
    await (0, interactionExecutor_1.executeInteraction)({
        interaction: chatInput,
        kind: 'slash',
        analyticsLabel: chatInput.commandName,
        cooldownKey: chatInput.commandName,
        cooldownSeconds: command.cooldown ?? 3,
        cooldownManager,
        commandAnalytics,
        defer: command.defer,
        run: () => command.execute(chatInput),
    });
});
async function registerCommandsGlobally() {
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = getDiscordApplicationClientId();
    if (!token || !clientId) {
        logger_1.logger.error('❌ Missing DISCORD_BOT_TOKEN or a Discord application client ID (DISCORD_BOT_CLIENT_ID or DISCORD_CLIENT_ID) in environment variables');
        return;
    }
    const commands = slashCommands.map(command => command.data.toJSON());
    const commandNames = slashCommands.map(command => `/${command.data.name}`);
    const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
    try {
        logger_1.logger.info('🔄 Started refreshing application (/) commands.');
        logger_1.logger.info(`🧾 Slash commands to register (${commandNames.length}): ${commandNames.join(', ')}`);
        await rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: commands });
        logger_1.logger.info('✅ Successfully reloaded application (/) commands.');
    }
    catch (error) {
        logger_1.logger.error('❌ Error registering commands:', error);
    }
}
async function clearGlobalCommands() {
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = getDiscordApplicationClientId();
    if (!token || !clientId) {
        logger_1.logger.warn('Skipping global command cleanup: missing DISCORD_BOT_TOKEN or bot application client ID');
        return;
    }
    const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
    try {
        await rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: [] });
        logger_1.logger.info('🧹 Cleared global slash commands to prevent duplicate hub entries.');
    }
    catch (error) {
        logger_1.logger.warn('Failed to clear global slash commands (non-fatal):', error);
    }
}
async function registerCommandsForExistingGuilds() {
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = getDiscordApplicationClientId();
    if (!token || !clientId) {
        logger_1.logger.warn('Skipping guild-level command refresh: missing DISCORD_BOT_TOKEN or bot application client ID');
        return;
    }
    const commands = slashCommands.map(command => command.data.toJSON());
    const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
    const guilds = client.guilds.cache.map(g => g);
    for (const guild of guilds) {
        try {
            await rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guild.id), {
                body: commands,
            });
            registeredGuilds.add(guild.id);
            logger_1.logger.info(`✅ Refreshed guild commands for ${guild.name} (${guild.id})`);
        }
        catch (error) {
            logger_1.logger.error(`❌ Failed guild command refresh for ${guild.name} (${guild.id}):`, error);
        }
    }
}
async function startBot() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        logger_1.logger.error('❌ DISCORD_BOT_TOKEN is not set in environment variables');
        return;
    }
    (0, startupValidation_1.validateBotInternalSecret)({
        contextLabel: '❌',
        onFailure: 'throw',
        logSuccess: true,
    });
    try {
        await clientManager.login(token);
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to login to Discord:', error);
        throw error;
    }
}
async function shutdownBotRuntime() {
    if (runtimeShutdownPromise) {
        return runtimeShutdownPromise;
    }
    runtimeShutdownPromise = Promise.resolve()
        .then(async () => {
        if (!botRuntimeInitialized) {
            clearManagedIntervals();
            try {
                messageRelay.dispose();
            }
            catch (error) {
                logger_1.logger.warn('Message relay dispose failed (non-fatal):', error);
            }
            return;
        }
        logger_1.logger.info('🛑 Shutting down bot runtime services...');
        (0, moderationEventHandler_1.stopIncidentExpirationTask)();
        if (ticketAutomationJob) {
            ticketAutomationJob.stop();
            ticketAutomationJob = null;
        }
        if (engagementJobs) {
            engagementJobs.statRoleJob.stop();
            engagementJobs.counterJob.stop();
            engagementJobs.cleanupJob.stop();
            engagementJobs = null;
        }
        clearManagedIntervals();
        try {
            messageRelay.dispose();
        }
        catch (error) {
            logger_1.logger.warn('Message relay dispose failed (non-fatal):', error);
        }
        try {
            tunnelService.destroy();
        }
        catch (error) {
            logger_1.logger.warn('Tunnel service shutdown failed (non-fatal):', error);
        }
        try {
            SmartLfgPingService_1.SmartLfgPingService.getInstance().shutdown();
        }
        catch (error) {
            logger_1.logger.warn('Smart LFG ping shutdown failed (non-fatal):', error);
        }
        try {
            PresenceTrackingService_1.PresenceTrackingService.getInstance().shutdown();
        }
        catch (error) {
            logger_1.logger.warn('Presence tracking shutdown failed (non-fatal):', error);
        }
        try {
            GiveawayService_1.GiveawayService.getInstance().shutdown();
        }
        catch (error) {
            logger_1.logger.warn('Giveaway service shutdown failed (non-fatal):', error);
        }
        try {
            TeamVoiceService_1.TeamVoiceService.getInstance().shutdown();
        }
        catch (error) {
            logger_1.logger.warn('Team voice shutdown failed (non-fatal):', error);
        }
        try {
            const { DiscordAuditLogService } = await Promise.resolve().then(() => __importStar(require('../services/discord/DiscordAuditLogService')));
            DiscordAuditLogService.getInstance().shutdown();
        }
        catch (error) {
            logger_1.logger.warn('Discord audit log shutdown failed (non-fatal):', error);
        }
        try {
            BotPresenceService_1.BotPresenceService.getInstance().shutdown();
        }
        catch (error) {
            logger_1.logger.warn('Bot presence shutdown failed (non-fatal):', error);
        }
        try {
            ChangelogWebhookService_1.ChangelogWebhookService.getInstance().shutdown();
        }
        catch (error) {
            logger_1.logger.warn('Changelog webhook shutdown failed (non-fatal):', error);
        }
        try {
            lfgPresenceMonitor_1.LfgPresenceMonitor.getInstance().shutdown();
        }
        catch (error) {
            logger_1.logger.warn('LFG presence monitor shutdown failed (non-fatal):', error);
        }
        botRuntimeInitialized = false;
        logger_1.logger.info('✅ Bot runtime services stopped');
    })
        .finally(() => {
        runtimeShutdownPromise = null;
    });
    return runtimeShutdownPromise;
}
const registeredGuilds = new Set();
client.on('guildCreate', async (guild) => {
    logger_1.logger.info(`📥 Joined new guild: ${guild.name} (${guild.id})`);
    const mode = getSlashCommandRegistrationMode();
    if (mode === 'global') {
        logger_1.logger.info(`Skipping guild-scoped command registration for ${guild.name} (${guild.id}) because mode is global.`);
        return;
    }
    if (registeredGuilds.has(guild.id)) {
        return;
    }
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = getDiscordApplicationClientId();
    if (!token || !clientId) {
        return;
    }
    try {
        const commands = slashCommands.map(command => command.data.toJSON());
        const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
        await rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guild.id), {
            body: commands,
        });
        registeredGuilds.add(guild.id);
        logger_1.logger.info(`✅ Registered commands for guild: ${guild.name} (${guild.id})`);
    }
    catch (error) {
        logger_1.logger.error(`❌ Failed to register commands for guild ${guild.name}:`, error);
    }
});
client.on('guildDelete', async (guild) => {
    logger_1.logger.warn(`📤 Removed from guild: ${guild.name} (${guild.id})`);
    try {
        const { GuildOrganizationService } = await Promise.resolve().then(() => __importStar(require('../services/discord/GuildOrganizationService')));
        const guildOrgService = GuildOrganizationService.getInstance();
        const deactivated = await guildOrgService.deactivateMapping(guild.id, 'system:bot_removed');
        if (deactivated) {
            logger_1.logger.info(`Deactivated guild-org mapping for removed guild ${guild.id}`);
        }
    }
    catch (error) {
        logger_1.logger.error(`Failed to deactivate mapping for removed guild ${guild.id}:`, error);
    }
});
client.on('guildMemberAdd', async (member) => {
    try {
        const { handleGuildMemberAdd } = await Promise.resolve().then(() => __importStar(require('../services/discord/WelcomeService')));
        await handleGuildMemberAdd(member);
    }
    catch (error) {
        logger_1.logger.error(`Welcome handler error for ${member.user.tag}:`, error);
    }
    try {
        const { FederationRoleSyncService } = await Promise.resolve().then(() => __importStar(require('../services/federation/FederationRoleSyncService')));
        const fedRoleSync = FederationRoleSyncService.getInstance();
        const federation = await fedRoleSync.findFederationByGuildId(member.guild.id);
        if (federation) {
            await fedRoleSync.evaluateNewMember(federation.id, member);
        }
    }
    catch (error) {
        logger_1.logger.error(`Federation role eval error for ${member.user.tag}:`, error);
    }
});
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        const { handleGuildMemberUpdate } = await Promise.resolve().then(() => __importStar(require('../services/discord/WelcomeService')));
        await handleGuildMemberUpdate(oldMember, newMember);
    }
    catch (error) {
        logger_1.logger.error(`Welcome update handler error for ${newMember.user.tag}:`, error);
    }
});
client.on('guildMemberRemove', async (member) => {
    try {
        const { handleGuildMemberRemove } = await Promise.resolve().then(() => __importStar(require('../services/discord/WelcomeService')));
        await handleGuildMemberRemove(member);
    }
    catch (error) {
        logger_1.logger.error(`Goodbye handler error for ${member.user?.tag}:`, error);
    }
});
client.on('roleDelete', async (role) => {
    logger_1.logger.info(`🗑️ Role deleted: ${role.name} (${role.id}) in guild ${role.guild.id}`);
    try {
        const { GuildOrganizationService } = await Promise.resolve().then(() => __importStar(require('../services/discord/GuildOrganizationService')));
        const guildOrgService = GuildOrganizationService.getInstance();
        const orgId = await guildOrgService.resolveOrganization(role.guild.id);
        if (orgId) {
            const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../config/database')));
            const { RsiRoleMapping } = await Promise.resolve().then(() => __importStar(require('../models/RsiRoleMapping')));
            const roleMappingRepo = AppDataSource.getRepository(RsiRoleMapping);
            const affected = await roleMappingRepo.update({ organizationId: orgId, discordRoleId: role.id }, { discordRoleId: undefined });
            if (affected.affected && affected.affected > 0) {
                logger_1.logger.warn(`Cleared ${affected.affected} role mappings referencing deleted Discord role ${role.name} (${role.id})`);
            }
        }
    }
    catch (error) {
        logger_1.logger.error(`Failed to handle roleDelete for ${role.id}:`, error);
    }
});
async function cancelActivityForDiscordEvent(discordEventId, reason) {
    try {
        const cancellation = await getActivityEventService().cancelFromDiscordEvent(discordEventId, reason);
        if (!cancellation) {
            return;
        }
        if (!cancellation.wasCancelled) {
            return;
        }
        logger_1.logger.info(`🔁 Activity ${cancellation.activityId} cancelled via Discord scheduled event ${discordEventId}`);
        try {
            const { emitActivityUpdated } = await Promise.resolve().then(() => __importStar(require('../websocket/controllers/activityWebSocketController')));
            emitActivityUpdated(cancellation.organizationId ?? null, {
                id: cancellation.activityId,
                status: 'cancelled',
                cancelledAt: cancellation.cancelledAt,
                discordEventId: undefined,
            });
        }
        catch {
        }
    }
    catch (error) {
        logger_1.logger.error(`Failed to sync Discord scheduled event ${discordEventId} cancellation to activity:`, error);
    }
}
client.on('guildScheduledEventDelete', async (guildScheduledEvent) => {
    logger_1.logger.info(`🗑️ Discord scheduled event deleted: ${guildScheduledEvent.name} (${guildScheduledEvent.id}) in guild ${guildScheduledEvent.guildId}`);
    await cancelActivityForDiscordEvent(guildScheduledEvent.id, 'Discord scheduled event was deleted');
});
client.on('guildScheduledEventUpdate', async (oldEvent, newEvent) => {
    try {
        const { GuildScheduledEventStatus } = await Promise.resolve().then(() => __importStar(require('discord.js')));
        if (newEvent.status === GuildScheduledEventStatus.Canceled &&
            oldEvent?.status !== GuildScheduledEventStatus.Canceled) {
            logger_1.logger.info(`🛑 Discord scheduled event cancelled: ${newEvent.name} (${newEvent.id}) in guild ${newEvent.guildId}`);
            await cancelActivityForDiscordEvent(newEvent.id, 'Discord scheduled event was cancelled');
        }
    }
    catch (error) {
        logger_1.logger.error(`Failed to handle guildScheduledEventUpdate for ${newEvent.id}:`, error);
    }
});
function logVoiceChannelEvent(channelId, userId, userName, action, guildId, channelName) {
    const managedChannel = voiceChannelService.getChannelByDiscordId(channelId);
    if (managedChannel) {
        voiceChannelService.logActivity(managedChannel.id, userId, userName, action, guildId, channelName);
    }
}
function initializeVoiceStateTracking() {
    client.on('voiceStateUpdate', (oldState, newState) => {
        const userId = newState.id;
        const userName = newState.member?.user.username ?? 'Unknown';
        const guildId = newState.guild.id;
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;
        (0, voiceAutoCreate_1.handleVoiceAutoCreate)(client, oldState, newState).catch(err => logger_1.logger.error('Voice auto-create error:', err));
        (0, voiceAutoCreate_1.handleEventVoiceEmpty)(client, oldState, newState).catch(err => logger_1.logger.error('Event voice empty handler error:', err));
        if (!oldChannelId && newChannelId) {
            logVoiceChannelEvent(newChannelId, userId, userName, 'join', guildId, newState.channel?.name ?? 'Unknown');
            logger_1.logger.info(`🎤 ${userName} joined voice channel: ${newState.channel?.name}`);
            return;
        }
        if (oldChannelId && !newChannelId) {
            logVoiceChannelEvent(oldChannelId, userId, userName, 'leave', guildId, oldState.channel?.name ?? 'Unknown');
            logger_1.logger.info(`🎤 ${userName} left voice channel: ${oldState.channel?.name}`);
            return;
        }
        if (oldChannelId !== newChannelId) {
            if (oldChannelId) {
                logVoiceChannelEvent(oldChannelId, userId, userName, 'leave', guildId, oldState.channel?.name ?? 'Unknown');
            }
            if (newChannelId) {
                logVoiceChannelEvent(newChannelId, userId, userName, 'move', guildId, newState.channel?.name ?? 'Unknown');
            }
            logger_1.logger.info(`🎤 ${userName} moved from ${oldState.channel?.name} to ${newState.channel?.name}`);
        }
    });
}
function initializePresenceMonitor() {
    const monitor = lfgPresenceMonitor_1.LfgPresenceMonitor.getInstance();
    monitor.hydrate().catch(err => logger_1.logger.warn('Failed to hydrate LFG presence opt-ins:', err));
    client.on('presenceUpdate', (oldPresence, newPresence) => {
        if (!newPresence) {
            return;
        }
        monitor
            .handlePresenceUpdate(oldPresence, newPresence, client)
            .catch(err => logger_1.logger.error('LFG presence monitor error:', err));
    });
    registerManagedInterval(setInterval(() => {
        monitor.cleanupCooldowns();
    }, 60 * 60 * 1000));
}
function startVoiceChannelCleanup() {
    registerManagedInterval(setInterval(async () => {
        try {
            const expiredChannels = voiceChannelService.cleanupExpiredChannels();
            if (expiredChannels.length > 0) {
                logger_1.logger.info(`🧹 Cleaned up ${expiredChannels.length} expired voice channel(s)`);
                for (const channelId of expiredChannels) {
                    try {
                        (0, voiceAutoCreate_1.getChannelOwners)().delete(channelId);
                        const guilds = client.guilds.cache;
                        for (const guild of guilds.values()) {
                            const channel = await guild.channels.fetch(channelId).catch(() => null);
                            if (channel) {
                                await channel.delete('Expired temporary voice channel');
                                logger_1.logger.info(`🗑️ Deleted expired voice channel: ${channel.name}`);
                            }
                        }
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to delete expired channel ${channelId}:`, error);
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error during voice channel cleanup:', error);
        }
    }, 60 * 60 * 1000));
}
function startCooldownCleanup() {
    registerManagedInterval(setInterval(() => {
        try {
            cooldownManager.cleanupExpired();
        }
        catch (error) {
            logger_1.logger.error('Error during cooldown cleanup:', error);
        }
    }, 15 * 60 * 1000));
}
function startAnalyticsCleanup() {
    registerManagedInterval(setInterval(() => {
        try {
            commandAnalytics.clearOldData(30);
        }
        catch (error) {
            logger_1.logger.error('Error during analytics cleanup:', error);
        }
    }, 24 * 60 * 60 * 1000));
}
if (require.main === module || process.env.SHARDING_MANAGER) {
    (async () => {
        if (process.env.SHARDING_MANAGER) {
            const { initializeDatabase } = await Promise.resolve().then(() => __importStar(require('../config/database')));
            await initializeDatabase();
            logger_1.logger.info(`[Shard ${process.env.SHARDS}] Database initialized`);
            try {
                const { initializeDomainEventBridge } = await Promise.resolve().then(() => __importStar(require('../services/shared/DomainEventBridge')));
                await initializeDomainEventBridge();
                logger_1.logger.info(`[Shard ${process.env.SHARDS}] DomainEventBridge initialized`);
            }
            catch {
                logger_1.logger.warn(`[Shard ${process.env.SHARDS}] DomainEventBridge init failed (non-fatal)`);
            }
        }
        await startBot();
    })().catch(error => {
        logger_1.logger.error('Fatal error starting bot:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=botApp.js.map