import crypto from 'node:crypto';

import { ChannelType } from 'discord.js';
import { NextFunction, Response, Router } from 'express';
import { In } from 'typeorm';

import { BotClientManager } from '../../bot/BotClientManager';
import {
  deployRsiStatusPanelForGuild,
  getRsiStatusPanelForGuild,
  removeRsiStatusPanelForGuild,
  type RsiStatusPanelConfig,
} from '../../bot/commands/rsistatus';
import {
  assignStatusChannelForGuild,
  createManagedStatusChannelsForGuild,
  getComponentStatusEmoji,
  getStatusChannelsForGuild,
  removeStatusChannelsForGuild,
  type GuildStatusChannels,
  type StatusRole,
  type TrackedStatusChannel,
} from '../../bot/commands/rsiStatusChannels';
import {
  RSI_STATUS_IPC_ACTIONS,
  type RsiStatusChannelsGetResponse,
  type RsiStatusChannelsRemoveResponse,
  type RsiStatusPanelDeployResponse,
  type RsiStatusPanelGetResponse,
  type RsiStatusPanelRemoveResponse,
} from '../../bot/rsiStatusIpc';
import { AppDataSource } from '../../data-source';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { discordAdminAuthorization } from '../../middleware/discordAuthorization';
import { AllianceDiplomacy, AllianceType, DiplomacyStatus } from '../../models/AllianceDiplomacy';
import type {
  AdvancedEventSettings,
  AuditLogSettings,
  CrossModerationSettings,
  DmNotificationSettings,
  EventSettings,
  GiveawaySettings,
  NotificationPreferences,
  RecruitmentSettings,
  RoleSyncSettings,
  SmartLfgPingSettings,
  StatSettings,
  TeamVoiceSettings,
  TicketSettings,
  TunnelSettings,
  VoiceChannelSettings,
  VoiceChannelTemplate,
  WelcomeSettings,
} from '../../models/DiscordGuildSettings';
import { FederationMember } from '../../models/FederationMember';
import { GuildOrganization } from '../../models/GuildOrganization';
import { Organization } from '../../models/Organization';
import {
  OrganizationRelationship,
  RelationshipStatus,
  RelationshipType,
} from '../../models/OrganizationRelationship';
import { discordSettingsSchemas } from '../../schemas/discordSchemas';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { discordUserPreferenceService } from '../../services/discord/DiscordUserPreferenceService';
import { rsiStatusService } from '../../services/external/RsiStatusService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Extract the authenticated user's ID.
 * Safe to call only after `authenticateToken` middleware has run, which guarantees `req.user`.
 */
function getUserId(req: AuthRequest): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return req.user!.id;
}

/**
 * Validation middleware
 */
const validateSchema =
  (schema: {
    validate: (body: unknown) => { error?: { details: { message: string }[] }; value: unknown };
  }) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
      return;
    }
    req.body = value;
    next();
  };

type RsiChannelPresentationType = 'text' | 'voice' | 'other';

interface RsiChannelPresentation extends TrackedStatusChannel {
  channelName: string | null;
  channelType: RsiChannelPresentationType;
}

interface RsiStatusPayload {
  panel: (RsiStatusPanelConfig & { messageUrl: string }) | null;
  channels: {
    application: RsiChannelPresentation | null;
    server: RsiChannelPresentation | null;
  };
  latestSnapshot: {
    overallStatus: string;
    fetchedAt: string;
    components: Array<{
      name: string;
      status: string;
      emoji: string;
    }>;
  };
}

type TicketSettingsResponse = TicketSettings & {
  supportWebhookConfigured?: boolean;
};

type DiscordSettingsWithTicketSecrets = {
  ticketSettings?: TicketSettings;
};

function maskTicketSettingsSecrets(
  ticketSettings?: TicketSettings
): TicketSettingsResponse | undefined {
  if (!ticketSettings) {
    return undefined;
  }

  const hasWebhook = Boolean(ticketSettings.supportWebhookUrl?.trim());
  return {
    ...ticketSettings,
    supportWebhookUrl: undefined,
    supportWebhookConfigured: hasWebhook,
  };
}

function maskDiscordSettingsTicketSecrets<T extends DiscordSettingsWithTicketSecrets>(
  settings: T
): T {
  return {
    ...settings,
    ticketSettings: maskTicketSettingsSecrets(settings.ticketSettings),
  };
}

function maskDiscordSettingsArrayTicketSecrets<T extends DiscordSettingsWithTicketSecrets>(
  settings: T[]
): T[] {
  return settings.map(item => maskDiscordSettingsTicketSecrets(item));
}

type CrossModerationSuggestionSource = 'allied' | 'custom_agreement' | 'federated';

interface CrossModerationGuildSuggestion {
  guildId: string;
  guildName: string | null;
  organizationId: string;
  organizationName: string | null;
  sources: CrossModerationSuggestionSource[];
}

const POSITIVE_RELATIONSHIP_TYPES = [
  RelationshipType.ALLIED,
  RelationshipType.PARTNERSHIP,
  RelationshipType.COOPERATIVE,
  RelationshipType.AFFILIATED,
  RelationshipType.TRADING_PARTNER,
] as const;

const CUSTOM_AGREEMENT_ALLIANCE_TYPES = [
  AllianceType.FULL_ALLIANCE,
  AllianceType.MUTUAL_DEFENSE,
] as const;

function upsertCrossModerationSuggestion(
  target: Map<string, CrossModerationGuildSuggestion>,
  entry: {
    guildId: string;
    guildName: string | null;
    organizationId: string;
    organizationName: string | null;
    source: CrossModerationSuggestionSource;
  }
): void {
  const existing = target.get(entry.guildId);
  if (!existing) {
    target.set(entry.guildId, {
      guildId: entry.guildId,
      guildName: entry.guildName,
      organizationId: entry.organizationId,
      organizationName: entry.organizationName,
      sources: [entry.source],
    });
    return;
  }

  if (!existing.sources.includes(entry.source)) {
    existing.sources.push(entry.source);
  }
  if (!existing.guildName && entry.guildName) {
    existing.guildName = entry.guildName;
  }
  if (!existing.organizationName && entry.organizationName) {
    existing.organizationName = entry.organizationName;
  }
}

