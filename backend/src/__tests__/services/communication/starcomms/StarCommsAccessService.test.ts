jest.mock('../../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../../services/discord/DiscordService', () => ({
  isDiscordServiceInitialized: jest.fn().mockReturnValue(false),
  getDiscordService: jest.fn(),
}));

jest.mock('../../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getOrganizationSettings: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../../../services/federation/FederationDiscordSettingsService', () => ({
  federationDiscordSettingsService: {
    getAllForFederation: jest.fn().mockResolvedValue([]),
  },
}));

import { AppDataSource } from '../../../../data-source';
import { ExternalIntegration } from '../../../../models/ExternalIntegration';
import {
  getDiscordService,
  isDiscordServiceInitialized,
} from '../../../../services/discord/DiscordService';
import { discordSettingsService } from '../../../../services/discord/DiscordSettingsService';
import { federationDiscordSettingsService } from '../../../../services/federation/FederationDiscordSettingsService';
import { StarCommsAccessService } from '../../../../services/communication/starcomms/StarCommsAccessService';

const mockIntegrationRepo = {
  find: jest.fn(),
};

const mockMembershipRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockFederationMemberRepo = {
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockFleetRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockPermissionManager = {
  hasPermission: jest.fn(),
};

const mockDiscordService = {
  getUserRoles: jest.fn(),
};

const membershipQb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
  getRawMany: jest.fn(),
};

const federationQb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
  getRawMany: jest.fn(),
};

// Keep Jest from treating the suite as empty if a future refactor trims cases.
expect.hasAssertions();

