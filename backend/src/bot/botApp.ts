import { ChatInputCommandInteraction, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

import { startDiscordReconciliationJob } from '../jobs/discordReconciliationJob';
import { startFailedDmRetryJob } from '../jobs/retryFailedDms';
import {
  ActivityEventService,
  type DiscordEventCancellationResult,
} from '../services/activity/ActivityEventService';
import { VoiceChannelService } from '../services/communication';
import { BotPresenceService } from '../services/discord/BotPresenceService';
import { ChangelogWebhookService } from '../services/discord/ChangelogWebhookService';
import { DmNotificationService } from '../services/discord/DmNotificationService';
import { EmbedBuilderService } from '../services/discord/EmbedBuilderService';
import { GiveawayService } from '../services/discord/GiveawayService';
import { PresenceTrackingService } from '../services/discord/PresenceTrackingService';
import { ReactionRoleService } from '../services/discord/ReactionRoleService';
import { SmartLfgPingService } from '../services/discord/SmartLfgPingService';
import { TeamVoiceService } from '../services/discord/TeamVoiceService';
import { TicketAutomationJob } from '../services/discord/TicketAutomationService';
import { TicketTranscriptService } from '../services/discord/TicketTranscriptService';
import { TunnelService } from '../services/discord/TunnelService';
import { logger } from '../utils/logger';

import { BotClientManager } from './BotClientManager';
import { BotIPCService } from './BotIPCService';
import { analytics } from './commands/analytics';
import { announce } from './commands/announce';
import { attendanceCommand as attend } from './commands/attend';
import { bounty } from './commands/bounty';
import { briefing } from './commands/briefing';
import { commlink } from './commands/commlink';
import { community } from './commands/community';
import { diplomacy } from './commands/diplomacy';
import { discover } from './commands/discover';
import { embed } from './commands/embed';
import { events } from './commands/events';
import { faq } from './commands/faq';
import { federation } from './commands/federation';
import { giveaway } from './commands/giveaway';
import { guild } from './commands/guild';
import { help } from './commands/help';
import { hunter } from './commands/hunter';
import { BotCommand } from './commands/index';
import { lfg } from './commands/lfg';
import { mission } from './commands/mission';
import { moderation } from './commands/moderation';
import { notify } from './commands/notify';
import { org } from './commands/org';
import { ping } from './commands/ping';
import { poll } from './commands/poll';
import { readycheck } from './commands/readycheck';
import { recruitment } from './commands/recruitment';
import { reminder } from './commands/reminder';
import { roles } from './commands/roles';
import { restoreRsiStatusChannels, restoreRsiStatusPanels, rsistatus } from './commands/rsistatus';
import { rsisync } from './commands/rsisync';
import { schedule } from './commands/schedule';
import { stats } from './commands/stats';
import { ticket } from './commands/ticket';
import { user } from './commands/user';
import { verify } from './commands/verify';
import { voice } from './commands/voice';
import { wiki } from './commands/wiki';
import { TOP_LEVEL_SLASH_COMMAND_NAMES } from './constants/slashRoots';
import {
  ChannelCounterUpdateJob,
  EngagementCleanupJob,
  StatRoleEvaluationJob,
} from './engagement/engagementJobs';
import { initializeEngagementTracking } from './engagement/engagementTracker';
import { initializeGuildMemberHandler } from './guildMemberIpcHandler';
import { routeInteraction } from './interactionRouter';
import { registerActivityDiscordLifecycleListeners } from './listeners/activityDiscordLifecycleListener';
import { MessageRelay } from './messageRelay';
import { initializeMirrorSyncHandler } from './mirrorSync';
import {
  initializeModerationEventHandlers,
  startIncidentExpirationTask,
  stopIncidentExpirationTask,
} from './moderationEventHandler';
import { initializeRecruitmentRoleHandler } from './recruitmentRoleHandler';
import { initializeRoleIpcHandler } from './roleIpcHandler';
import { initializeRsiStatusIpcHandler } from './rsiStatusIpcHandler';
import { CommandAnalytics } from './utils/commandAnalytics';
import { CooldownManager } from './utils/cooldownManager';
import { executeInteraction } from './utils/interactionExecutor';
import { validateBotInternalSecret } from './utils/startupValidation';
import { LfgPresenceMonitor } from './voice/lfgPresenceMonitor';
import {
  getChannelOwners,
  handleEventVoiceEmpty,
  handleVoiceAutoCreate,
  reconcileDynamicChannels,
} from './voice/voiceAutoCreate';

dotenv.config();

// Extend the Client type to include commands
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, BotCommand>;
  }
}