async function getCrossModerationCandidateOrgSets(orgId: string): Promise<{
  alliedOrgIds: Set<string>;
  customAgreementOrgIds: Set<string>;
  federatedOrgIds: Set<string>;
}> {
  const [alliedOrgIds, customAgreementOrgIds, federatedOrgIds] = await Promise.all([
    getAlliedOrgIds(orgId),
    getCustomAgreementOrgIds(orgId),
    getFederatedOrgIds(orgId),
  ]);

  return {
    alliedOrgIds,
    customAgreementOrgIds,
    federatedOrgIds,
  };
}

async function getAlliedOrgIds(orgId: string): Promise<Set<string>> {
  const relationshipRepo = AppDataSource.getRepository(OrganizationRelationship);
  const positiveRelations = await relationshipRepo.find({
    where: [
      {
        organizationId: orgId,
        status: RelationshipStatus.ACTIVE,
        type: In([...POSITIVE_RELATIONSHIP_TYPES]),
      },
      {
        targetOrganizationId: orgId,
        status: RelationshipStatus.ACTIVE,
        type: In([...POSITIVE_RELATIONSHIP_TYPES]),
      },
    ],
    select: ['organizationId', 'targetOrganizationId'],
  });

  const alliedOrgIds = new Set<string>();
  for (const relation of positiveRelations) {
    const counterpartOrgId =
      relation.organizationId === orgId ? relation.targetOrganizationId : relation.organizationId;
    if (counterpartOrgId && counterpartOrgId !== orgId) {
      alliedOrgIds.add(counterpartOrgId);
    }
  }

  return alliedOrgIds;
}

async function getCustomAgreementOrgIds(orgId: string): Promise<Set<string>> {
  const diplomacyRepo = AppDataSource.getRepository(AllianceDiplomacy);
  const activeDiplomacy = await diplomacyRepo.find({
    where: [
      {
        orgId1: orgId,
        status: DiplomacyStatus.ACTIVE,
        allianceType: In([...CUSTOM_AGREEMENT_ALLIANCE_TYPES]),
      },
      {
        orgId2: orgId,
        status: DiplomacyStatus.ACTIVE,
        allianceType: In([...CUSTOM_AGREEMENT_ALLIANCE_TYPES]),
      },
    ],
    select: ['orgId1', 'orgId2'],
  });

  const customAgreementOrgIds = new Set<string>();
  for (const relation of activeDiplomacy) {
    const counterpart = relation.orgId1 === orgId ? relation.orgId2 : relation.orgId1;
    if (counterpart !== orgId) {
      customAgreementOrgIds.add(counterpart);
    }
  }

  return customAgreementOrgIds;
}

async function getFederatedOrgIds(orgId: string): Promise<Set<string>> {
  const federationMemberRepo = AppDataSource.getRepository(FederationMember);
  const federationMemberships = await federationMemberRepo
    .createQueryBuilder('member')
    .select('member.federationId', 'federationId')
    .where('member.organizationId = :orgId', { orgId })
    .andWhere('LOWER(member.status) = :status', { status: 'active' })
    .getRawMany<{ federationId: string }>();

  if (federationMemberships.length === 0) {
    return new Set<string>();
  }

  const fedIds = federationMemberships.map(item => item.federationId);
  const coMembers = await federationMemberRepo
    .createQueryBuilder('member')
    .select('member.organizationId', 'organizationId')
    .where('member.federationId IN (:...fedIds)', { fedIds })
    .andWhere('LOWER(member.status) = :status', { status: 'active' })
    .getRawMany<{ organizationId: string }>();

  const federatedOrgIds = new Set<string>();
  for (const member of coMembers) {
    if (member.organizationId !== orgId) {
      federatedOrgIds.add(member.organizationId);
    }
  }

  return federatedOrgIds;
}

function getTargetOrgIds(orgSets: {
  alliedOrgIds: Set<string>;
  customAgreementOrgIds: Set<string>;
  federatedOrgIds: Set<string>;
}): string[] {
  return Array.from(
    new Set<string>([
      ...orgSets.alliedOrgIds,
      ...orgSets.customAgreementOrgIds,
      ...orgSets.federatedOrgIds,
    ])
  );
}

async function buildCrossModerationSuggestions(
  orgSets: {
    alliedOrgIds: Set<string>;
    customAgreementOrgIds: Set<string>;
    federatedOrgIds: Set<string>;
  },
  allTargetOrgIds: string[]
): Promise<CrossModerationGuildSuggestion[]> {
  const guildOrgRepo = AppDataSource.getRepository(GuildOrganization);
  const guildMappings = await guildOrgRepo.find({
    where: {
      organizationId: In(allTargetOrgIds),
      isActive: true,
    },
    select: ['guildId', 'guildName', 'organizationId'],
  });

  const orgs = await AppDataSource.getRepository(Organization).find({
    where: { id: In(allTargetOrgIds) },
    select: ['id', 'name'],
  });
  const orgNameById = new Map<string, string>(orgs.map(item => [item.id, item.name]));

  const suggestions = new Map<string, CrossModerationGuildSuggestion>();
  for (const guild of guildMappings) {
    const orgName = orgNameById.get(guild.organizationId) ?? null;
    if (orgSets.alliedOrgIds.has(guild.organizationId)) {
      upsertCrossModerationSuggestion(suggestions, {
        guildId: guild.guildId,
        guildName: guild.guildName ?? null,
        organizationId: guild.organizationId,
        organizationName: orgName,
        source: 'allied',
      });
    }
    if (orgSets.customAgreementOrgIds.has(guild.organizationId)) {
      upsertCrossModerationSuggestion(suggestions, {
        guildId: guild.guildId,
        guildName: guild.guildName ?? null,
        organizationId: guild.organizationId,
        organizationName: orgName,
        source: 'custom_agreement',
      });
    }
    if (orgSets.federatedOrgIds.has(guild.organizationId)) {
      upsertCrossModerationSuggestion(suggestions, {
        guildId: guild.guildId,
        guildName: guild.guildName ?? null,
        organizationId: guild.organizationId,
        organizationName: orgName,
        source: 'federated',
      });
    }
  }

  return Array.from(suggestions.values()).sort((a, b) => {
    const orgCompare = (a.organizationName ?? '').localeCompare(b.organizationName ?? '');
    if (orgCompare !== 0) {
      return orgCompare;
    }
    return (a.guildName ?? '').localeCompare(b.guildName ?? '');
  });
}