describe('StarCommsAccessService', () => {
  let service: StarCommsAccessService;

  beforeEach(() => {
    jest.clearAllMocks();

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name: string }) => {
      switch (entity.name) {
        case 'ExternalIntegration':
          return mockIntegrationRepo;
        case 'OrganizationMembership':
          return mockMembershipRepo;
        case 'FederationMember':
          return mockFederationMemberRepo;
        case 'Fleet':
          return mockFleetRepo;
        case 'User':
          return mockUserRepo;
        default:
          return {};
      }
    });

    mockMembershipRepo.createQueryBuilder.mockReturnValue(membershipQb);
    mockFederationMemberRepo.createQueryBuilder.mockReturnValue(federationQb);
    mockFleetRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'fleet-1', organizationId: 'org-1' }),
    });

    membershipQb.getRawMany.mockResolvedValue([{ organizationId: 'org-1' }]);
    federationQb.getRawMany.mockResolvedValue([{ federationId: 'fed-1' }]);
    membershipQb.getOne.mockResolvedValue({
      id: 'mem-1',
      role: { priority: 60 },
    });

    mockPermissionManager.hasPermission.mockResolvedValue(true);
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', discordId: 'discord-user-1' });
    (isDiscordServiceInitialized as jest.Mock).mockReturnValue(false);
    (getDiscordService as jest.Mock).mockReturnValue(mockDiscordService);
    mockDiscordService.getUserRoles.mockResolvedValue([]);
    (discordSettingsService.getOrganizationSettings as jest.Mock).mockResolvedValue([]);
    (federationDiscordSettingsService.getAllForFederation as jest.Mock).mockResolvedValue([]);

    service = new StarCommsAccessService(
      mockIntegrationRepo as never,
      mockMembershipRepo as never,
      mockFederationMemberRepo as never,
      mockFleetRepo as never,
      mockUserRepo as never,
      mockPermissionManager as never
    );
  });

  it('should include fleet-owned integrations for user org membership', async () => {
    mockIntegrationRepo.find.mockResolvedValue([
      {
        id: 'int-1',
        type: 'starcomms',
        fleetId: 'fleet-1',
        starCommsConfig: { baseUrl: 'https://starcomms.example.test' },
      },
    ] as ExternalIntegration[]);

    mockFleetRepo.findOne.mockResolvedValue({ id: 'fleet-1', organizationId: 'org-1' });

    const result = await service.listAccessibleIntegrations('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('int-1');
  });

  it('should include shared integration when whitelist matches user org', async () => {
    mockIntegrationRepo.find.mockResolvedValue([
      {
        id: 'int-shared-org',
        type: 'starcomms',
        fleetId: 'fleet-2',
        ownerType: 'organization',
        ownerId: 'org-2',
        starCommsConfig: {
          baseUrl: 'https://starcomms.example.test',
          sharing: {
            enabled: true,
            whitelist: [{ type: 'organization', targetId: 'org-1', targetName: 'Org One' }],
          },
        },
      },
    ] as ExternalIntegration[]);

    const result = await service.listAccessibleIntegrations('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('int-shared-org');
  });

  it('should include shared integration when whitelist matches user federation', async () => {
    mockIntegrationRepo.find.mockResolvedValue([
      {
        id: 'int-shared-fed',
        type: 'starcomms',
        fleetId: 'fleet-2',
        ownerType: 'federation',
        ownerId: 'fed-2',
        starCommsConfig: {
          baseUrl: 'https://starcomms.example.test',
          sharing: {
            enabled: true,
            whitelist: [{ type: 'federation', targetId: 'fed-1', targetName: 'Federation One' }],
          },
        },
      },
    ] as ExternalIntegration[]);

    const result = await service.listAccessibleIntegrations('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('int-shared-fed');
  });

  it('should include public integration when public feature flag is enabled', async () => {
    mockIntegrationRepo.find.mockResolvedValue([
      {
        id: 'int-public',
        type: 'starcomms',
        fleetId: 'fleet-public',
        ownerType: 'organization',
        ownerId: 'org-public',
        starCommsConfig: {
          baseUrl: 'https://public.starcomms.example.test',
          featureFlags: { public: true },
        },
      },
    ] as ExternalIntegration[]);

    const result = await service.listAccessibleIntegrations('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('int-public');
  });

  it('should include integration when discord manager role matches owning org guild settings', async () => {
    (isDiscordServiceInitialized as jest.Mock).mockReturnValue(true);
    (discordSettingsService.getOrganizationSettings as jest.Mock).mockResolvedValue([
      {
        guildId: 'guild-1',
        starCommsManagerRoleIds: ['role-manager'],
      },
    ]);
    mockDiscordService.getUserRoles.mockResolvedValue([{ id: 'role-manager', name: 'Manager' }]);
    mockIntegrationRepo.find.mockResolvedValue([
      {
        id: 'int-discord-manager',
        type: 'starcomms',
        fleetId: 'fleet-2',
        ownerType: 'organization',
        ownerId: 'org-2',
        starCommsConfig: {
          baseUrl: 'https://starcomms.example.test',
        },
      },
    ] as ExternalIntegration[]);

    const result = await service.listAccessibleIntegrations('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.accessSource).toBe('discord-manager');
  });

  it('should deny access when sharing disabled and owner is different org', async () => {
    mockIntegrationRepo.find.mockResolvedValue([
      {
        id: 'int-denied',
        type: 'starcomms',
        fleetId: 'fleet-2',
        ownerType: 'organization',
        ownerId: 'org-2',
        starCommsConfig: {
          baseUrl: 'https://starcomms.example.test',
          sharing: { enabled: false, whitelist: [{ type: 'organization', targetId: 'org-1' }] },
        },
      },
    ] as ExternalIntegration[]);

    const result = await service.listAccessibleIntegrations('user-1');

    expect(result).toHaveLength(0);
  });

  it('should enforce required permission policy', async () => {
    mockPermissionManager.hasPermission.mockResolvedValue(false);

    await expect(
      service.ensureIntegrationAccess('user-1', 'org-1', {
        id: 'int-policy-1',
        type: 'starcomms',
        fleetId: 'fleet-1',
        ownerType: 'organization',
        ownerId: 'org-1',
        starCommsConfig: {
          baseUrl: 'https://starcomms.example.test',
          requiredPermission: 'communications:view',
        },
      } as ExternalIntegration)
    ).rejects.toThrow('required permission');
  });

  it('should enforce minimum role priority policy', async () => {
    membershipQb.getOne.mockResolvedValueOnce({
      id: 'mem-1',
      role: { priority: 10 },
    });

    await expect(
      service.ensureIntegrationAccess('user-1', 'org-1', {
        id: 'int-policy-2',
        type: 'starcomms',
        fleetId: 'fleet-1',
        ownerType: 'organization',
        ownerId: 'org-1',
        starCommsConfig: {
          baseUrl: 'https://starcomms.example.test',
          minRolePriority: 50,
        },
      } as ExternalIntegration)
    ).rejects.toThrow('sufficient privileges');
  });

  it('should allow ensureIntegrationAccess when discord manager role matches owning org guild settings', async () => {
    (isDiscordServiceInitialized as jest.Mock).mockReturnValue(true);
    (discordSettingsService.getOrganizationSettings as jest.Mock).mockResolvedValue([
      {
        guildId: 'guild-1',
        starCommsManagerRoleIds: ['role-manager'],
      },
    ]);
    mockDiscordService.getUserRoles.mockResolvedValue([{ id: 'role-manager', name: 'Manager' }]);

    await expect(
      service.ensureIntegrationAccess('user-1', 'org-1', {
        id: 'int-discord-manager',
        type: 'starcomms',
        fleetId: 'fleet-2',
        ownerType: 'organization',
        ownerId: 'org-2',
        starCommsConfig: {
          baseUrl: 'https://starcomms.example.test',
        },
      } as ExternalIntegration)
    ).resolves.toBeUndefined();
  });
});