// Use BotClientManager for the single unified Client instance (Wave 1.9)
const clientManager = BotClientManager.getInstance();
const client = clientManager.getClient();

// Initialize commands collection
client.commands = new Collection();

// ── Slash commands visible in the / menu ─────────────────────
const topLevelSlashCommandMap: Record<(typeof TOP_LEVEL_SLASH_COMMAND_NAMES)[number], BotCommand> =
  {
    user,
    org,
    federation,
  };

const slashCommands: BotCommand[] = TOP_LEVEL_SLASH_COMMAND_NAMES.map(
  commandName => topLevelSlashCommandMap[commandName]
);

// ── Panel-only commands (not in / menu, reachable via buttons) ──
const panelOnlyCommands: BotCommand[] = [
  // Demoted from top-level slash commands (reachable via /user, /org, /federation)
  ping,
  help,
  events,
  lfg,
  bounty,
  mission,
  announce,
  ticket,
  recruitment,
  stats,
  verify,
  moderation,
  notify,
  voice,
  commlink,
  community,
  analytics,
  rsistatus,
  rsisync,
  // Folded into /events panel
  attend,
  schedule,
  reminder,
  // Folded into /bounty panel
  hunter,
  // Folded into /mission panel
  briefing,
  // Folded into /help > More Features
  discover,
  faq,
  // Admin / setup (one-time use)
  embed,
  roles,
  guild,
  // Niche (accessible via related panels or web settings)
  poll,
  wiki,
  diplomacy,
  giveaway,
  readycheck,
];

// All commands registered for interaction routing (buttons, modals, selects)
const allCommands: BotCommand[] = [...slashCommands, ...panelOnlyCommands];

allCommands.forEach(command => {
  client.commands.set(command.data.name, command);
});

// Initialize tunnel service and message relay
const tunnelService = TunnelService.getInstance();
const messageRelay = new MessageRelay(client, tunnelService);

// Initialize voice channel service
const voiceChannelService = VoiceChannelService.getInstance();
let activityEventService: ActivityEventService | null = null;

function getActivityEventService(): ActivityEventService {
  activityEventService ??= new ActivityEventService();

  return activityEventService;
}

// Initialize cooldown and analytics managers
const cooldownManager = CooldownManager.getInstance();
const commandAnalytics = CommandAnalytics.getInstance();

const managedIntervals = new Set<ReturnType<typeof setInterval>>();

let ticketAutomationJob: TicketAutomationJob | null = null;
let engagementJobs: {
  statRoleJob: StatRoleEvaluationJob;
  counterJob: ChannelCounterUpdateJob;
  cleanupJob: EngagementCleanupJob;
} | null = null;
let botRuntimeInitialized = false;
let runtimeShutdownPromise: Promise<void> | null = null;

function registerManagedInterval(
  interval: ReturnType<typeof setInterval>
): ReturnType<typeof setInterval> {
  managedIntervals.add(interval);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }
  return interval;
}

function clearManagedIntervals(): void {
  for (const interval of managedIntervals) {
    clearInterval(interval);
  }
  managedIntervals.clear();
}

function getDiscordApplicationClientId(): string | undefined {
  return process.env.DISCORD_BOT_CLIENT_ID ?? process.env.DISCORD_CLIENT_ID;
}

type SlashCommandRegistrationMode = 'guild' | 'global' | 'both';

function getSlashCommandRegistrationMode(): SlashCommandRegistrationMode {
  const rawMode = process.env.DISCORD_SLASH_COMMAND_REGISTRATION_MODE?.trim().toLowerCase();

  if (rawMode === 'global' || rawMode === 'both' || rawMode === 'guild') {
    return rawMode;
  }

  if (rawMode) {
    logger.warn(
      `Invalid DISCORD_SLASH_COMMAND_REGISTRATION_MODE="${rawMode}". Falling back to "guild".`
    );
  }

  return 'guild';
}