function isStatusRole(value: string): value is StatusRole {
  return value === 'application' || value === 'server';
}

function mapChannelType(type: number | undefined): RsiChannelPresentationType {
  if (type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice) {
    return 'voice';
  }
  if (type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement) {
    return 'text';
  }
  return 'other';
}

function classifyRsiError(error: unknown): { status: number; message: string } {
  if (!(error instanceof Error)) {
    return { status: 500, message: 'Failed to update RSI status settings' };
  }

  const message = error.message;
  const lower = message.toLowerCase();
  if (lower.includes('not connected') || lower.includes('ipc') || lower.includes('timed out')) {
    return { status: 503, message };
  }
  if (
    lower.includes('not found') ||
    lower.includes('cannot manage') ||
    lower.includes('permission') ||
    lower.includes('text channels')
  ) {
    return { status: 400, message };
  }

  return { status: 500, message };
}

async function requestRsiStatusIpc<TData extends object>(
  action: string,
  data: Record<string, unknown>
): Promise<TData> {
  const { BotIPCService } = await import('../../bot/BotIPCService');
  const ipcService = BotIPCService.getInstance();

  if (!ipcService.isAvailable()) {
    throw new Error('Discord bot is not connected');
  }

  const routingGuildId =
    typeof data.guildId === 'string' && data.guildId.length > 0 ? data.guildId : null;

  const response = await ipcService.request(action, data, {
    timeoutMs: 15_000,
    requireDefinitiveResponse: true,
    definitiveWaitMs: 500,
    routing: routingGuildId
      ? {
          scope: 'guild',
          guildId: routingGuildId,
        }
      : undefined,
  });

  const isDefinitive = response?.definitive ?? response?.status !== 'not_handled';

  if (!response?.success) {
    throw new Error(response?.error ?? 'Discord bot is not connected');
  }

  if (!isDefinitive || response.status === 'not_handled') {
    throw new Error(`IPC action "${action}" was not handled by any connected shard`);
  }

  return (response.data ?? {}) as TData;
}

async function getRsiStatusPanelConfig(guildId: string): Promise<RsiStatusPanelConfig | null> {
  if (BotClientManager.getInstance().isReady()) {
    return getRsiStatusPanelForGuild(guildId);
  }

  const response = await requestRsiStatusIpc<RsiStatusPanelGetResponse>(
    RSI_STATUS_IPC_ACTIONS.GET_PANEL,
    {
      guildId,
    }
  );

  return response.panel ?? null;
}

async function getRsiStatusChannelConfig(guildId: string): Promise<GuildStatusChannels | null> {
  if (BotClientManager.getInstance().isReady()) {
    return getStatusChannelsForGuild(guildId);
  }

  const response = await requestRsiStatusIpc<RsiStatusChannelsGetResponse>(
    RSI_STATUS_IPC_ACTIONS.GET_CHANNELS,
    {
      guildId,
    }
  );

  return response.channels ?? null;
}

async function deployRsiStatusPanelConfig(
  guildId: string,
  channelId: string
): Promise<RsiStatusPanelConfig> {
  if (BotClientManager.getInstance().isReady()) {
    return deployRsiStatusPanelForGuild(guildId, channelId);
  }

  const response = await requestRsiStatusIpc<RsiStatusPanelDeployResponse>(
    RSI_STATUS_IPC_ACTIONS.DEPLOY_PANEL,
    {
      guildId,
      channelId,
    }
  );

  if (!response.panel) {
    throw new Error('Failed to deploy RSI status panel');
  }

  return response.panel;
}

async function removeRsiStatusPanelConfig(guildId: string): Promise<boolean> {
  if (BotClientManager.getInstance().isReady()) {
    return removeRsiStatusPanelForGuild(guildId);
  }

  const response = await requestRsiStatusIpc<RsiStatusPanelRemoveResponse>(
    RSI_STATUS_IPC_ACTIONS.REMOVE_PANEL,
    {
      guildId,
    }
  );

  return Boolean(response.removed);
}

async function createManagedRsiStatusChannels(guildId: string): Promise<void> {
  if (BotClientManager.getInstance().isReady()) {
    await createManagedStatusChannelsForGuild(guildId);
    return;
  }

  await requestRsiStatusIpc<Record<string, unknown>>(
    RSI_STATUS_IPC_ACTIONS.CREATE_MANAGED_CHANNELS,
    {
      guildId,
    }
  );
}

async function assignRsiStatusChannel(
  guildId: string,
  role: StatusRole,
  channelId: string
): Promise<void> {
  if (BotClientManager.getInstance().isReady()) {
    await assignStatusChannelForGuild(guildId, role, channelId);
    return;
  }

  await requestRsiStatusIpc<Record<string, unknown>>(RSI_STATUS_IPC_ACTIONS.ASSIGN_CHANNEL, {
    guildId,
    role,
    channelId,
  });
}

async function removeRsiStatusChannels(guildId: string): Promise<boolean> {
  if (BotClientManager.getInstance().isReady()) {
    return removeStatusChannelsForGuild(guildId);
  }

  const response = await requestRsiStatusIpc<RsiStatusChannelsRemoveResponse>(
    RSI_STATUS_IPC_ACTIONS.REMOVE_CHANNELS,
    {
      guildId,
    }
  );

  return Boolean(response.removed);
}

