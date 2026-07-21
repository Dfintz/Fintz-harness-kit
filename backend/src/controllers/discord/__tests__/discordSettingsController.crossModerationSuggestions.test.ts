import express, { type Application } from 'express';
import request from 'supertest';

import { AllianceDiplomacy } from '../../../models/AllianceDiplomacy';
import { FederationMember } from '../../../models/FederationMember';
import { GuildOrganization } from '../../../models/GuildOrganization';
import { Organization } from '../../../models/Organization';
import { OrganizationRelationship } from '../../../models/OrganizationRelationship';

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'user-1',
      username: 'tester',
      role: 'owner',
      currentOrganizationId: 'org-main',
    };
    next();
  },
}));

jest.mock('../../../middleware/discordAuthorization', () => ({
  discordAdminAuthorization: (_req: any, _res: any, next: any) => next(),
}));

const mockRequireGuildAccess = jest.fn();
jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    requireGuildAccess: (...args: unknown[]) => mockRequireGuildAccess(...args),
    getOrganizationSettings: jest.fn(),
    getOrCreateSettings: jest.fn(),
    saveSettings: jest.fn(),
    updateSettings: jest.fn(),
  },
}));

jest.mock('../../../services/discord/DiscordUserPreferenceService', () => ({
  discordUserPreferenceService: {
    getUserPreferences: jest.fn(),
    updateUserPreferences: jest.fn(),
  },
}));

jest.mock('../../../services/external/RsiStatusService', () => ({
  rsiStatusService: {
    getStatus: jest.fn().mockResolvedValue({
      overallStatus: 'operational',
      fetchedAt: new Date('2026-07-15T00:00:00.000Z'),
      components: [],
    }),
  },
}));

jest.mock('../../../bot/BotClientManager', () => ({
  BotClientManager: {
    getInstance: () => ({
      isReady: () => false,
      getClient: () => null,
    }),
  },
}));

jest.mock('../../../bot/commands/rsistatus', () => ({
  deployRsiStatusPanelForGuild: jest.fn(),
  getRsiStatusPanelForGuild: jest.fn(),
  removeRsiStatusPanelForGuild: jest.fn(),
}));

jest.mock('../../../bot/commands/rsiStatusChannels', () => ({
  assignStatusChannelForGuild: jest.fn(),
  createManagedStatusChannelsForGuild: jest.fn(),
  getComponentStatusEmoji: jest.fn().mockReturnValue('✅'),
  getStatusChannelsForGuild: jest.fn(),
  removeStatusChannelsForGuild: jest.fn(),
}));

jest.mock('../../../bot/rsiStatusIpc', () => ({
  RSI_STATUS_IPC_ACTIONS: {
    GET_PANEL: 'GET_PANEL',
    GET_CHANNELS: 'GET_CHANNELS',
    DEPLOY_PANEL: 'DEPLOY_PANEL',
    REMOVE_PANEL: 'REMOVE_PANEL',
    CREATE_MANAGED_CHANNELS: 'CREATE_MANAGED_CHANNELS',
    ASSIGN_CHANNEL: 'ASSIGN_CHANNEL',
    REMOVE_CHANNELS: 'REMOVE_CHANNELS',
  },
}));

const mockRelationshipFind = jest.fn();
const mockDiplomacyFind = jest.fn();
const mockFederationCreateQueryBuilder = jest.fn();
const mockGuildOrgFind = jest.fn();
const mockOrgFind = jest.fn();

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: (entity: { name: string }) => {
      if (entity === OrganizationRelationship || entity?.name === 'OrganizationRelationship') {
        return { find: mockRelationshipFind };
      }
      if (entity === AllianceDiplomacy || entity?.name === 'AllianceDiplomacy') {
        return { find: mockDiplomacyFind };
      }
      if (entity === FederationMember || entity?.name === 'FederationMember') {
        return { createQueryBuilder: mockFederationCreateQueryBuilder };
      }
      if (entity === GuildOrganization || entity?.name === 'GuildOrganization') {
        return { find: mockGuildOrgFind };
      }
      if (entity === Organization || entity?.name === 'Organization') {
        return { find: mockOrgFind };
      }
      return { find: jest.fn(), createQueryBuilder: jest.fn() };
    },
  },
}));

