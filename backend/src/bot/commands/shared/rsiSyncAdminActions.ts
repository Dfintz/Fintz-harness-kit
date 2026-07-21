import { ButtonInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';

import { GuildOrganizationService } from '../../../services/discord/GuildOrganizationService';
import { API_BASE_URL } from '../../constants/api';
import { botApiClient as axios, discordHeaders } from '../../utils/botApiClient';
import { formatBotApiError } from '../../utils/botErrorFormat';

export type RsiSyncAdminAction = 'status' | 'setup' | 'run' | 'audit';

interface RsiRoleMapping {
  rsiRank: string;
  discordRoleId?: string;
  isActive: boolean;
  summary?: {
    permissionCount?: number;
  };
}

interface RoleMappingsResponse {
  data?: {
    mappings?: RsiRoleMapping[];
  };
  mappings?: RsiRoleMapping[];
}

interface TriggerSyncResponse {
  data?: {
    triggered?: boolean;
  };
}

interface SyncAuditEntry {
  syncedAt: string;
  syncType: string;
  errors: number;
  changesApplied: number;
  changesDetected: number;
}

interface SyncAuditResponse {
  data?: {
    logs?: SyncAuditEntry[];
    total?: number;
  };
}

const RSI_SYNC_ADMIN_ACTIONS = new Set<RsiSyncAdminAction>(['status', 'setup', 'run', 'audit']);

export function isRsiSyncAdminAction(value: string): value is RsiSyncAdminAction {
  return RSI_SYNC_ADMIN_ACTIONS.has(value as RsiSyncAdminAction);
}

export function hasManageRolesPermission(interaction: ButtonInteraction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles));
}

export async function resolveOrgIdFromGuild(guildId: string): Promise<string | null> {
  try {
    const guildOrgService = GuildOrganizationService.getInstance();
    return await guildOrgService.resolveOrganization(guildId);
  } catch {
    return null;
  }
}

async function replyManageRolesRequired(interaction: ButtonInteraction): Promise<void> {
  await interaction.reply({
    content: '❌ You need the **Manage Roles** permission to use RSI sync admin actions.',
    flags: MessageFlags.Ephemeral,
  });
}

async function replyRsiSyncSetupHint(interaction: ButtonInteraction): Promise<void> {
  await interaction.reply({
    content:
      '🔧 Setup wizard is available in the web app under Organization Settings → Integrations → RSI Sync.',
    flags: MessageFlags.Ephemeral,
  });
}

function getSyncTypeIcon(syncType: string): string {
  switch (syncType) {
    case 'scheduled':
      return '🔄';
    case 'manual':
      return '👤';
    default:
      return '🔗';
  }
}