async function resolveTrackedChannel(
  guildId: string,
  tracked?: TrackedStatusChannel
): Promise<RsiChannelPresentation | null> {
  if (!tracked) {
    return null;
  }

  const manager = BotClientManager.getInstance();
  if (!manager.isReady()) {
    return {
      ...tracked,
      channelName: null,
      channelType: 'other',
    };
  }

  const client = manager.getClient();
  const guild =
    client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  const channel = guild ? await guild.channels.fetch(tracked.channelId).catch(() => null) : null;

  return {
    ...tracked,
    channelName: channel?.name ?? null,
    channelType: mapChannelType(channel?.type),
  };
}

async function buildRsiStatusPayload(guildId: string): Promise<RsiStatusPayload> {
  const [panel, channels, snapshot] = await Promise.all([
    getRsiStatusPanelConfig(guildId),
    getRsiStatusChannelConfig(guildId),
    rsiStatusService.getStatus(),
  ]);

  const [application, server] = await Promise.all([
    resolveTrackedChannel(guildId, channels?.application),
    resolveTrackedChannel(guildId, channels?.server),
  ]);

  return {
    panel: panel
      ? {
          ...panel,
          messageUrl: `https://discord.com/channels/${guildId}/${panel.channelId}/${panel.messageId}`,
        }
      : null,
    channels: {
      application,
      server,
    },
    latestSnapshot: {
      overallStatus: snapshot.overallStatus,
      fetchedAt: snapshot.fetchedAt.toISOString(),
      components: snapshot.components.map(component => ({
        name: component.name,
        status: component.status,
        emoji: getComponentStatusEmoji(component.status),
      })),
    },
  };
}

/**
 * GET /:orgId/discord/settings
 * Get all Discord guild settings for an organization
 * Auth: Organization owner or Discord admin
 */
router.get(
  '/:orgId/discord/settings',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId } = req.params;

      const settings = await discordSettingsService.getOrganizationSettings(orgId);

      res.json({
        success: true,
        data: maskDiscordSettingsArrayTicketSecrets(settings),
        count: settings.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to fetch Discord settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Discord settings',
      });
    }
  }
);

/**
 * GET /:orgId/discord/settings/:guildId
 * Get Discord settings for a specific guild
 */
router.get(
  '/:orgId/discord/settings/:guildId',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;

      // Use getOrCreateSettings so that visiting the settings page for the
      // first time automatically creates the row with sensible defaults.
      // Previously getSettings returned null ⇒ 404, which caused the
      // frontend hydrateGuildSettings to silently fail and show "unconfigured".
      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);

      // Lazily populate guild icon URL from Discord API if not stored
      if (!settings.guildIconUrl) {
        try {
          const { GuildOrganizationService } =
            await import('../../services/discord/GuildOrganizationService');
          const guildOrgService = GuildOrganizationService.getInstance();
          const guildInfo = await guildOrgService.fetchGuildInfo(guildId);
          if (guildInfo?.iconUrl) {
            settings.guildIconUrl = guildInfo.iconUrl;
            await discordSettingsService.saveSettings(settings);
          }
        } catch {
          // Non-critical — continue without icon
        }
      }

      res.json({
        success: true,
        data: maskDiscordSettingsTicketSecrets(settings),
      });
    } catch (error: unknown) {
      logger.error('Failed to fetch Discord settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Discord settings',
      });
    }
  }
);

/**
 * GET /:orgId/discord/settings/:guildId/cross-moderation/suggestions
 * Suggest allied/federated/custom-agreement guilds for allowedGuildIds selection.
 */
router.get(
  '/:orgId/discord/settings/:guildId/cross-moderation/suggestions',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      await discordSettingsService.requireGuildAccess(orgId, guildId);

      const orgSets = await getCrossModerationCandidateOrgSets(orgId);
      const allTargetOrgIds = getTargetOrgIds(orgSets);

      if (allTargetOrgIds.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }

      const data = await buildCrossModerationSuggestions(orgSets, allTargetOrgIds);

      res.json({ success: true, data });
    } catch (error: unknown) {
      logger.error('Failed to build cross moderation suggestions', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to build cross moderation suggestions',
      });
    }
  }
);

/**
 * GET /:orgId/discord/settings/:guildId/rsi-status
 * Get RSI status panel + status-channel configuration for a guild
 */
router.get(
  '/:orgId/discord/settings/:guildId/rsi-status',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      await discordSettingsService.requireGuildAccess(orgId, guildId);

      const payload = await buildRsiStatusPayload(guildId);
      res.json({ success: true, data: payload });
    } catch (error: unknown) {
      logger.error('Failed to load RSI status settings', { error });
      const classified = classifyRsiError(error);
      res.status(classified.status).json({ success: false, error: classified.message });
    }
  }
);

/**
 * POST /:orgId/discord/settings/:guildId/rsi-status/panel/deploy
 * Deploy or replace the live RSI status panel in a text channel
 */
router.post(
  '/:orgId/discord/settings/:guildId/rsi-status/panel/deploy',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.rsiStatusPanelDeploy),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const { channelId } = req.body as { channelId: string };
      await discordSettingsService.requireGuildAccess(orgId, guildId);

      await deployRsiStatusPanelConfig(guildId, channelId);
      const payload = await buildRsiStatusPayload(guildId);
      res.json({ success: true, data: payload, message: 'RSI status panel deployed successfully' });
    } catch (error: unknown) {
      logger.error('Failed to deploy RSI status panel', { error });
      const classified = classifyRsiError(error);
      res.status(classified.status).json({ success: false, error: classified.message });
    }
  }
);

/**
 * DELETE /:orgId/discord/settings/:guildId/rsi-status/panel
 * Remove the live RSI status panel for a guild
 */