import { router as discordSettingsRouter } from '../discordSettingsController';

const ORG_ID = 'org-main';
const GUILD_ID = 'guild-main';

function buildApp(): Application {
  // NOSONAR: test harness Express app intentionally omits production security middleware.
  const app = express();
  app.use(express.json());
  app.use('/api/orgs', discordSettingsRouter);
  return app;
}

function buildFederationMemberQueryBuilder(firstRows: Array<{ federationId: string }>): {
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getRawMany: jest.Mock;
} {
  const chain = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  let firstCall = true;
  chain.getRawMany.mockImplementation(async () => {
    if (firstCall) {
      firstCall = false;
      return firstRows;
    }

    const hasLowerStatusFilter = chain.andWhere.mock.calls.some(
      ([clause]) => clause === 'LOWER(member.status) = :status'
    );

    if (!hasLowerStatusFilter) {
      return [];
    }

    return [{ organizationId: 'org-fed' }, { organizationId: ORG_ID }];
  });

  return chain;
}

describe('DiscordSettingsController cross moderation suggestions', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();

    mockRequireGuildAccess.mockResolvedValue(undefined);
    mockDiplomacyFind.mockResolvedValue([]);
    mockGuildOrgFind.mockResolvedValue([]);
    mockOrgFind.mockResolvedValue([]);
  });

  it('includes suggestions when positive relationship is inverse direction', async () => {
    mockRelationshipFind.mockResolvedValue([
      {
        organizationId: 'org-ally',
        targetOrganizationId: ORG_ID,
      },
    ]);

    const fedQb = buildFederationMemberQueryBuilder([]);
    mockFederationCreateQueryBuilder.mockReturnValue(fedQb);

    mockGuildOrgFind.mockResolvedValue([
      {
        guildId: 'guild-ally',
        guildName: 'Ally Guild',
        organizationId: 'org-ally',
      },
    ]);

    mockOrgFind.mockResolvedValue([{ id: 'org-ally', name: 'Ally Org' }]);

    const response = await request(app).get(
      `/api/orgs/${ORG_ID}/discord/settings/${GUILD_ID}/cross-moderation/suggestions`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([
      {
        guildId: 'guild-ally',
        guildName: 'Ally Guild',
        organizationId: 'org-ally',
        organizationName: 'Ally Org',
        sources: ['allied'],
      },
    ]);
  });

  it('includes federated suggestions with mixed-case member status rows', async () => {
    mockRelationshipFind.mockResolvedValue([]);

    const fedQb = buildFederationMemberQueryBuilder([{ federationId: 'fed-1' }]);
    mockFederationCreateQueryBuilder.mockReturnValue(fedQb);

    mockGuildOrgFind.mockResolvedValue([
      {
        guildId: 'guild-fed',
        guildName: 'Federated Guild',
        organizationId: 'org-fed',
      },
    ]);

    mockOrgFind.mockResolvedValue([{ id: 'org-fed', name: 'Federated Org' }]);

    const response = await request(app).get(
      `/api/orgs/${ORG_ID}/discord/settings/${GUILD_ID}/cross-moderation/suggestions`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([
      {
        guildId: 'guild-fed',
        guildName: 'Federated Guild',
        organizationId: 'org-fed',
        organizationName: 'Federated Org',
        sources: ['federated'],
      },
    ]);

    const lowerStatusCalls = fedQb.andWhere.mock.calls.filter(
      ([clause]) => clause === 'LOWER(member.status) = :status'
    );
    expect(lowerStatusCalls.length).toBeGreaterThanOrEqual(2);
  });
});