async function registerSlashCommands(): Promise<void> {
  const mode = getSlashCommandRegistrationMode();
  logger.info(`🧭 Slash command registration mode: ${mode}`);

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

// Ready event
client.once('clientReady', async () => {
  logger.info(`✅ Discord Bot logged in as ${client.user?.tag}`);
  logger.info(`🤖 Bot is active in ${client.guilds.cache.size} guilds`);

  // Register slash commands in configured mode (guild by default).
  await registerSlashCommands();

  // Initialize Redis IPC for bot↔Express communication (Wave 1.9)
  const ipcService = BotIPCService.getInstance();
  await ipcService
    .initialize()
    .catch(err => logger.warn('BotIPCService: Failed to initialize (non-fatal):', err));

  // Initialize event mirror RSVP sync handler (Wave 1.8)
  initializeMirrorSyncHandler(ipcService, client);

  // Initialize guild member fetch IPC handler (enables presence queries from Express)
  initializeGuildMemberHandler(ipcService, client);

  // Initialize role assign/remove IPC handler (enables worker → bot role management)
  initializeRoleIpcHandler(ipcService, client);

  // Initialize RSI status IPC handler (enables API → bot RSI panel/channel operations)
  initializeRsiStatusIpcHandler(ipcService, client);

  // Initialize tunnel service (pre-populates in-memory cache from DB)
  await tunnelService
    .initialize()
    .catch(err => logger.warn('TunnelService: Failed to initialize (non-fatal):', err));
  logger.info('🌉 Tunnel service initialized');

  // Initialize message relay for tunnels
  messageRelay.initialize();
  logger.info('🌉 Tunnel message relay initialized');

  // Initialize voice state tracking
  initializeVoiceStateTracking();
  logger.info('🎤 Voice state tracking initialized');

  // Restore RSI Status panels from Redis (survives bot restarts)
  await restoreRsiStatusPanels().catch(err =>
    logger.warn('RSI Status panel restoration failed (non-fatal):', err)
  );

  // Restore RSI Status channels (auto-updating channel-name indicators)
  await restoreRsiStatusChannels().catch(err =>
    logger.warn('RSI Status channel restoration failed (non-fatal):', err)
  );

  // Initialize automatic LFG presence monitoring
  initializePresenceMonitor();
  logger.info('🤖 LFG presence monitor initialized');

  // Initialize moderation event handlers for automatic incident detection
  initializeModerationEventHandlers(client);

  // Initialize recruitment role auto-resolve handler
  initializeRecruitmentRoleHandler();

  // Start cleanup interval for expired voice channels
  startVoiceChannelCleanup();
  logger.info('🧹 Voice channel cleanup task started');

  // Start cooldown cleanup task
  startCooldownCleanup();
  logger.info('🧹 Cooldown cleanup task started');

  // Start analytics cleanup task
  startAnalyticsCleanup();
  logger.info('🧹 Analytics cleanup task started');

  // Start incident expiration task
  startIncidentExpirationTask();

  // Initialize engagement tracking (messages, voice sessions, invite tracking)
  initializeEngagementTracking(client);

  // Start engagement background jobs (stat roles, channel counters, cleanup)
  const statRoleJob = new StatRoleEvaluationJob(client);
  statRoleJob.start();
  const counterJob = new ChannelCounterUpdateJob(client);
  counterJob.start();
  const cleanupJob = new EngagementCleanupJob();
  cleanupJob.start();
  engagementJobs = { statRoleJob, counterJob, cleanupJob };

  // Reconcile voice auto-create state after restart (Issue #10)
  const guildIds = client.guilds.cache.map(g => g.id);
  reconcileDynamicChannels(guildIds);

  // Phase 4: Initialize automation & polish services
  DmNotificationService.getInstance().initialize(client);
  TicketTranscriptService.getInstance().initialize(client);
  SmartLfgPingService.getInstance().initialize(client);
  ticketAutomationJob = new TicketAutomationJob(client);
  ticketAutomationJob.start();
  // Persistent DM retry queue — must start AFTER DmNotificationService.initialize
  // (the job invokes the service which requires a Discord client). The interval
  // is unref'd inside startFailedDmRetryJob, so it does not need explicit cleanup.
  registerManagedInterval(startFailedDmRetryJob());
  // Periodic member/role reconciliation — detects and corrects drift from missed events
  registerManagedInterval(startDiscordReconciliationJob());
  logger.info(
    '🔔 Phase 4 services initialized (DM, Transcripts, Automation, Smart Ping, DM Retry Queue, Reconciliation)'
  );

  // Phase 5+: Initialize gap-analysis feature services
  PresenceTrackingService.getInstance().initialize(client);
  GiveawayService.getInstance().initialize(client);
  ReactionRoleService.getInstance().initialize(client);
  EmbedBuilderService.getInstance().initialize();
  logger.info(
    '📊 Phase 5+ services initialized (Presence Tracking, Giveaways, Reaction Roles, Embed Builder)'
  );

  // Bot Rich Presence: rotate platform stats (users, orgs, federations, opportunities)
  BotPresenceService.getInstance().initialize(client);

  // Changelog Webhook: auto-post newly added changelog entries to Discord webhook
  ChangelogWebhookService.getInstance().initialize();

  // Team Voice: listen to team domain events for Discord channel lifecycle
  TeamVoiceService.getInstance().initialize(client);
  logger.info('🎙️ Team Voice service initialized');

  // Audit Log: register message/role/channel event listeners
  const { DiscordAuditLogService } = await import('../services/discord/DiscordAuditLogService');
  DiscordAuditLogService.getInstance().initialize(client);
  logger.info('📋 Audit Log service initialized');

  // Initialize Discord Scheduled Event service
  try {
    const { DiscordEventService } = await import('../services/discord/DiscordEventService');
    DiscordEventService.getInstance().initialize(client);
    logger.info('📅 Discord Scheduled Event service initialized');
  } catch {
    // Non-fatal
  }

  // Event archive + activity lifecycle synchronization (activity ↔ Discord)
  try {
    registerActivityDiscordLifecycleListeners(client, voiceChannelService);
  } catch (err) {
    logger.warn('Failed to register activity lifecycle listeners', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Phase 3.1: Activity announcements — post embed to org's configured
  // event-announcement channel on activity:created/cancelled/rescheduled.
  try {
    const { registerActivityAnnouncementListeners } = await import('./listeners/activityListener');
    registerActivityAnnouncementListeners(client);
  } catch (err) {
    logger.warn('Failed to register activity announcement listeners', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Phase 3.4: Platform → Discord role sync (additive).
  try {
    const { registerRoleSyncListener } = await import('./listeners/roleSyncListener');
    registerRoleSyncListener(client);
  } catch (err) {
    logger.warn('Failed to register role sync listener', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Notification Preferences: join/leave/role-change posts from Discord settings toggles.
  try {
    const { registerNotificationPreferenceListener } =
      await import('./listeners/notificationPreferenceListener');
    registerNotificationPreferenceListener(client);
  } catch (err) {
    logger.warn('Failed to register notification preference listener', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  botRuntimeInitialized = true;
});

// Interaction handler
client.on('interactionCreate', async interaction => {
  // Route non-command interactions (buttons, modals, select menus) first
  const handled = await routeInteraction(interaction, client, cooldownManager, commandAnalytics);
  if (handled) {
    return;
  }

  if (!interaction.isCommand()) {
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.error(`Command ${interaction.commandName} not found`);
    return;
  }

  // Slash commands share the same execution policy (cooldown → run → telemetry)
  // as buttons/modals/selects via the shared executor (C1).
  const chatInput = interaction as ChatInputCommandInteraction;
  await executeInteraction({
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

// Register commands with Discord globally
async function registerCommandsGlobally(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = getDiscordApplicationClientId();

  if (!token || !clientId) {
    logger.error(
      '❌ Missing DISCORD_BOT_TOKEN or a Discord application client ID (DISCORD_BOT_CLIENT_ID or DISCORD_CLIENT_ID) in environment variables'
    );
    return;
  }

  const commands = slashCommands.map(command => command.data.toJSON());
  const commandNames = slashCommands.map(command => `/${command.data.name}`);

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    logger.info('🔄 Started refreshing application (/) commands.');
    logger.info(
      `🧾 Slash commands to register (${commandNames.length}): ${commandNames.join(', ')}`
    );

    // Register commands globally
    await rest.put(Routes.applicationCommands(clientId), { body: commands });

    logger.info('✅ Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('❌ Error registering commands:', error);
  }
}

async function clearGlobalCommands(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = getDiscordApplicationClientId();

  if (!token || !clientId) {
    logger.warn(
      'Skipping global command cleanup: missing DISCORD_BOT_TOKEN or bot application client ID'
    );
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    logger.info('🧹 Cleared global slash commands to prevent duplicate hub entries.');
  } catch (error) {
    logger.warn('Failed to clear global slash commands (non-fatal):', error);
  }
}

async function registerCommandsForExistingGuilds(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = getDiscordApplicationClientId();

  if (!token || !clientId) {
    logger.warn(
      'Skipping guild-level command refresh: missing DISCORD_BOT_TOKEN or bot application client ID'
    );
    return;
  }

  const commands = slashCommands.map(command => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(token);
  const guilds = client.guilds.cache.map(g => g);

  for (const guild of guilds) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
        body: commands,
      });
      registeredGuilds.add(guild.id);
      logger.info(`✅ Refreshed guild commands for ${guild.name} (${guild.id})`);
    } catch (error) {
      logger.error(`❌ Failed guild command refresh for ${guild.name} (${guild.id}):`, error);
    }
  }
}

// Start the bot — uses BotClientManager for unified client (Wave 1.9)
export async function startBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    logger.error('❌ DISCORD_BOT_TOKEN is not set in environment variables');
    return;
  }

  validateBotInternalSecret({
    contextLabel: '❌',
    onFailure: 'throw',
    logSuccess: true,
  });

  try {
    await clientManager.login(token);
  } catch (error: unknown) {
    logger.error('❌ Failed to login to Discord:', error);
    throw error;
  }
}

/**
 * Stop timers and jobs started by bot runtime initialization.
 * Safe to call multiple times.
 */
export async function shutdownBotRuntime(): Promise<void> {
  if (runtimeShutdownPromise) {
    return runtimeShutdownPromise;
  }

  runtimeShutdownPromise = Promise.resolve()
    .then(async () => {
      if (!botRuntimeInitialized) {
        clearManagedIntervals();

        try {
          messageRelay.dispose();
        } catch (error) {
          logger.warn('Message relay dispose failed (non-fatal):', error);
        }

        return;
      }

      logger.info('🛑 Shutting down bot runtime services...');

      stopIncidentExpirationTask();

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
      } catch (error) {
        logger.warn('Message relay dispose failed (non-fatal):', error);
      }

      try {
        tunnelService.destroy();
      } catch (error) {
        logger.warn('Tunnel service shutdown failed (non-fatal):', error);
      }

      try {
        SmartLfgPingService.getInstance().shutdown();
      } catch (error) {
        logger.warn('Smart LFG ping shutdown failed (non-fatal):', error);
      }

      try {
        PresenceTrackingService.getInstance().shutdown();
      } catch (error) {
        logger.warn('Presence tracking shutdown failed (non-fatal):', error);
      }

      try {
        GiveawayService.getInstance().shutdown();
      } catch (error) {
        logger.warn('Giveaway service shutdown failed (non-fatal):', error);
      }

      try {
        TeamVoiceService.getInstance().shutdown();
      } catch (error) {
        logger.warn('Team voice shutdown failed (non-fatal):', error);
      }

      try {
        const { DiscordAuditLogService } =
          await import('../services/discord/DiscordAuditLogService');
        DiscordAuditLogService.getInstance().shutdown();
      } catch (error) {
        logger.warn('Discord audit log shutdown failed (non-fatal):', error);
      }

      try {
        BotPresenceService.getInstance().shutdown();
      } catch (error) {
        logger.warn('Bot presence shutdown failed (non-fatal):', error);
      }

      try {
        ChangelogWebhookService.getInstance().shutdown();
      } catch (error) {
        logger.warn('Changelog webhook shutdown failed (non-fatal):', error);
      }

      try {
        LfgPresenceMonitor.getInstance().shutdown();
      } catch (error) {
        logger.warn('LFG presence monitor shutdown failed (non-fatal):', error);
      }

      botRuntimeInitialized = false;
      logger.info('✅ Bot runtime services stopped');
    })
    .finally(() => {
      runtimeShutdownPromise = null;
    });

  return runtimeShutdownPromise;
}

/**
 * Per-guild command registration on guildCreate (Wave 1.9).
 * When the bot joins a new guild, immediately register commands there
 * so they're available instantly (no 1-hour global propagation delay).
 *
 * NOTE: `registeredGuilds` is an in-memory cache only and is intentionally
 * not persisted across bot restarts. On process restart this Set is cleared,
 * so the bot may attempt to re-register commands for guilds it already
 * registered in the past. Discord's application command APIs are idempotent,
 * so duplicate registrations are safe; this design trades a small number of
 * extra API calls during startup for simpler implementation. If this becomes
 * a scalability concern, consider persisting this Set (e.g. Redis/DB).
 */
const registeredGuilds = new Set<string>();

client.on('guildCreate', async guild => {
  logger.info(`📥 Joined new guild: ${guild.name} (${guild.id})`);

  const mode = getSlashCommandRegistrationMode();
  if (mode === 'global') {
    logger.info(
      `Skipping guild-scoped command registration for ${guild.name} (${guild.id}) because mode is global.`
    );
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
    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
      body: commands,
    });

    registeredGuilds.add(guild.id);
    logger.info(`✅ Registered commands for guild: ${guild.name} (${guild.id})`);
  } catch (error) {
    logger.error(`❌ Failed to register commands for guild ${guild.name}:`, error);
  }
});

/**
 * Handle bot removal from a guild.
 * Deactivates the GuildOrganization mapping and logs the event.
 */
client.on('guildDelete', async guild => {
  logger.warn(`📤 Removed from guild: ${guild.name} (${guild.id})`);

  try {
    const { GuildOrganizationService } =
      await import('../services/discord/GuildOrganizationService');
    const guildOrgService = GuildOrganizationService.getInstance();
    const deactivated = await guildOrgService.deactivateMapping(guild.id, 'system:bot_removed');
    if (deactivated) {
      logger.info(`Deactivated guild-org mapping for removed guild ${guild.id}`);
    }
  } catch (error) {
    logger.error(`Failed to deactivate mapping for removed guild ${guild.id}:`, error);
  }
});

/**
 * Handle new member joins — send welcome messages and assign auto-roles.
 */
client.on('guildMemberAdd', async member => {
  try {
    const { handleGuildMemberAdd } = await import('../services/discord/WelcomeService');
    await handleGuildMemberAdd(member);
  } catch (error) {
    logger.error(`Welcome handler error for ${member.user.tag}:`, error);
  }

  // Federation role evaluation — check if this guild is a federation central server
  try {
    const { FederationRoleSyncService } =
      await import('../services/federation/FederationRoleSyncService');
    const fedRoleSync = FederationRoleSyncService.getInstance();
    const federation = await fedRoleSync.findFederationByGuildId(member.guild.id);
    if (federation) {
      await fedRoleSync.evaluateNewMember(federation.id, member);
    }
  } catch (error) {
    logger.error(`Federation role eval error for ${member.user.tag}:`, error);
  }
});

/**
 * Handle member updates — assign delayed onboarding auto-roles when rules are accepted.
 */
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const { handleGuildMemberUpdate } = await import('../services/discord/WelcomeService');
    await handleGuildMemberUpdate(oldMember, newMember);
  } catch (error) {
    logger.error(`Welcome update handler error for ${newMember.user.tag}:`, error);
  }
});

/**
 * Handle member leave — send goodbye messages.
 */
client.on('guildMemberRemove', async member => {
  try {
    const { handleGuildMemberRemove } = await import('../services/discord/WelcomeService');
    await handleGuildMemberRemove(member);
  } catch (error) {
    logger.error(`Goodbye handler error for ${member.user?.tag}:`, error);
  }
});

/**
 * Handle role deletion in a guild.
 * Clears any references to the deleted role in org settings.
 */
client.on('roleDelete', async role => {
  logger.info(`🗑️ Role deleted: ${role.name} (${role.id}) in guild ${role.guild.id}`);

  try {
    const { GuildOrganizationService } =
      await import('../services/discord/GuildOrganizationService');
    const guildOrgService = GuildOrganizationService.getInstance();
    const orgId = await guildOrgService.resolveOrganization(role.guild.id);
    if (orgId) {
      // Clear any role mappings that reference this deleted role
      const { AppDataSource } = await import('../config/database');
      const { RsiRoleMapping } = await import('../models/RsiRoleMapping');
      const roleMappingRepo = AppDataSource.getRepository(RsiRoleMapping);
      const affected = await roleMappingRepo.update(
        { organizationId: orgId, discordRoleId: role.id },
        { discordRoleId: undefined }
      );
      if (affected.affected && affected.affected > 0) {
        logger.warn(
          `Cleared ${affected.affected} role mappings referencing deleted Discord role ${role.name} (${role.id})`
        );
      }
    }
  } catch (error) {
    logger.error(`Failed to handle roleDelete for ${role.id}:`, error);
  }
});

/**
 * Bidirectional sync: when a Discord scheduled event is deleted directly in
 * Discord, cancel the matching activity in the app so the two stay in sync.
 */
async function cancelActivityForDiscordEvent(
  discordEventId: string,
  reason: string
): Promise<void> {
  try {
    const cancellation: DiscordEventCancellationResult | null =
      await getActivityEventService().cancelFromDiscordEvent(discordEventId, reason);
    if (!cancellation) {
      return;
    }

    if (!cancellation.wasCancelled) {
      return;
    }

    logger.info(
      `🔁 Activity ${cancellation.activityId} cancelled via Discord scheduled event ${discordEventId}`
    );

    // Push websocket update so any open clients see the cancellation immediately
    try {
      const { emitActivityUpdated } =
        await import('../websocket/controllers/activityWebSocketController');
      emitActivityUpdated(cancellation.organizationId ?? null, {
        id: cancellation.activityId,
        status: 'cancelled',
        cancelledAt: cancellation.cancelledAt,
        discordEventId: undefined,
      });
    } catch {
      // Non-fatal
    }
  } catch (error) {
    logger.error(
      `Failed to sync Discord scheduled event ${discordEventId} cancellation to activity:`,
      error
    );
  }
}

client.on('guildScheduledEventDelete', async guildScheduledEvent => {
  logger.info(
    `🗑️ Discord scheduled event deleted: ${guildScheduledEvent.name} (${guildScheduledEvent.id}) in guild ${guildScheduledEvent.guildId}`
  );
  await cancelActivityForDiscordEvent(
    guildScheduledEvent.id,
    'Discord scheduled event was deleted'
  );
});

client.on('guildScheduledEventUpdate', async (oldEvent, newEvent) => {
  // Only react when status transitions into Canceled (Discord spelling)
  try {
    const { GuildScheduledEventStatus } = await import('discord.js');
    if (
      newEvent.status === GuildScheduledEventStatus.Canceled &&
      oldEvent?.status !== GuildScheduledEventStatus.Canceled
    ) {
      logger.info(
        `🛑 Discord scheduled event cancelled: ${newEvent.name} (${newEvent.id}) in guild ${newEvent.guildId}`
      );
      await cancelActivityForDiscordEvent(newEvent.id, 'Discord scheduled event was cancelled');
    }
  } catch (error) {
    logger.error(`Failed to handle guildScheduledEventUpdate for ${newEvent.id}:`, error);
  }
});

// Helper: Log a voice channel activity if the channel is managed
function logVoiceChannelEvent(
  channelId: string,
  userId: string,
  userName: string,
  action: 'join' | 'leave' | 'move',
  guildId: string,
  channelName: string
): void {
  const managedChannel = voiceChannelService.getChannelByDiscordId(channelId);
  if (managedChannel) {
    voiceChannelService.logActivity(
      managedChannel.id,
      userId,
      userName,
      action,
      guildId,
      channelName
    );
  }
}

// Initialize voice state tracking
function initializeVoiceStateTracking(): void {
  client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.id;
    const userName = newState.member?.user.username ?? 'Unknown';
    const guildId = newState.guild.id;
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // Voice auto-create: handle hub join → create temp channel, auto-delete empty channels
    handleVoiceAutoCreate(client, oldState, newState).catch(err =>
      logger.error('Voice auto-create error:', err)
    );

    // Event voice channels: auto-delete when empty based on event timing
    handleEventVoiceEmpty(client, oldState, newState).catch(err =>
      logger.error('Event voice empty handler error:', err)
    );

    // User joined a voice channel
    if (!oldChannelId && newChannelId) {
      logVoiceChannelEvent(
        newChannelId,
        userId,
        userName,
        'join',
        guildId,
        newState.channel?.name ?? 'Unknown'
      );
      logger.info(`🎤 ${userName} joined voice channel: ${newState.channel?.name}`);
      return;
    }

    // User left a voice channel
    if (oldChannelId && !newChannelId) {
      logVoiceChannelEvent(
        oldChannelId,
        userId,
        userName,
        'leave',
        guildId,
        oldState.channel?.name ?? 'Unknown'
      );
      logger.info(`🎤 ${userName} left voice channel: ${oldState.channel?.name}`);
      return;
    }

    // User moved between voice channels
    if (oldChannelId !== newChannelId) {
      if (oldChannelId) {
        logVoiceChannelEvent(
          oldChannelId,
          userId,
          userName,
          'leave',
          guildId,
          oldState.channel?.name ?? 'Unknown'
        );
      }
      if (newChannelId) {
        logVoiceChannelEvent(
          newChannelId,
          userId,
          userName,
          'move',
          guildId,
          newState.channel?.name ?? 'Unknown'
        );
      }
      logger.info(
        `🎤 ${userName} moved from ${oldState.channel?.name} to ${newState.channel?.name}`
      );
    }
  });
}