router.delete(
  '/:orgId/discord/settings/:guildId/rsi-status/panel',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      await discordSettingsService.requireGuildAccess(orgId, guildId);

      const removed = await removeRsiStatusPanelConfig(guildId);
      const payload = await buildRsiStatusPayload(guildId);
      res.json({
        success: true,
        data: payload,
        message: removed
          ? 'RSI status panel removed successfully'
          : 'No active RSI status panel found',
      });
    } catch (error: unknown) {
      logger.error('Failed to remove RSI status panel', { error });
      const classified = classifyRsiError(error);
      res.status(classified.status).json({ success: false, error: classified.message });
    }
  }
);

/**
 * POST /:orgId/discord/settings/:guildId/rsi-status/channels/managed
 * Create bot-managed status voice channels (Application + Servers)
 */
router.post(
  '/:orgId/discord/settings/:guildId/rsi-status/channels/managed',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      await discordSettingsService.requireGuildAccess(orgId, guildId);

      await createManagedRsiStatusChannels(guildId);
      const payload = await buildRsiStatusPayload(guildId);
      res.json({
        success: true,
        data: payload,
        message: 'Managed RSI status channels created successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to create managed RSI status channels', { error });
      const classified = classifyRsiError(error);
      res.status(classified.status).json({ success: false, error: classified.message });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/rsi-status/channels/:role
 * Assign an existing text/voice channel to a specific RSI status role
 */
router.patch(
  '/:orgId/discord/settings/:guildId/rsi-status/channels/:role',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.rsiStatusChannelAssign),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId, role } = req.params;
      const { channelId } = req.body as { channelId: string };

      if (!isStatusRole(role)) {
        res.status(400).json({
          success: false,
          error: 'Role must be either application or server',
        });
        return;
      }

      await discordSettingsService.requireGuildAccess(orgId, guildId);
      await assignRsiStatusChannel(guildId, role, channelId);

      const payload = await buildRsiStatusPayload(guildId);
      res.json({ success: true, data: payload, message: `RSI ${role} status channel updated` });
    } catch (error: unknown) {
      logger.error('Failed to assign RSI status channel', { error });
      const classified = classifyRsiError(error);
      res.status(classified.status).json({ success: false, error: classified.message });
    }
  }
);

/**
 * DELETE /:orgId/discord/settings/:guildId/rsi-status/channels
 * Remove all RSI status channel mappings for a guild
 */
router.delete(
  '/:orgId/discord/settings/:guildId/rsi-status/channels',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      await discordSettingsService.requireGuildAccess(orgId, guildId);

      const removed = await removeRsiStatusChannels(guildId);
      const payload = await buildRsiStatusPayload(guildId);
      res.json({
        success: true,
        data: payload,
        message: removed
          ? 'RSI status channels removed successfully'
          : 'No RSI status channels found',
      });
    } catch (error: unknown) {
      logger.error('Failed to remove RSI status channels', { error });
      const classified = classifyRsiError(error);
      res.status(classified.status).json({ success: false, error: classified.message });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/events
 * Update event settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/events',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.eventSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateEventSettings(
        orgId,
        guildId,
        req.body as Partial<EventSettings>,
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Event settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update event settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update event settings',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/voice-channels
 * Update voice channel settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/voice-channels',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.voiceChannelSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateVoiceChannelSettings(
        orgId,
        guildId,
        req.body as Partial<VoiceChannelSettings>,
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Voice channel settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update voice channel settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update voice channel settings',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/tunnels
 * Update tunnel settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/tunnels',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.tunnelSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateTunnelSettings(
        orgId,
        guildId,
        req.body as Partial<TunnelSettings>,
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Tunnel settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update tunnel settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update tunnel settings',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/notifications
 * Update notification preferences
 */
router.patch(
  '/:orgId/discord/settings/:guildId/notifications',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.notificationPreferences),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateNotificationPreferences(
        orgId,
        guildId,
        req.body as Partial<NotificationPreferences>,
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Notification preferences updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update notification preferences', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update notification preferences',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/role-sync
 * Update role sync settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/role-sync',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.roleSyncSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateRoleSyncSettings(
        orgId,
        guildId,
        req.body as Partial<RoleSyncSettings>,
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Role sync settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update role sync settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update role sync settings',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/cross-moderation
 * Update cross-guild moderation settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/cross-moderation',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.crossModerationSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateCrossModerationSettings(
        orgId,
        guildId,
        req.body as Partial<CrossModerationSettings>,
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Cross moderation settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update cross moderation settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update cross moderation settings',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/tickets
 * Update ticket system settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/tickets',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.ticketSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateTicketSettings(
        orgId,
        guildId,
        req.body as Partial<TicketSettings>,
        userId
      );

      res.json({
        success: true,
        data: maskDiscordSettingsTicketSecrets(settings),
        message: 'Ticket settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update ticket settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update ticket settings',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/team-voice
 * Update team voice settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/team-voice',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.teamVoiceSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateTeamVoiceSettings(
        orgId,
        guildId,
        req.body as Partial<TeamVoiceSettings>,
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Team voice settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update team voice settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update team voice settings',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/lfg
 * Update LFG (Looking For Group) settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/lfg',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.lfgSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateLfgSettings(
        orgId,
        guildId,
        req.body as Parameters<typeof discordSettingsService.updateLfgSettings>[2],
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'LFG settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update LFG settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update LFG settings',
      });
    }
  }
);

/**
 * PATCH /:orgId/discord/settings/:guildId/recruitment
 * Update recruitment settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/recruitment',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.recruitmentSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateRecruitmentSettings(
        orgId,
        guildId,
        req.body as Partial<RecruitmentSettings>,
        userId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Recruitment settings updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update recruitment settings', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update recruitment settings',
      });
    }
  }
);

/**
 * POST /:orgId/discord/settings/:guildId/admins
 * Add a Discord admin user
 */
router.post(
  '/:orgId/discord/settings/:guildId/admins',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.adminManagement),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const { userId } = req.body as { userId: string };
      const currentUserId = getUserId(req);

      const settings = await discordSettingsService.addAdminUser(
        orgId,
        guildId,
        userId,
        currentUserId
      );

      res.status(201).json({
        success: true,
        data: settings,
        message: 'Admin user added successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to add admin user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to add admin user',
      });
    }
  }
);

