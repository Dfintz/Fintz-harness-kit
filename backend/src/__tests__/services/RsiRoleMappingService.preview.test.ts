import type { RsiRoleMapping } from '../../models/RsiRoleMapping';
import { RsiRoleMappingService } from '../../services/external/RsiRoleMappingService';

const mockRoleRepo = { find: jest.fn() };

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: { name?: string }) => {
      if (entity?.name === 'Role') {
        return mockRoleRepo;
      }
      return { createQueryBuilder: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    }),
  },
}));

interface MappingOverrides {
  rsiRank: string;
  isActive?: boolean;
  priority?: number;
  discordRoleId?: string | null;
  internalRoleId?: string | null;
  permissions?: string[];
}

const makeMapping = (over: MappingOverrides) =>
  ({
    id: `m-${over.rsiRank}`,
    isActive: true,
    priority: 0,
    discordRoleId: null,
    internalRoleId: null,
    getEnabledPermissions: () => over.permissions ?? [],
    ...over,
  }) as unknown as RsiRoleMapping;

type Discovered = Awaited<ReturnType<RsiRoleMappingService['getDiscoveredRanks']>>;

const makeDiscovered = (
  rankMap: Array<{ stars: number; name: string; count: number }>
): Discovered => ({
  roles: rankMap.map(r => r.name),
  ranks: [],
  rankMap,
  orgRoles: [],
});

describe('RsiRoleMappingService.buildSyncPreview', () => {
  let service: RsiRoleMappingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RsiRoleMappingService();
    mockRoleRepo.find.mockResolvedValue([]);
  });

  it('builds entries with member counts and flags unmapped ranks', async () => {
    jest
      .spyOn(service, 'getMappingsByOrganization')
      .mockResolvedValue([
        makeMapping({ rsiRank: 'Officer', discordRoleId: 'd1', permissions: ['orgManage'] }),
      ]);
    jest.spyOn(service, 'getDiscoveredRanks').mockResolvedValue(
      makeDiscovered([
        { stars: 3, name: 'Officer', count: 5 },
        { stars: 1, name: 'Member', count: 20 },
      ])
    );

    const preview = await service.buildSyncPreview('org-1');

    expect(preview.entries).toHaveLength(1);
    expect(preview.entries[0]).toMatchObject({
      rsiRank: 'Officer',
      affectedMemberCount: 5,
      permissions: ['orgManage'],
    });
    expect(preview.warnings).toContainEqual(
      expect.objectContaining({ type: 'unmapped_rank', rsiRank: 'Member', memberCount: 20 })
    );
    expect(preview.summary).toMatchObject({
      totalMappings: 1,
      activeMappings: 1,
      knownAffectedMemberCount: 5,
      unmappedMemberCount: 20,
      unmappedRankCount: 1,
      coveragePercent: 20,
    });
  });

  it('reports affectedMemberCount = null for ranks absent from discovery (org roles)', async () => {
    jest
      .spyOn(service, 'getMappingsByOrganization')
      .mockResolvedValue([makeMapping({ rsiRank: 'CEO', discordRoleId: 'd1' })]);
    jest.spyOn(service, 'getDiscoveredRanks').mockResolvedValue(makeDiscovered([]));

    const preview = await service.buildSyncPreview('org-1');

    expect(preview.entries[0].affectedMemberCount).toBeNull();
    expect(preview.warnings).toContainEqual(
      expect.objectContaining({ type: 'rank_no_members', rsiRank: 'CEO' })
    );
  });

  it('flags duplicate Discord role targets across active mappings', async () => {
    jest
      .spyOn(service, 'getMappingsByOrganization')
      .mockResolvedValue([
        makeMapping({ rsiRank: 'Officer', discordRoleId: 'dup' }),
        makeMapping({ rsiRank: 'Lead', discordRoleId: 'dup' }),
      ]);
    jest.spyOn(service, 'getDiscoveredRanks').mockResolvedValue(
      makeDiscovered([
        { stars: 3, name: 'Officer', count: 2 },
        { stars: 4, name: 'Lead', count: 1 },
      ])
    );

    const preview = await service.buildSyncPreview('org-1');

    expect(preview.warnings).toContainEqual(
      expect.objectContaining({ type: 'duplicate_discord_role', discordRoleId: 'dup' })
    );
  });

  it('flags inactive + missing-internal-role mappings and resolves internal role names', async () => {
    jest
      .spyOn(service, 'getMappingsByOrganization')
      .mockResolvedValue([
        makeMapping({ rsiRank: 'Officer', isActive: false }),
        makeMapping({ rsiRank: 'Lead', internalRoleId: 'role-missing' }),
        makeMapping({ rsiRank: 'Member', internalRoleId: 'role-ok' }),
      ]);
    jest.spyOn(service, 'getDiscoveredRanks').mockResolvedValue(
      makeDiscovered([
        { stars: 3, name: 'Officer', count: 2 },
        { stars: 4, name: 'Lead', count: 1 },
        { stars: 1, name: 'Member', count: 9 },
      ])
    );
    mockRoleRepo.find.mockResolvedValue([{ id: 'role-ok', name: 'Member Role' }]);

    const preview = await service.buildSyncPreview('org-1');

    expect(preview.warnings).toContainEqual(
      expect.objectContaining({ type: 'inactive_mapping', rsiRank: 'Officer' })
    );
    expect(preview.warnings).toContainEqual(
      expect.objectContaining({ type: 'missing_internal_role', rsiRank: 'Lead' })
    );
    expect(preview.entries.find(e => e.rsiRank === 'Member')?.internalRoleName).toBe('Member Role');
  });

  it('returns null coverage when there are no known members', async () => {
    jest.spyOn(service, 'getMappingsByOrganization').mockResolvedValue([]);
    jest.spyOn(service, 'getDiscoveredRanks').mockResolvedValue(makeDiscovered([]));

    const preview = await service.buildSyncPreview('org-1');

    expect(preview.summary.coveragePercent).toBeNull();
    expect(preview.entries).toHaveLength(0);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
