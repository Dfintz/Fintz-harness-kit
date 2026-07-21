import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { MirrorAction, MirrorActionType } from '../../models/MirrorAction';
import { IncidentStatus, IncidentType } from '../../models/ModerationIncident';
import { BlacklistAnalyticsService } from '../../services/discord/BlacklistAnalyticsService';
import {
  BlacklistSharingService,
  UpdateSharingConfigDTO,
} from '../../services/discord/BlacklistSharingService';
import { MirrorActionService } from '../../services/discord/MirrorActionService';
import { ModerationIncidentService } from '../../services/discord/ModerationIncidentService';
import {
  buildAlliedAlertsEmbed,
  buildBulkMirrorSummaryEmbed,
  buildCrossAllianceCheckEmbed,
  buildIncidentListEmbed,
  buildIncidentReportedEmbed,
  buildIncidentRevokedEmbed,
  buildIncidentSharedEmbed,
  buildMirrorActionCancelledEmbed,
  buildMirrorActionConfirmedEmbed,
  buildMirrorActionResultEmbed,
  buildMirrorHistoryEmbed,
  buildModerationAnalyticsEmbed,
  buildSharingSettingsDisplayEmbed,
  buildSharingSettingsUpdatedEmbed,
  createSummaryEmbed,
} from '../embeds/moderationEmbeds';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { requirePlatformAdmin } from '../utils/platformRbac';

import { BotCommand } from './types';

interface ModerationServices {
  incidentService: ModerationIncidentService;
  sharingService: BlacklistSharingService;
  mirrorService: MirrorActionService;
  analyticsService: BlacklistAnalyticsService;
}

let _services: ModerationServices | null = null;

function getServices(): ModerationServices {
  _services ??= {
    incidentService: ModerationIncidentService.getInstance(),
    sharingService: BlacklistSharingService.getInstance(),
    mirrorService: MirrorActionService.getInstance(),
    analyticsService: BlacklistAnalyticsService.getInstance(),
  };
  return _services;
}

interface BlacklistContext {
  interaction: ChatInputCommandInteraction;
  incidentService: ModerationIncidentService;
  sharingService: BlacklistSharingService;
  mirrorService: MirrorActionService;
  analyticsService: BlacklistAnalyticsService;
  guildId: string;
  userId: string;
  userName: string;
  guildName: string | undefined;
}

type BlacklistHandler = (ctx: BlacklistContext) => Promise<void>;

// Subcommands/customIds requiring platform admin (orthogonal to guild ModerateMembers perm)
const ADMIN_BUTTON_SUBS = new Set(['mirror', 'revoke']);
const ADMIN_SELECT_MENU_IDS = new Set(['moderation_mirror_select', 'moderation_revoke_select']);
const ADMIN_MODAL_IDS = new Set(['moderation_mirror_modal', 'moderation_revoke_modal']);

const PARAM_FREE_BUTTON_SUBS = new Set(['stats', 'list', 'alerts', 'settings', 'mirror_history']);

const PARAM_FREE_HANDLER_MAP: Record<string, BlacklistHandler> = {
  stats: handleStatsCmd,
  list: handleList,
  alerts: handleAlerts,
  settings: handleSettings,
  mirror_history: handleMirrorHistory,
};