/**
 * DELETE /:orgId/discord/settings/:guildId/admins/:userId
 * Remove a Discord admin user
 */
router.delete(
  '/:orgId/discord/settings/:guildId/admins/:userId',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId, userId } = req.params;
      const currentUserId = getUserId(req);

      const settings = await discordSettingsService.removeAdminUser(
        orgId,
        guildId,
        userId,
        currentUserId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Admin user removed successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to remove admin user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to remove admin user',
      });
    }
  }
);

/**
 * POST /:orgId/discord/settings/:guildId/server-managers
 * Add a Discord server manager role
 */
router.post(
  '/:orgId/discord/settings/:guildId/server-managers',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.serverManagerManagement),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const { roleId } = req.body as { roleId: string };
      const currentUserId = getUserId(req);

      const settings = await discordSettingsService.addServerManagerRole(
        orgId,
        guildId,
        roleId,
        currentUserId
      );

      res.status(201).json({
        success: true,
        data: settings,
        message: 'Server manager role added successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to add server manager role', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to add server manager role',
      });
    }
  }
);

/**
 * DELETE /:orgId/discord/settings/:guildId/server-managers/:roleId
 * Remove a Discord server manager role
 */
router.delete(
  '/:orgId/discord/settings/:guildId/server-managers/:roleId',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId, roleId } = req.params;
      const currentUserId = getUserId(req);

      const settings = await discordSettingsService.removeServerManagerRole(
        orgId,
        guildId,
        roleId,
        currentUserId
      );

      res.json({
        success: true,
        data: settings,
        message: 'Server manager role removed successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to remove server manager role', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to remove server manager role',
      });
    }
  }
);

/**
 * POST /:orgId/discord/settings/:guildId/starcomms-managers
 * Add a Discord StarComms manager role
 */
router.post(
  '/:orgId/discord/settings/:guildId/starcomms-managers',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.starCommsManagerManagement),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const { roleId } = req.body as { roleId: string };
      const currentUserId = getUserId(req);

      const settings = await discordSettingsService.addStarCommsManagerRole(
        orgId,
        guildId,
        roleId,
        currentUserId
      );

      res.status(201).json({
        success: true,
        data: settings,
        message: 'StarComms manager role added successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to add StarComms manager role', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to add StarComms manager role',
      });
    }
  }
);

/**
 * DELETE /:orgId/discord/settings/:guildId/starcomms-managers/:roleId
 * Remove a Discord StarComms manager role
 */
router.delete(
  '/:orgId/discord/settings/:guildId/starcomms-managers/:roleId',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId, roleId } = req.params;
      const currentUserId = getUserId(req);

      const settings = await discordSettingsService.removeStarCommsManagerRole(
        orgId,
        guildId,
        roleId,
        currentUserId
      );

      res.json({
        success: true,
        data: settings,
        message: 'StarComms manager role removed successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to remove StarComms manager role', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to remove StarComms manager role',
      });
    }
  }
);

// ==================== Application CSV Export ====================

/**
 * GET /:orgId/recruitment/export/csv
 * Export recruitment applications as CSV
 */