async function replyHandlerError(interaction: ButtonInteraction, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({
      content: `❌ Error: ${msg}`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${msg}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleStatusAction(
  interaction: ButtonInteraction,
  orgId: string | null
): Promise<void> {
  if (!orgId) {
    await interaction.reply({
      content:
        '❌ This server is not linked to an organization.\n💡 Use `/guild setup` to link this server first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const mappingsResponse = await axios.get<RoleMappingsResponse>(
      `${API_BASE_URL}/v2/rsi/role-mapping/${orgId}`,
      {
        headers: discordHeaders(interaction),
      }
    );
    const mappings = mappingsResponse.data.data?.mappings ?? mappingsResponse.data.mappings ?? [];

    if (mappings.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xffff00)
        .setTitle('📋 RSI Role Sync Status')
        .setDescription('No role mappings configured for this organization.')
        .addFields({
          name: 'Get Started',
          value:
            'Use the **Setup Wizard** button above, then configure rank mappings in Organization Settings → Integrations → RSI Sync.',
          inline: false,
        })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📋 RSI Role Sync Status')
      .setTimestamp();

    const mappingLines: string[] = [];
    for (const mapping of mappings.slice(0, 15)) {
      const discordRoleDisplay = mapping.discordRoleId
        ? `<@&${mapping.discordRoleId}>`
        : '❌ Not mapped';
      const statusIcon = mapping.isActive ? '🟢' : '🔴';
      const permCount = mapping.summary?.permissionCount ?? 0;
      mappingLines.push(
        `${statusIcon} **${mapping.rsiRank}** → ${discordRoleDisplay} (${permCount} permissions)`
      );
    }

    embed.addFields({
      name: 'Role Mappings',
      value: mappingLines.join('\n') || 'No mappings',
      inline: false,
    });

    if (mappings.length > 15) {
      embed.addFields({
        name: 'Note',
        value: `Showing 15 of ${mappings.length} mappings. View all in the web app.`,
        inline: false,
      });
    }

    const withDiscordRole = mappings.filter(
      (m: { discordRoleId?: string }) => m.discordRoleId
    ).length;
    const activeMappings = mappings.filter((m: { isActive: boolean }) => m.isActive).length;

    embed.addFields(
      { name: 'Total Mappings', value: mappings.length.toString(), inline: true },
      { name: 'Active', value: activeMappings.toString(), inline: true },
      { name: 'With Discord Role', value: withDiscordRole.toString(), inline: true }
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const errorMessage = formatBotApiError(error, 'Unknown error', `status:org=${orgId}`);
    await interaction.editReply({ content: `❌ Failed to fetch status: ${errorMessage}` });
  }
}

async function handleRunAction(
  interaction: ButtonInteraction,
  orgId: string | null
): Promise<void> {
  if (!orgId) {
    await interaction.reply({
      content:
        '❌ This server is not linked to an organization.\n💡 Use `/guild setup` to link this server first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const response = await axios.post<TriggerSyncResponse>(
      `${API_BASE_URL}/bot/rsi/organizations/${orgId}/sync`,
      {
        force: false,
      },
      {
        headers: discordHeaders(interaction),
      }
    );

    const triggered = response.data.data?.triggered ?? false;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🔄 Role Synchronization Triggered')
      .setDescription('Role synchronization has been started for this organization.')
      .addFields(
        { name: 'Organization', value: orgId, inline: true },
        { name: 'Status', value: triggered ? '✅ Started' : '⏳ Queued', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const errorMessage = formatBotApiError(error, 'Unknown error', `run-sync:org=${orgId}`);
    await interaction.editReply({ content: `❌ Failed to run sync: ${errorMessage}` });
  }
}

async function handleAuditAction(
  interaction: ButtonInteraction,
  orgId: string | null
): Promise<void> {
  if (!orgId) {
    await interaction.reply({
      content:
        '❌ This server is not linked to an organization.\n💡 Use `/guild setup` to link this server first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const response = await axios.get<SyncAuditResponse>(
      `${API_BASE_URL}/bot/rsi/organizations/${orgId}/audit`,
      {
        params: { limit: 5 },
        headers: discordHeaders(interaction),
      }
    );

    const logs = response.data.data?.logs ?? [];
    const total = response.data.data?.total ?? logs.length;

    if (logs.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('📋 RSI Sync Audit Log')
        .setDescription('No sync history found for this organization.')
        .addFields({
          name: 'Get Started',
          value: 'Click **Run Sync** to start syncing roles.',
          inline: false,
        })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📋 RSI Sync Audit Log')
      .setDescription(`Showing last ${logs.length} of ${total} sync operations`)
      .setTimestamp();

    const logEntries: string[] = [];
    for (const log of logs.slice(0, 5)) {
      const syncedAt = new Date(log.syncedAt);
      const typeIcon = getSyncTypeIcon(log.syncType);
      const statusIcon = log.errors > 0 ? '⚠️' : '✅';
      logEntries.push(
        `${statusIcon} ${typeIcon} <t:${Math.floor(syncedAt.getTime() / 1000)}:R> - ` +
          `${log.changesApplied}/${log.changesDetected} changes, ${log.errors} errors`
      );
    }

    embed.addFields({
      name: 'Recent Syncs',
      value: logEntries.join('\n') || 'No entries',
      inline: false,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const errorMessage = formatBotApiError(error, 'Unknown error', `audit:org=${orgId}`);
    await interaction.editReply({ content: `❌ Failed to fetch audit log: ${errorMessage}` });
  }
}

const ACTION_HANDLERS: Record<Exclude<RsiSyncAdminAction, 'setup'>, typeof handleStatusAction> = {
  status: handleStatusAction,
  run: handleRunAction,
  audit: handleAuditAction,
};

export async function handleRsiSyncAdminAction(
  action: RsiSyncAdminAction,
  interaction: ButtonInteraction
): Promise<void> {
  if (!hasManageRolesPermission(interaction)) {
    await replyManageRolesRequired(interaction);
    return;
  }

  if (action === 'setup') {
    await replyRsiSyncSetupHint(interaction);
    return;
  }

  const guildId = interaction.guildId;
  const orgId = guildId ? await resolveOrgIdFromGuild(guildId) : null;

  try {
    await ACTION_HANDLERS[action](interaction, orgId);
  } catch (error: unknown) {
    await replyHandlerError(interaction, error);
  }
}