async function replyButtonError(interaction: ButtonInteraction, msg: string): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ content: `\u274c Error: ${msg}`, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content: `\u274c Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function runParamFreeButton(sub: string, interaction: ButtonInteraction): Promise<void> {
  const { incidentService, sharingService, mirrorService, analyticsService } = getServices();
  // Safe cast: only handleStatsCmd is called from buttons; it does not access
  // interaction.options — only interaction.reply/editReply which exist on both types.
  // Other handlers (handleList, handleAlerts, etc.) use options but are only reachable
  // from slash commands.
  const ctx: BlacklistContext = {
    interaction: interaction as unknown as ChatInputCommandInteraction,
    incidentService,
    sharingService,
    mirrorService,
    analyticsService,
    guildId: interaction.guildId ?? '',
    userId: interaction.user.id,
    userName: interaction.user.username,
    guildName: interaction.guild?.name,
  };
  try {
    const handler = PARAM_FREE_HANDLER_MAP[sub];
    if (handler) {
      await handler(ctx);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await replyButtonError(interaction, msg);
  }
}

async function showLookupOrCheckModal(
  interaction: ButtonInteraction,
  sub: 'lookup' | 'check'
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`moderation_${sub}_modal`)
    .setTitle(sub === 'lookup' ? 'Lookup User' : 'Quick Check User');

  const idInput = new TextInputBuilder()
    .setCustomId('discord_id')
    .setPlaceholder('Enter the Discord user ID (e.g. 123456789012345678)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(17)
    .setMaxLength(20);

  const label = new LabelBuilder().setLabel('Discord User ID').setTextInputComponent(idInput);
  modal.addLabelComponents(label);
  await interaction.showModal(modal);
}

async function showMirrorOrRevokeSelector(
  interaction: ButtonInteraction,
  sub: 'mirror' | 'revoke'
): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { incidentService } = getServices();
    const guildId = interaction.guildId ?? '';
    const result =
      sub === 'revoke'
        ? await incidentService.getActiveIncidents(guildId, 1, 25)
        : await incidentService.getGuildIncidents(guildId, guildId, 1, 25);

    if (result.incidents.length > 0) {
      const options = result.incidents.slice(0, 25).map(inc => ({
        label: `${inc.incidentType.toUpperCase()}: ${(inc.targetUsername ?? inc.targetDiscordId).substring(0, 80)}`,
        value: inc.id,
        description: (inc.reason ?? 'No reason').substring(0, 100),
      }));
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`moderation_${sub}_select`)
          .setPlaceholder(`Select an incident to ${sub}...`)
          .addOptions(options)
      );
      await interaction.editReply({
        content: `Select an incident to ${sub}:`,
        components: [row],
      });
      return;
    }
    await interaction.editReply(`No ${sub === 'revoke' ? 'active' : ''} incidents found.`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load incidents';
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(`\u274c ${msg}`);
    } else {
      await interaction.reply({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
    }
  }
}

async function replyReportRedirect(interaction: ButtonInteraction): Promise<void> {
  await interaction.reply({
    content: 'Use `/moderation report @user type:<type> reason:<text>` to report an incident.',
    flags: MessageFlags.Ephemeral,
  });
}

async function handleLookupOrCheckModal(
  interaction: ModalSubmitInteraction,
  customId: string
): Promise<void> {
  const { incidentService } = getServices();
  const discordId = interaction.fields.getTextInputValue('discord_id').trim();
  const guildId = interaction.guildId ?? '';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const includeShared = customId === 'moderation_check_modal';
    const summary = await incidentService.lookupUser(guildId, discordId, includeShared);
    const embed = createSummaryEmbed(summary);
    if (includeShared) {
      embed.setTitle(`\u2705 Alliance-Wide Check: ${summary.targetUsername ?? discordId}`);
    }
    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.editReply({ content: `\u274c Error: ${msg}` });
  }
}

async function handleMirrorModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { mirrorService } = getServices();
  const incidentId = interaction.fields.getTextInputValue('incident_id').trim();
  const guildId = interaction.guildId ?? '';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await mirrorService.createMirrorAction(guildId, {
      sourceIncidentId: incidentId,
      sourceOrganizationId: guildId,
      targetDiscordId: '',
      targetGuildId: guildId,
      actionType: MirrorActionType.BAN,
      severity: 1,
      moderatorId: interaction.user.id,
    });
    await interaction.editReply(`\u2705 Mirror action created for incident \`${incidentId}\`.`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.editReply({ content: `\u274c Error: ${msg}` });
  }
}

async function handleRevokeModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { incidentService } = getServices();
  const incidentId = interaction.fields.getTextInputValue('incident_id').trim();
  const reason = interaction.fields.getTextInputValue('reason')?.trim() ?? 'Revoked via panel';
  const guildId = interaction.guildId ?? '';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await incidentService.revokeIncident(
      guildId,
      incidentId,
      interaction.user.id,
      interaction.user.username,
      reason
    );
    await interaction.editReply(`\u2705 Incident \`${incidentId}\` has been revoked.`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.editReply({ content: `\u274c Error: ${msg}` });
  }
}