// Initialize automatic LFG presence monitoring
function initializePresenceMonitor(): void {
  const monitor = LfgPresenceMonitor.getInstance();

  // Restore persisted auto-LFG opt-ins so they survive bot restarts/deploys.
  monitor.hydrate().catch(err => logger.warn('Failed to hydrate LFG presence opt-ins:', err));

  client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (!newPresence) {
      return;
    }
    monitor
      .handlePresenceUpdate(oldPresence, newPresence, client)
      .catch(err => logger.error('LFG presence monitor error:', err));
  });

  // Periodically clean up stale cooldowns
  registerManagedInterval(
    setInterval(
      () => {
        monitor.cleanupCooldowns();
      },
      60 * 60 * 1000
    )
  ); // Every hour
}

// Start cleanup task for expired voice channels
function startVoiceChannelCleanup(): void {
  // Run cleanup every hour
  registerManagedInterval(
    setInterval(
      async () => {
        try {
          const expiredChannels = voiceChannelService.cleanupExpiredChannels();

          if (expiredChannels.length > 0) {
            logger.info(`🧹 Cleaned up ${expiredChannels.length} expired voice channel(s)`);

            // Delete the actual Discord channels
            for (const channelId of expiredChannels) {
              try {
                // Clean up channel owners tracking
                getChannelOwners().delete(channelId);

                const guilds = client.guilds.cache;
                for (const guild of guilds.values()) {
                  const channel = await guild.channels.fetch(channelId).catch(() => null);
                  if (channel) {
                    await channel.delete('Expired temporary voice channel');
                    logger.info(`🗑️ Deleted expired voice channel: ${channel.name}`);
                  }
                }
              } catch (error) {
                logger.error(`Failed to delete expired channel ${channelId}:`, error);
              }
            }
          }
        } catch (error) {
          logger.error('Error during voice channel cleanup:', error);
        }
      },
      60 * 60 * 1000
    )
  ); // Run every hour
}

