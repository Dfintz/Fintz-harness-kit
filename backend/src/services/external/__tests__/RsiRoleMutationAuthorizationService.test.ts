import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { RsiRoleMapping } from '../../../models/RsiRoleMapping';
import { RsiSyncSchedule } from '../../../models/RsiSyncSchedule';
import { RsiUserLink, SyncStatus } from '../../../models/RsiUserLink';
import {
  RoleMutationAuthorizationInput,
  RsiRoleMutationAuthorizationService,
} from '../RsiRoleMutationAuthorizationService';

const getRepositoryMock = jest.fn();
const dataSourceState = { isInitialized: true };

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    get isInitialized() {
      return dataSourceState.isInitialized;
    },
    getRepository: (...args: unknown[]) => getRepositoryMock(...args),
  },
}));

const scheduleQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
};
const userLinkQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
};
const scheduleRepo = { createQueryBuilder: jest.fn(() => scheduleQueryBuilder) };
const roleMappingRepo = { exist: jest.fn() };
const userLinkRepo = { createQueryBuilder: jest.fn(() => userLinkQueryBuilder) };
const membershipRepo = { exist: jest.fn() };

const VALID_INPUT: RoleMutationAuthorizationInput = {
  organizationId: 'org-1',
  guildId: 'guild-1',
  roleId: 'role-1',
  discordUserId: 'discord-1',
};

function createService(): RsiRoleMutationAuthorizationService {
  return new RsiRoleMutationAuthorizationService();
}

describe('RsiRoleMutationAuthorizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataSourceState.isInitialized = true;

    getRepositoryMock.mockImplementation(entity => {
      if (entity === RsiSyncSchedule) {
        return scheduleRepo;
      }
      if (entity === RsiRoleMapping) {
        return roleMappingRepo;
      }
      if (entity === RsiUserLink) {
        return userLinkRepo;
      }
      if (entity === OrganizationMembership) {
        return membershipRepo;
      }
      throw new Error(`Unexpected repository: ${String((entity as { name?: string }).name)}`);
    });

    scheduleQueryBuilder.getOne.mockResolvedValue({
      organizationId: 'org-1',
      guildId: 'guild-1',
      affiliateRoleId: 'affiliate-role',
    });
    roleMappingRepo.exist.mockResolvedValue(true);
    userLinkQueryBuilder.getOne.mockResolvedValue({
      userId: 'user-1',
      verifiedAt: new Date(),
      syncStatus: SyncStatus.SYNCED,
    });
    membershipRepo.exist.mockResolvedValue(true);
  });

  it('returns an error when the data source is not initialized', async () => {
    dataSourceState.isInitialized = false;

    const result = await createService().validateRoleMutation(VALID_INPUT);

    expect(result).toBe('Role IPC authorization unavailable');
    expect(getRepositoryMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown organization with no sync schedule', async () => {
    scheduleQueryBuilder.getOne.mockResolvedValue(null);

    const result = await createService().validateRoleMutation(VALID_INPUT);

    expect(result).toBe('Unknown organization for role synchronization');
  });

  it('rejects a guild that does not match the organization schedule', async () => {
    scheduleQueryBuilder.getOne.mockResolvedValue({
      organizationId: 'org-1',
      guildId: 'other-guild',
      affiliateRoleId: undefined,
    });

    const result = await createService().validateRoleMutation(VALID_INPUT);

    expect(result).toBe('Guild is not authorized for organization role synchronization');
  });

  it('rejects a role that is neither mapped nor the affiliate role', async () => {
    roleMappingRepo.exist.mockResolvedValue(false);
    scheduleQueryBuilder.getOne.mockResolvedValue({
      organizationId: 'org-1',
      guildId: 'guild-1',
      affiliateRoleId: undefined,
    });

    const result = await createService().validateRoleMutation(VALID_INPUT);

    expect(result).toBe('Role is not allowed for this organization');
  });

  it('allows the configured affiliate role even when it is not a mapped role', async () => {
    roleMappingRepo.exist.mockResolvedValue(false);
    scheduleQueryBuilder.getOne.mockResolvedValue({
      organizationId: 'org-1',
      guildId: 'guild-1',
      affiliateRoleId: 'affiliate-role',
    });

    const result = await createService().validateRoleMutation({
      ...VALID_INPUT,
      roleId: 'affiliate-role',
    });

    expect(result).toBeNull();
  });

  it('rejects a Discord user with no verified link', async () => {
    userLinkQueryBuilder.getOne.mockResolvedValue(null);

    const result = await createService().validateRoleMutation(VALID_INPUT);

    expect(result).toBe('Discord user is not linked to an active verified organization member');
  });

  it('rejects a link whose sync status is REMOVED', async () => {
    userLinkQueryBuilder.getOne.mockResolvedValue({
      userId: 'user-1',
      verifiedAt: new Date(),
      syncStatus: SyncStatus.REMOVED,
    });

    const result = await createService().validateRoleMutation(VALID_INPUT);

    expect(result).toBe('Discord user is not linked to an active verified organization member');
  });

  it('rejects a user who is not an active organization member', async () => {
    membershipRepo.exist.mockResolvedValue(false);

    const result = await createService().validateRoleMutation(VALID_INPUT);

    expect(result).toBe('Discord user is not an active member of the organization');
  });

  it('returns null when all authorization checks pass', async () => {
    const result = await createService().validateRoleMutation(VALID_INPUT);

    expect(result).toBeNull();
  });

  it('caches schedule and role-mapping lookups across calls within the TTL', async () => {
    const service = createService();

    await service.validateRoleMutation(VALID_INPUT);
    await service.validateRoleMutation(VALID_INPUT);

    // Schedule + role mapping are cached; user link + membership are always fresh.
    expect(scheduleRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(roleMappingRepo.exist).toHaveBeenCalledTimes(1);
    expect(userLinkRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(membershipRepo.exist).toHaveBeenCalledTimes(2);
  });

  it('re-queries after caches are cleared', async () => {
    const service = createService();

    await service.validateRoleMutation(VALID_INPUT);
    service.clearCachesForTests();
    await service.validateRoleMutation(VALID_INPUT);

    expect(scheduleRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(roleMappingRepo.exist).toHaveBeenCalledTimes(2);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