router.get(
  '/:orgId/recruitment/export/csv',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId } = req.params;

      // Fetch applications from the org application service
      const { OrgApplicationService } =
        await import('../../services/organization/OrgApplicationService');
      const service = new OrgApplicationService();
      const result = await service.getApplicationsForOrg(orgId, {});
      const applications = result.data ?? [];

      // Build CSV
      const header = 'ID,Applicant,Status,AppliedAt\n';
      const rows = applications.map(app =>
        [
          app.id,
          (app as unknown as Record<string, unknown>).applicantName ??
            (app as unknown as Record<string, unknown>).userId ??
            '',
          app.status,
          app.createdAt ? new Date(app.createdAt as unknown as string).toISOString() : '',
        ]
          .map(v => {
            let s: string;
            if (v === null || v === undefined) {
              s = '';
            } else if (typeof v === 'string') {
              s = v;
            } else {
              s = JSON.stringify(v);
            }
            return `"${s.replaceAll('"', '""')}"`;
          })
          .join(',')
      );

      const csv = header + rows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="applications-${orgId}.csv"`);
      res.send(csv);
    } catch (error: unknown) {
      logger.error('Failed to export applications CSV', { error });
      res.status(500).json({ success: false, error: 'Failed to export applications' });
    }
  }
);

// ==================== Ticket Quick Responses ====================

/**
 * POST /:orgId/discord/settings/:guildId/quick-responses
 * Create a quick response
 */
router.post(
  '/:orgId/discord/settings/:guildId/quick-responses',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.quickResponseCreate),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);
      const { name, content, categoryId } = req.body as {
        name: string;
        content: string;
        categoryId?: string | null;
      };

      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);
      const responses = settings.ticketSettings?.quickResponses ?? [];

      const newResponse = {
        id: crypto.randomUUID(),
        name: String(name).trim(),
        content: String(content).trim(),
        categoryId: categoryId ?? undefined,
        createdBy: userId,
      };
      responses.push(newResponse);

      await discordSettingsService.updateTicketSettings(
        orgId,
        guildId,
        { quickResponses: responses },
        userId
      );

      res.status(201).json({ success: true, data: newResponse });
    } catch (error: unknown) {
      logger.error('Failed to create quick response', { error });
      res.status(500).json({ success: false, error: 'Failed to create quick response' });
    }
  }
);

/**
 * DELETE /:orgId/discord/settings/:guildId/quick-responses/:responseId
 */
router.delete(
  '/:orgId/discord/settings/:guildId/quick-responses/:responseId',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId, responseId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);
      const responses = settings.ticketSettings?.quickResponses ?? [];
      const filtered = responses.filter(r => r.id !== responseId);

      if (filtered.length === responses.length) {
        res.status(404).json({ success: false, error: 'Quick response not found' });
        return;
      }

      await discordSettingsService.updateTicketSettings(
        orgId,
        guildId,
        { quickResponses: filtered },
        userId
      );
      res.json({ success: true, message: 'Quick response deleted' });
    } catch (error: unknown) {
      logger.error('Failed to delete quick response', { error });
      res.status(500).json({ success: false, error: 'Failed to delete quick response' });
    }
  }
);

/**
 * POST /:orgId/discord/settings/:guildId/quick-response-categories
 */
router.post(
  '/:orgId/discord/settings/:guildId/quick-response-categories',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.quickResponseCategoryCreate),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);
      const { name } = req.body as { name: string };

      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);
      const categories = settings.ticketSettings?.quickResponseCategories ?? [];

      const newCat = { id: crypto.randomUUID(), name: String(name).trim() };
      categories.push(newCat);

      await discordSettingsService.updateTicketSettings(
        orgId,
        guildId,
        { quickResponseCategories: categories },
        userId
      );

      res.status(201).json({ success: true, data: newCat });
    } catch (error: unknown) {
      logger.error('Failed to create quick response category', { error });
      res.status(500).json({ success: false, error: 'Failed to create category' });
    }
  }
);

/**
 * DELETE /:orgId/discord/settings/:guildId/quick-response-categories/:categoryId
 */
router.delete(
  '/:orgId/discord/settings/:guildId/quick-response-categories/:categoryId',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId, categoryId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);
      const categories = settings.ticketSettings?.quickResponseCategories ?? [];
      const filtered = categories.filter(c => c.id !== categoryId);

      if (filtered.length === categories.length) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      await discordSettingsService.updateTicketSettings(
        orgId,
        guildId,
        { quickResponseCategories: filtered },
        userId
      );
      res.json({ success: true, message: 'Category deleted' });
    } catch (error: unknown) {
      logger.error('Failed to delete quick response category', { error });
      res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
  }
);

// ==================== Server Timezone ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/timezone
 * Update server-wide timezone
 */
router.patch(
  '/:orgId/discord/settings/:guildId/timezone',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.timezone),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);
      const { timezone } = req.body as { timezone: string };

      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);
      settings.timezone = timezone || undefined;
      settings.lastModifiedBy = userId;
      await discordSettingsService.saveSettings(settings);

      res.json({ success: true, data: settings, message: 'Timezone updated' });
    } catch (error: unknown) {
      logger.error('Failed to update timezone', { error });
      res.status(500).json({ success: false, error: 'Failed to update timezone' });
    }
  }
);

// ==================== Welcome Settings ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/welcome
 * Update welcome/goodbye settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/welcome',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.welcomeSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateWelcomeSettings(
        orgId,
        guildId,
        req.body as Partial<WelcomeSettings>,
        userId
      );

      res.json({ success: true, data: settings, message: 'Welcome settings updated' });
    } catch (error: unknown) {
      logger.error('Failed to update welcome settings', { error });
      res.status(500).json({ success: false, error: 'Failed to update welcome settings' });
    }
  }
);

// ==================== Audit Log Settings ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/audit-log
 * Update audit log settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/audit-log',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.auditLogSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateAuditLogSettings(
        orgId,
        guildId,
        req.body as Partial<AuditLogSettings>,
        userId
      );

      res.json({ success: true, data: settings, message: 'Audit log settings updated' });
    } catch (error: unknown) {
      logger.error('Failed to update audit log settings', { error });
      res.status(500).json({ success: false, error: 'Failed to update audit log settings' });
    }
  }
);

// ==================== Stat Settings ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/stat-settings
 * Update stat tracking settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/stat-settings',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.statSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateStatSettings(
        orgId,
        guildId,
        req.body as Partial<StatSettings>,
        userId
      );

      res.json({ success: true, data: settings, message: 'Stat settings updated' });
    } catch (error: unknown) {
      logger.error('Failed to update stat settings', { error });
      res.status(500).json({ success: false, error: 'Failed to update stat settings' });
    }
  }
);

// ==================== DM Notification Settings ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/dm-notification-settings
 * Update DM notification settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/dm-notification-settings',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.dmNotificationSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateDmNotificationSettings(
        orgId,
        guildId,
        req.body as Partial<DmNotificationSettings>,
        userId
      );

      res.json({ success: true, data: settings, message: 'DM notification settings updated' });
    } catch (error: unknown) {
      logger.error('Failed to update DM notification settings', { error });
      res.status(500).json({ success: false, error: 'Failed to update DM notification settings' });
    }
  }
);

// ==================== Smart LFG Ping Settings ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/smart-lfg-ping-settings
 * Update smart LFG ping settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/smart-lfg-ping-settings',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.smartLfgPingSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateSmartLfgPingSettings(
        orgId,
        guildId,
        req.body as Partial<SmartLfgPingSettings>,
        userId
      );

      res.json({ success: true, data: settings, message: 'Smart LFG ping settings updated' });
    } catch (error: unknown) {
      logger.error('Failed to update smart LFG ping settings', { error });
      res.status(500).json({ success: false, error: 'Failed to update smart LFG ping settings' });
    }
  }
);

// ==================== Giveaway Settings ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/giveaway-settings
 * Update giveaway settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/giveaway-settings',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.giveawaySettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateGiveawaySettings(
        orgId,
        guildId,
        req.body as Partial<GiveawaySettings>,
        userId
      );

      res.json({ success: true, data: settings, message: 'Giveaway settings updated' });
    } catch (error: unknown) {
      logger.error('Failed to update giveaway settings', { error });
      res.status(500).json({ success: false, error: 'Failed to update giveaway settings' });
    }
  }
);

// ==================== Advanced Event Settings ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/advanced-event-settings
 * Update advanced event settings
 */
router.patch(
  '/:orgId/discord/settings/:guildId/advanced-event-settings',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.advancedEventSettings),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.updateAdvancedEventSettings(
        orgId,
        guildId,
        req.body as Partial<AdvancedEventSettings>,
        userId
      );

      res.json({ success: true, data: settings, message: 'Advanced event settings updated' });
    } catch (error: unknown) {
      logger.error('Failed to update advanced event settings', { error });
      res.status(500).json({ success: false, error: 'Failed to update advanced event settings' });
    }
  }
);

// ==================== Voice Template CRUD ====================

/**
 * POST /:orgId/discord/settings/:guildId/voice-templates
 * Create a new voice channel template
 */
router.post(
  '/:orgId/discord/settings/:guildId/voice-templates',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.voiceTemplateCreate),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);
      const { name, description, userLimit, bitrate, nameTemplate, autoDelete } = req.body as {
        name: string;
        description?: string;
        userLimit?: number;
        bitrate?: number;
        nameTemplate?: string;
        autoDelete?: boolean;
      };

      if (typeof name !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Template name must be a string',
        });
        return;
      }

      const normalizedName = name.trim();
      const normalizedDescription = typeof description === 'string' ? description.trim() : '';

      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);
      const templates: VoiceChannelTemplate[] = settings.voiceChannelSettings?.templates ?? [];

      const now = new Date();
      const newTemplate: VoiceChannelTemplate = {
        id: crypto.randomUUID(),
        name: normalizedName,
        description: normalizedDescription,
        bitrate: typeof bitrate === 'number' ? bitrate : 64000,
        userLimit: typeof userLimit === 'number' ? userLimit : 10,
        tags: [],
        enabled: true,
        nameTemplate: nameTemplate ?? "{user}'s Channel",
        autoDelete: autoDelete !== false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      };

      templates.push(newTemplate);

      await discordSettingsService.updateVoiceChannelSettings(
        orgId,
        guildId,
        { templates },
        userId
      );

      res.status(201).json({
        success: true,
        data: newTemplate,
        message: 'Voice template created successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to create voice template', { error });
      res.status(500).json({ success: false, error: 'Failed to create voice template' });
    }
  }
);

/**
 * DELETE /:orgId/discord/settings/:guildId/voice-templates/:templateId
 * Delete a voice channel template
 */
router.delete(
  '/:orgId/discord/settings/:guildId/voice-templates/:templateId',
  authenticateToken,
  discordAdminAuthorization,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId, templateId } = req.params;
      const userId = getUserId(req);

      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);
      const templates = settings.voiceChannelSettings?.templates ?? [];
      const beforeCount = templates.length;
      const filtered = templates.filter((t: { id: string }) => t.id !== templateId);

      if (filtered.length === beforeCount) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }

      await discordSettingsService.updateVoiceChannelSettings(
        orgId,
        guildId,
        { templates: filtered },
        userId
      );

      res.json({ success: true, message: 'Voice template deleted successfully' });
    } catch (error: unknown) {
      logger.error('Failed to delete voice template', { error });
      res.status(500).json({ success: false, error: 'Failed to delete voice template' });
    }
  }
);

// ==================== Assistant Roles ====================

/**
 * PATCH /:orgId/discord/settings/:guildId/assistant-roles
 * Update the assistant role IDs for a guild (roles that can create events but not change settings)
 */
router.patch(
  '/:orgId/discord/settings/:guildId/assistant-roles',
  authenticateToken,
  discordAdminAuthorization,
  validateSchema(discordSettingsSchemas.assistantRoles),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId, guildId } = req.params;
      const userId = getUserId(req);
      const { assistantRoleIds } = req.body as { assistantRoleIds: string[] };

      const settings = await discordSettingsService.getOrCreateSettings(orgId, guildId);
      settings.assistantRoleIds = assistantRoleIds;
      settings.lastModifiedBy = userId;
      await discordSettingsService.saveSettings(settings);

      res.json({
        success: true,
        data: settings,
        message: 'Assistant roles updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update assistant roles', { error });
      res.status(500).json({ success: false, error: 'Failed to update assistant roles' });
    }
  }
);

// ==================== User Notification Preferences ====================

/**
 * GET /:orgId/discord/user-preferences/:guildId
 * Get the authenticated user's notification preferences for a guild
 */
router.get(
  '/:orgId/discord/user-preferences/:guildId',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { guildId } = req.params;
      const userId = getUserId(req);

      const pref = await discordUserPreferenceService.getOrCreate(userId, guildId);

      res.json({ success: true, data: pref });
    } catch (error: unknown) {
      logger.error('Failed to get user preferences', { error });
      res.status(500).json({ success: false, error: 'Failed to get user preferences' });
    }
  }
);

/**
 * PATCH /:orgId/discord/user-preferences/:guildId
 * Update the authenticated user's notification preferences for a guild
 */
router.patch(
  '/:orgId/discord/user-preferences/:guildId',
  authenticateToken,
  validateSchema(discordSettingsSchemas.userPreferences),
  async (req: AuthRequest, res: Response) => {
    try {
      const { guildId } = req.params;
      const userId = getUserId(req);

      const allowedBoolFields = [
        'dmEnabled',
        'lfgPingOptIn',
        'eventReminderOptIn',
        'ticketDmOptIn',
        'recruitmentDmOptIn',
        'moderationAlertOptIn',
      ] as const;

      const body = req.body as {
        dmEnabled?: boolean;
        lfgPingOptIn?: boolean;
        eventReminderOptIn?: boolean;
        ticketDmOptIn?: boolean;
        recruitmentDmOptIn?: boolean;
        moderationAlertOptIn?: boolean;
        timezone?: string;
      };

      const updates: Record<string, boolean | string | undefined> = {};
      for (const field of allowedBoolFields) {
        if (typeof body[field] === 'boolean') {
          updates[field] = body[field];
        }
      }
      // Timezone is a string (IANA format) — validated by Joi above
      if (typeof body.timezone === 'string') {
        updates.timezone = body.timezone || undefined;
      }

      const pref = await discordUserPreferenceService.update(userId, guildId, updates);

      res.json({
        success: true,
        data: pref,
        message: 'User preferences updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update user preferences', { error });
      res.status(500).json({ success: false, error: 'Failed to update user preferences' });
    }
  }
);

export { router };