// Start cleanup task for expired cooldowns
function startCooldownCleanup(): void {
  // Run cleanup every 15 minutes
  registerManagedInterval(
    setInterval(
      () => {
        try {
          cooldownManager.cleanupExpired();
        } catch (error) {
          logger.error('Error during cooldown cleanup:', error);
        }
      },
      15 * 60 * 1000
    )
  ); // Run every 15 minutes
}

// Start cleanup task for old analytics data
function startAnalyticsCleanup(): void {
  // Run cleanup once per day
  registerManagedInterval(
    setInterval(
      () => {
        try {
          // Keep last 30 days of analytics
          commandAnalytics.clearOldData(30);
        } catch (error) {
          logger.error('Error during analytics cleanup:', error);
        }
      },
      24 * 60 * 60 * 1000
    )
  ); // Run once per day
}

// Allow running the bot standalone or as a shard child process
// When spawned by ShardingManager, process.env.SHARDING_MANAGER is set by discord.js
if (require.main === module || process.env.SHARDING_MANAGER) {
  (async () => {
    // Shard child processes need their own DB + DomainEventBridge init
    // (parent process doesn't init these — ShardingManager only manages lifecycle)
    if (process.env.SHARDING_MANAGER) {
      const { initializeDatabase } = await import('../config/database');
      await initializeDatabase();
      logger.info(`[Shard ${process.env.SHARDS}] Database initialized`);

      try {
        const { initializeDomainEventBridge } =
          await import('../services/shared/DomainEventBridge');
        await initializeDomainEventBridge();
        logger.info(`[Shard ${process.env.SHARDS}] DomainEventBridge initialized`);
      } catch {
        logger.warn(`[Shard ${process.env.SHARDS}] DomainEventBridge init failed (non-fatal)`);
      }
    }

    await startBot();
  })().catch(error => {
    logger.error('Fatal error starting bot:', error);
    process.exit(1);
  });
}

export { client };