export const moderation: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Cross-Discord moderation and blacklist management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  cooldown: 3,
  guildOnly: true,
  permissions: ['ModerateMembers'],

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'moderation');
    if (!sub) {
      return;
    }

    if (ADMIN_BUTTON_SUBS.has(sub) && !(await requirePlatformAdmin(interaction))) {
      return;
    }

    if (PARAM_FREE_BUTTON_SUBS.has(sub)) {
      await runParamFreeButton(sub, interaction);
      return;
    }
    if (sub === 'lookup' || sub === 'check') {
      await showLookupOrCheckModal(interaction, sub);
      return;
    }
    if (sub === 'mirror' || sub === 'revoke') {
      await showMirrorOrRevokeSelector(interaction, sub);
      return;
    }
    if (sub === 'report') {
      await replyReportRedirect(interaction);
    }
  },

  handleSelectMenu: async (interaction: StringSelectMenuInteraction) => {
    const { customId } = interaction;

    if (ADMIN_SELECT_MENU_IDS.has(customId) && !(await requirePlatformAdmin(interaction))) {
      return;
    }

    const incidentId = interaction.values[0];
    const { incidentService, mirrorService } = getServices();
    const guildId = interaction.guildId ?? '';

    if (customId === 'moderation_mirror_select') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await mirrorService.createMirrorAction(guildId, {
          sourceIncidentId: incidentId,
          sourceOrganizationId: guildId,
          targetDiscordId: '',
          targetGuildId: guildId,
          actionType: MirrorActionType.BAN,
          severity: 1,
          moderatorId: interaction.user.id,
        });
        await interaction.editReply(`\u2705 Mirror action created for the selected incident.`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.editReply({ content: `\u274c Error: ${msg}` });
      }
    } else if (customId === 'moderation_revoke_select') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await incidentService.revokeIncident(
          guildId,
          incidentId,
          interaction.user.id,
          interaction.user.username,
          'Revoked via panel'
        );
        await interaction.editReply(`\u2705 Incident has been revoked.`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.editReply({ content: `\u274c Error: ${msg}` });
      }
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    const { customId } = interaction;

    if (ADMIN_MODAL_IDS.has(customId) && !(await requirePlatformAdmin(interaction))) {
      return;
    }

    if (customId === 'moderation_lookup_modal' || customId === 'moderation_check_modal') {
      await handleLookupOrCheckModal(interaction, customId);
      return;
    }
    if (customId === 'moderation_mirror_modal') {
      await handleMirrorModal(interaction);
      return;
    }
    if (customId === 'moderation_revoke_modal') {
      await handleRevokeModal(interaction);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
      prefix: 'moderation',
      title: '\ud83d\udee1\ufe0f Moderation Panel',
      description: 'Cross-Discord moderation and blacklist management.',
      buttons: [
        {
          subcommand: 'stats',
          label: 'Statistics',
          emoji: '\ud83d\udcca',
          style: ButtonStyle.Primary,
        },
        { subcommand: 'list', label: 'List Incidents', emoji: '\ud83d\udccb' },
        { subcommand: 'alerts', label: 'Alerts', emoji: '\ud83d\udd14' },
        { subcommand: 'settings', label: 'Settings', emoji: '\u2699\ufe0f' },
        { subcommand: 'mirror_history', label: 'Mirror History', emoji: '\ud83d\udcdc' },
        {
          subcommand: 'report',
          label: 'Report User',
          emoji: '\ud83d\udea9',
          style: ButtonStyle.Danger,
        },
        { subcommand: 'lookup', label: 'Lookup User', emoji: '\ud83d\udd0d' },
        { subcommand: 'check', label: 'Quick Check', emoji: '\u2705' },
        { subcommand: 'mirror', label: 'Mirror Incident', emoji: '\ud83d\udd01' },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};

// ========================================================================
// Subcommand handlers
// ========================================================================

async function _handleReport(ctx: BlacklistContext): Promise<void> {
  const { interaction, incidentService, guildId, userId, userName, guildName } = ctx;
  const targetUser = interaction.options.getUser('user', true);
  const incidentType = interaction.options.getString('type', true) as IncidentType;
  const reason = interaction.options.getString('reason', true);
  const duration = interaction.options.getInteger('duration') ?? undefined;
  const share = interaction.options.getBoolean('share') ?? false;

  const incident = await incidentService.createIncident(guildId, userId, userName, {
    guildId,
    guildName,
    targetDiscordId: targetUser.id,
    targetUsername: targetUser.username,
    moderatorDiscordId: userId,
    moderatorUsername: userName,
    incidentType,
    reason,
    durationMinutes: duration,
    isShared: share,
    isAutoDetected: false,
  });

  const embed = buildIncidentReportedEmbed(incident, reason, duration, share, userName);

  await interaction.reply({ embeds: [embed] });
}

async function _handleLookup(ctx: BlacklistContext): Promise<void> {
  const { interaction, incidentService, guildId } = ctx;
  const targetUser = interaction.options.getUser('user', true);
  const includeShared = interaction.options.getBoolean('include_shared') ?? true;

  const summary = await incidentService.lookupUser(guildId, targetUser.id, includeShared);
  const embed = createSummaryEmbed(summary);

  await interaction.reply({ embeds: [embed] });
}

async function _handleLookupId(ctx: BlacklistContext): Promise<void> {
  const { interaction, incidentService, guildId } = ctx;
  const discordId = interaction.options.getString('discord_id', true);
  const includeShared = interaction.options.getBoolean('include_shared') ?? true;

  if (!/^\d{17,20}$/.test(discordId)) {
    await interaction.reply({
      content: '❌ Invalid Discord ID format. Please provide a valid Discord user ID.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const summary = await incidentService.lookupUser(guildId, discordId, includeShared);
  const embed = createSummaryEmbed(summary);

  await interaction.reply({ embeds: [embed] });
}

async function _handleRevoke(ctx: BlacklistContext): Promise<void> {
  const { interaction, incidentService, guildId, userId, userName } = ctx;
  const incidentId = interaction.options.getString('incident_id', true);
  const reason = interaction.options.getString('reason') ?? undefined;

  const incident = await incidentService.revokeIncident(
    guildId,
    incidentId,
    userId,
    userName,
    reason
  );

  if (!incident) {
    await interaction.reply({
      content: '❌ Incident not found or you do not have permission to revoke it.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildIncidentRevokedEmbed(incident, reason, userName);

  await interaction.reply({ embeds: [embed] });
}

async function _handleShare(ctx: BlacklistContext): Promise<void> {
  const { interaction, incidentService, guildId, userId, userName } = ctx;
  const incidentId = interaction.options.getString('incident_id', true);

  const incident = await incidentService.shareIncident(guildId, incidentId, userId, userName);

  if (!incident) {
    await interaction.reply({
      content: '❌ Incident not found or you do not have permission to share it.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildIncidentSharedEmbed(incident, userName);

  await interaction.reply({ embeds: [embed] });
}

async function handleStatsCmd(ctx: BlacklistContext): Promise<void> {
  const { interaction, analyticsService, guildId } = ctx;
  const analytics = await analyticsService.getAnalytics(guildId);

  const embed = buildModerationAnalyticsEmbed(analytics);

  await interaction.reply({ embeds: [embed] });
}

async function handleList(ctx: BlacklistContext): Promise<void> {
  const { interaction, incidentService, guildId } = ctx;
  const incidentType = interaction.options.getString('type') as IncidentType | null;
  const status = interaction.options.getString('status') as IncidentStatus | null;
  const page = interaction.options.getInteger('page') ?? 1;

  const filters: Record<string, unknown> = {};
  if (incidentType) {
    filters.incidentType = incidentType;
  }
  if (status) {
    filters.status = status;
  }

  const result = await incidentService.searchIncidents(guildId, filters, page, 10);

  if (result.incidents.length === 0) {
    await interaction.reply({
      content: '📋 No incidents found matching your criteria.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildIncidentListEmbed(result, page);

  await interaction.reply({ embeds: [embed] });
}

async function _handleCheck(ctx: BlacklistContext): Promise<void> {
  const { interaction, sharingService, guildId } = ctx;
  const targetUser = interaction.options.getUser('user', true);

  const result = await sharingService.checkUserAcrossAllies(guildId, targetUser.id);

  const embed = buildCrossAllianceCheckEmbed(
    result,
    targetUser.username,
    targetUser.id,
    targetUser.displayAvatarURL()
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleAlerts(ctx: BlacklistContext): Promise<void> {
  const { interaction, sharingService, guildId } = ctx;
  const minSeverity = interaction.options.getInteger('min_severity') ?? undefined;
  const page = interaction.options.getInteger('page') ?? 1;

  const feed = await sharingService.getIncidentFeed(guildId, {
    page,
    limit: 10,
    minSeverity,
    includeOwn: false,
    includeShared: true,
    status: IncidentStatus.ACTIVE,
  });

  if (feed.incidents.length === 0) {
    await interaction.reply({
      content: '📋 No recent alerts from allied organizations.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildAlliedAlertsEmbed(feed, page);

  await interaction.reply({ embeds: [embed] });
}

async function handleSettings(ctx: BlacklistContext): Promise<void> {
  const { interaction, sharingService, guildId, userId, userName } = ctx;
  const shareWarnings = interaction.options.getBoolean('share_warnings');
  const shareTimeouts = interaction.options.getBoolean('share_timeouts');
  const shareKicks = interaction.options.getBoolean('share_kicks');
  const shareBans = interaction.options.getBoolean('share_bans');
  const receiveAlerts = interaction.options.getBoolean('receive_alerts');
  const minAlertSeverity = interaction.options.getInteger('min_alert_severity');
  const alertChannel = interaction.options.getChannel('alert_channel');
  const autoShare = interaction.options.getBoolean('auto_share');
  const autoEnforce = interaction.options.getBoolean('auto_enforce');
  const autoEnforceTimeouts = interaction.options.getBoolean('auto_enforce_timeouts');
  const autoEnforceKicks = interaction.options.getBoolean('auto_enforce_kicks');

  const hasUpdates = [
    shareWarnings,
    shareTimeouts,
    shareKicks,
    shareBans,
    receiveAlerts,
    minAlertSeverity,
    alertChannel,
    autoShare,
    autoEnforce,
    autoEnforceTimeouts,
    autoEnforceKicks,
  ].some(v => v !== null);

  if (!hasUpdates) {
    await showCurrentSettings(interaction, sharingService, guildId);
    return;
  }

  await applySettingsUpdate(interaction, sharingService, guildId, userId, userName, {
    shareWarnings,
    shareTimeouts,
    shareKicks,
    shareBans,
    receiveAlerts,
    minAlertSeverity,
    alertChannel,
    autoShare,
    autoEnforce,
    autoEnforceTimeouts,
    autoEnforceKicks,
  });
}

async function showCurrentSettings(
  interaction: ChatInputCommandInteraction,
  sharingService: BlacklistSharingService,
  guildId: string
): Promise<void> {
  const config = await sharingService.getConfig(guildId);

  const embed = buildSharingSettingsDisplayEmbed(config);

  await interaction.reply({ embeds: [embed] });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function applySettingsUpdate(
  interaction: ChatInputCommandInteraction,
  sharingService: BlacklistSharingService,
  guildId: string,
  userId: string,
  userName: string,
  opts: Record<string, any>
): Promise<void> {
  const updates: UpdateSharingConfigDTO = {};
  const fieldMap: Record<string, string> = {
    shareWarnings: 'shareWarnings',
    shareTimeouts: 'shareTimeouts',
    shareKicks: 'shareKicks',
    shareBans: 'shareBans',
    receiveAlerts: 'receiveAlerts',
    minAlertSeverity: 'minAlertSeverity',
    autoShare: 'autoShareWithAllies',
    autoEnforce: 'autoEnforceEnabled',
    autoEnforceTimeouts: 'autoEnforceTimeouts',
    autoEnforceKicks: 'autoEnforceKicks',
  };

  for (const [optKey, dtoKey] of Object.entries(fieldMap)) {
    if (opts[optKey] !== null && opts[optKey] !== undefined) {
      (updates as Record<string, unknown>)[dtoKey] = opts[optKey];
    }
  }
  if (opts.alertChannel !== null && opts.alertChannel !== undefined) {
    const alertChannel = opts.alertChannel as { id: string };
    updates.alertChannelId = alertChannel.id;
  }

  await sharingService.updateConfig(guildId, userId, userName, updates);

  const labelMap: Record<string, string> = {
    shareWarnings: 'Share Warnings',
    shareTimeouts: 'Share Timeouts',
    shareKicks: 'Share Kicks',
    shareBans: 'Share Bans',
    receiveAlerts: 'Receive Alerts',
    autoShareWithAllies: 'Auto-Share',
    autoEnforceEnabled: 'Auto-Enforce',
    autoEnforceTimeouts: 'Auto-Enforce Timeouts',
    autoEnforceKicks: 'Auto-Enforce Kicks',
  };

  const changesList: string[] = [];
  for (const [key, label] of Object.entries(labelMap)) {
    if ((updates as Record<string, unknown>)[key] !== undefined) {
      const val = (updates as Record<string, unknown>)[key];
      changesList.push(`• ${label}: ${val ? '✅ Enabled' : '❌ Disabled'}`);
    }
  }
  if (updates.minAlertSeverity !== undefined) {
    changesList.push(`• Min Alert Severity: ${updates.minAlertSeverity}`);
  }
  if (updates.alertChannelId !== undefined) {
    changesList.push(`• Alert Channel: <#${updates.alertChannelId}>`);
  }

  const embed = buildSharingSettingsUpdatedEmbed(changesList, userName);

  await interaction.reply({ embeds: [embed] });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function _handleMirror(ctx: BlacklistContext): Promise<void> {
  const { interaction, sharingService, mirrorService, guildId, userId, userName, guildName } = ctx;
  const incidentId = interaction.options.getString('incident_id', true);
  const customReason = interaction.options.getString('reason') ?? undefined;

  const feed = await sharingService.getIncidentFeed(guildId, {
    includeOwn: false,
    includeShared: true,
  });

  const sharedIncident = feed.incidents.find(si => si.incident.id.startsWith(incidentId));

  if (!sharedIncident) {
    await interaction.reply({
      content: '❌ Incident not found. Make sure to use an incident ID from an allied server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const incident = sharedIncident.incident;

  const result = await mirrorService.createMirrorAction(guildId, {
    sourceIncidentId: incident.id,
    sourceOrganizationId: sharedIncident.sourceOrganizationId,
    sourceGuildId: incident.guildId,
    sourceGuildName: incident.guildName,
    targetDiscordId: incident.targetDiscordId,
    targetUsername: incident.targetUsername,
    targetGuildId: guildId,
    targetGuildName: guildName,
    actionType: MirrorAction.actionTypeFromIncidentType(incident.incidentType),
    severity: incident.severity,
    reason: customReason ?? incident.reason,
    originalReason: incident.reason,
    durationMinutes: incident.durationMinutes,
    moderatorId: userId,
    moderatorDiscordId: userId,
    moderatorUsername: userName,
  });

  const embed = buildMirrorActionResultEmbed(result, incident, userName);

  await interaction.reply({ embeds: [embed] });
}

async function _handleBulkMirror(ctx: BlacklistContext): Promise<void> {
  const { interaction, mirrorService, guildId, userId, userName, guildName } = ctx;
  const targetUser = interaction.options.getUser('user', true);

  await interaction.deferReply();

  const summary = await mirrorService.createBulkMirror(
    guildId,
    targetUser.id,
    guildId,
    guildName,
    userId,
    userId,
    userName
  );

  if (summary.totalIncidents === 0) {
    await interaction.editReply({
      content: `❌ No incidents found for <@${targetUser.id}> from allied servers.`,
    });
    return;
  }

  const embed = buildBulkMirrorSummaryEmbed(summary, targetUser.displayAvatarURL(), userName);

  await interaction.editReply({ embeds: [embed] });
}

async function _handleConfirmMirror(ctx: BlacklistContext): Promise<void> {
  const { interaction, mirrorService, guildId, userId, userName } = ctx;
  const mirrorId = interaction.options.getString('mirror_id', true);

  const action = await mirrorService.confirmMirrorAction(guildId, mirrorId, userId, userName);

  if (!action) {
    await interaction.reply({
      content: '❌ Mirror action not found or you do not have permission to confirm it.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildMirrorActionConfirmedEmbed(action, userName);

  await interaction.reply({ embeds: [embed] });
}

async function _handleCancelMirror(ctx: BlacklistContext): Promise<void> {
  const { interaction, mirrorService, guildId, userId, userName } = ctx;
  const mirrorId = interaction.options.getString('mirror_id', true);

  const action = await mirrorService.cancelMirrorAction(guildId, mirrorId, userId, userName);

  if (!action) {
    await interaction.reply({
      content: '❌ Mirror action not found or you do not have permission to cancel it.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildMirrorActionCancelledEmbed(action, userName);

  await interaction.reply({ embeds: [embed] });
}

async function handleMirrorHistory(ctx: BlacklistContext): Promise<void> {
  const { interaction, mirrorService, guildId } = ctx;
  const targetUser = interaction.options.getUser('user');
  const page = interaction.options.getInteger('page') ?? 1;

  const history = await mirrorService.getMirrorActionHistory(guildId, {
    targetDiscordId: targetUser?.id,
    page,
    limit: 10,
  });

  if (history.actions.length === 0) {
    await interaction.reply({
      content: '📋 No mirror actions found.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildMirrorHistoryEmbed(history, targetUser?.id ?? null, page);

  await interaction.reply({ embeds: [embed] });
}
