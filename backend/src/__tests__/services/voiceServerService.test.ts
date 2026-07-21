jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

import type { AccessibleVoiceServer, VoiceServerConfig } from '@sc-fleet-manager/shared-types';
import { AppDataSource } from '../../data-source';

const flushPromises = async (): Promise<void> => {
  await new Promise(resolve => setImmediate(resolve));
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Must import after mocks
const mockOrgRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockFedRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockFedMemberRepo = {
  find: jest.fn(),
};

const mockMembershipRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockDiplomacyRepo = {
  find: jest.fn(),
};

const mockRelationshipRepo = {
  find: jest.fn(),
};

(AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name: string }) => {
  switch (entity.name) {
    case 'Organization':
      return mockOrgRepo;
    case 'Federation':
      return mockFedRepo;
    case 'FederationMember':
      return mockFedMemberRepo;
    case 'OrganizationMembership':
      return mockMembershipRepo;
    case 'AllianceDiplomacy':
      return mockDiplomacyRepo;
    case 'OrganizationRelationship':
      return mockRelationshipRepo;
    default:
      return {};
  }
});

import { VoiceServerService } from '../../services/communication/voice/VoiceServerService';

describe('VoiceServerService', () => {
  let service: VoiceServerService;

  const testVoiceConfig: VoiceServerConfig = {
    enabled: true,
    serverType: 'mumble',
    host: 'mumble.example.com',
    port: 64738,
    displayName: 'Test Mumble',
    hasPassword: false,
    connectUrl: 'mumble://mumble.example.com:64738/',
    isPlatformHosted: false,
    minRolePriority: 0,
    contributeToCAS: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (VoiceServerService as unknown as Record<string, unknown>).instance = undefined;
    service = VoiceServerService.getInstance();
    (
      service as unknown as { permissionManager: { hasPermission: jest.Mock } }
    ).permissionManager.hasPermission = jest.fn().mockResolvedValue(true);
  });

  afterAll(() => {
    (VoiceServerService as unknown as Record<string, unknown>).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = VoiceServerService.getInstance();
      const instance2 = VoiceServerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getOrgVoiceConfig', () => {
    it('should return voice config from org settings', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: { voiceServer: testVoiceConfig },
      });

      const result = await service.getOrgVoiceConfig('org-1');

      expect(result).toBeDefined();
      expect(result?.host).toBe('mumble.example.com');
      expect(result?.port).toBe(64738);
      expect(result?.serverType).toBe('mumble');
      expect(mockOrgRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        select: ['id', 'settings'],
      });
    });

    it('should return null when no voice config exists', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: {},
      });

      const result = await service.getOrgVoiceConfig('org-1');
      expect(result).toBeNull();
    });

    it('should throw NotFoundError when org does not exist', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      await expect(service.getOrgVoiceConfig('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should not return password field in sanitized config', async () => {
      const configWithPassword = {
        ...testVoiceConfig,
        password: 'secret123',
      };
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: { voiceServer: configWithPassword },
      });

      const result = await service.getOrgVoiceConfig('org-1');
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('getOrgVoiceStatus', () => {
    it('should return offline status when voice is disabled', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: { voiceServer: { ...testVoiceConfig, enabled: false } },
      });

      const result = await service.getOrgVoiceStatus('org-1');
      expect(result.online).toBe(false);
      expect(result.currentUsers).toBe(0);
    });

    it('should return offline status when no voice config', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: {},
      });

      const result = await service.getOrgVoiceStatus('org-1');
      expect(result.online).toBe(false);
    });
  });

  describe('getFederationVoiceConfig', () => {
    it('should return voice config from federation settings', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: 'fed-1',
        settings: { voiceServer: testVoiceConfig },
      });

      const result = await service.getFederationVoiceConfig('fed-1');

      expect(result).toBeDefined();
      expect(result?.host).toBe('mumble.example.com');
      expect(result?.serverType).toBe('mumble');
    });

    it('should throw NotFoundError when federation does not exist', async () => {
      mockFedRepo.findOne.mockResolvedValue(null);

      await expect(service.getFederationVoiceConfig('nonexistent')).rejects.toThrow(
        'Federation not found'
      );
    });
  });

  describe('checkPlatformMumbleAccess', () => {
    let originalFedId: string | undefined;

    beforeEach(() => {
      originalFedId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
    });

    afterEach(() => {
      if (originalFedId === undefined) {
        delete process.env.PLATFORM_MUMBLE_FEDERATION_ID;
      } else {
        process.env.PLATFORM_MUMBLE_FEDERATION_ID = originalFedId;
      }
    });

    it('should return false when PLATFORM_MUMBLE_FEDERATION_ID is not set', async () => {
      delete process.env.PLATFORM_MUMBLE_FEDERATION_ID;

      const result = await service.checkPlatformMumbleAccess('user-1');
      expect(result).toBe(false);
    });

    it('should return false when federation has no active members', async () => {
      process.env.PLATFORM_MUMBLE_FEDERATION_ID = 'fed-platform';
      mockFedMemberRepo.find.mockResolvedValue([]);

      const result = await service.checkPlatformMumbleAccess('user-1');
      expect(result).toBe(false);
    });

    it('should return true when user is member of a federation org', async () => {
      process.env.PLATFORM_MUMBLE_FEDERATION_ID = 'fed-platform';
      mockFedMemberRepo.find.mockResolvedValue([
        { organizationId: 'org-a' },
        { organizationId: 'org-b' },
      ]);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'membership-1', userId: 'user-1' }),
      };
      mockMembershipRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.checkPlatformMumbleAccess('user-1');
      expect(result).toBe(true);
    });

    it('should return false when user is not member of any federation org', async () => {
      process.env.PLATFORM_MUMBLE_FEDERATION_ID = 'fed-platform';
      mockFedMemberRepo.find.mockResolvedValue([{ organizationId: 'org-a' }]);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockMembershipRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.checkPlatformMumbleAccess('user-1');
      expect(result).toBe(false);
    });
  });

  describe('getMumbleVoiceMinutes', () => {
    it('should return 0 when voice is disabled', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: { voiceServer: { ...testVoiceConfig, enabled: false } },
      });

      const result = await service.getMumbleVoiceMinutes('org-1');
      expect(result).toBe(0);
    });

    it('should return 0 when CAS contribution is disabled', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: { voiceServer: { ...testVoiceConfig, contributeToCAS: false } },
      });

      const result = await service.getMumbleVoiceMinutes('org-1');
      expect(result).toBe(0);
    });

    it('should return 0 when no voice config', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: {},
      });

      const result = await service.getMumbleVoiceMinutes('org-1');
      expect(result).toBe(0);
    });
  });

  describe('verifyAccess', () => {
    it('should pass for non-platform servers without RBAC', async () => {
      const config: VoiceServerConfig = {
        ...testVoiceConfig,
        minRolePriority: 0,
      };

      // Should not throw
      await expect(service.verifyAccess('user-1', config, 'org-1')).resolves.toBeUndefined();
    });

    it('should check role priority when minRolePriority is set', async () => {
      const config: VoiceServerConfig = {
        ...testVoiceConfig,
        minRolePriority: 50,
      };

      mockMembershipRepo.findOne.mockResolvedValue({
        id: 'mem-1',
        role: { priority: 10, name: 'member' },
      });

      await expect(service.verifyAccess('user-1', config, 'org-1')).rejects.toThrow(
        'Your role does not have sufficient privileges for voice access'
      );
    });

    it('should allow access when role priority is sufficient', async () => {
      const config: VoiceServerConfig = {
        ...testVoiceConfig,
        minRolePriority: 50,
      };

      mockMembershipRepo.findOne.mockResolvedValue({
        id: 'mem-1',
        role: { priority: 90, name: 'admin' },
      });

      await expect(service.verifyAccess('user-1', config, 'org-1')).resolves.toBeUndefined();
    });

    it('should throw when user has no membership', async () => {
      const config: VoiceServerConfig = {
        ...testVoiceConfig,
        minRolePriority: 50,
      };

      mockMembershipRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyAccess('user-1', config, 'org-1')).rejects.toThrow(
        'You must be a member of this organization'
      );
    });

    it('should enforce requiredPermission when configured', async () => {
      const config: VoiceServerConfig = {
        ...testVoiceConfig,
        requiredPermission: 'fleet:edit',
      };

      const permissionManager = (
        service as unknown as { permissionManager: { hasPermission: jest.Mock } }
      ).permissionManager;
      permissionManager.hasPermission.mockResolvedValue(false);

      await expect(service.verifyAccess('user-1', config, 'org-1')).rejects.toThrow(
        'You do not have the required permission for voice access'
      );
      expect(permissionManager.hasPermission).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        'fleet',
        'edit'
      );
    });

    it('should allow access when requiredPermission is granted', async () => {
      const config: VoiceServerConfig = {
        ...testVoiceConfig,
        requiredPermission: 'fleet:edit',
      };

      const permissionManager = (
        service as unknown as { permissionManager: { hasPermission: jest.Mock } }
      ).permissionManager;
      permissionManager.hasPermission.mockResolvedValue(true);

      await expect(service.verifyAccess('user-1', config, 'org-1')).resolves.toBeUndefined();
    });

    it('should fail closed for invalid requiredPermission format', async () => {
      const config: VoiceServerConfig = {
        ...testVoiceConfig,
        requiredPermission: 'invalid-permission-key',
      };

      await expect(service.verifyAccess('user-1', config, 'org-1')).rejects.toThrow(
        'Voice access policy is misconfigured'
      );
    });
  });

  describe('listAccessibleVoiceServers', () => {
    it('should return empty list when user has no active org memberships', async () => {
      jest.spyOn(service as any, 'loadUserOrgIds').mockResolvedValue([]);
      const loadFedSpy = jest.spyOn(service as any, 'loadUserFedIds');

      const result = await service.listAccessibleVoiceServers('user-1');

      expect(result).toEqual([]);
      expect(loadFedSpy).not.toHaveBeenCalled();
    });

    it('should aggregate own and shared sources, then enrich status for allowed entries', async () => {
      const ownOrgEntry: AccessibleVoiceServer = {
        scope: 'organization',
        ownerType: 'organization',
        ownerId: 'org-1',
        ownerName: 'Org One',
        config: { ...testVoiceConfig },
      };
      const ownFedEntry: AccessibleVoiceServer = {
        scope: 'federation',
        ownerType: 'federation',
        ownerId: 'fed-1',
        ownerName: 'Fed One',
        config: { ...testVoiceConfig },
      };
      const sharedOrgEntry: AccessibleVoiceServer = {
        scope: 'shared',
        ownerType: 'organization',
        ownerId: 'org-2',
        ownerName: 'Org Two',
        config: { ...testVoiceConfig },
      };
      const sharedFedEntry: AccessibleVoiceServer = {
        scope: 'shared',
        ownerType: 'federation',
        ownerId: 'fed-2',
        ownerName: 'Fed Two',
        config: { ...testVoiceConfig },
      };

      jest.spyOn(service as any, 'loadUserOrgIds').mockResolvedValue(['org-1']);
      jest.spyOn(service as any, 'loadUserFedIds').mockResolvedValue(['fed-1']);
      jest.spyOn(service as any, 'loadOwnOrgVoiceServers').mockResolvedValue([ownOrgEntry]);
      jest.spyOn(service as any, 'loadOwnFederationVoiceServers').mockResolvedValue([ownFedEntry]);
      jest.spyOn(service as any, 'loadSharedOrgVoiceServers').mockResolvedValue([sharedOrgEntry]);
      jest
        .spyOn(service as any, 'loadSharedFederationVoiceServers')
        .mockResolvedValue([sharedFedEntry]);
      const filterSpy = jest
        .spyOn(service as any, 'filterAccessibleByPolicy')
        .mockResolvedValue([ownOrgEntry, sharedFedEntry]);
      const attachSpy = jest.spyOn(service as any, 'attachLiveStatus').mockResolvedValue(undefined);

      const result = await service.listAccessibleVoiceServers('user-1');

      expect(filterSpy).toHaveBeenCalledWith('user-1', [
        ownOrgEntry,
        ownFedEntry,
        sharedOrgEntry,
        sharedFedEntry,
      ]);
      expect(attachSpy).toHaveBeenCalledWith([ownOrgEntry, sharedFedEntry]);
      expect(result).toEqual([ownOrgEntry, sharedFedEntry]);
    });

    it('should filter out entries the user cannot access by policy', async () => {
      const entry: AccessibleVoiceServer = {
        scope: 'organization',
        ownerType: 'organization',
        ownerId: 'org-1',
        ownerName: 'Org One',
        config: {
          ...testVoiceConfig,
          requiredPermission: 'fleet:edit',
        },
      };

      jest.spyOn(service as any, 'loadUserOrgIds').mockResolvedValue(['org-1']);
      jest.spyOn(service as any, 'loadUserFedIds').mockResolvedValue([]);
      jest.spyOn(service as any, 'loadOwnOrgVoiceServers').mockResolvedValue([entry]);
      jest.spyOn(service as any, 'loadOwnFederationVoiceServers').mockResolvedValue([]);
      jest.spyOn(service as any, 'loadSharedOrgVoiceServers').mockResolvedValue([]);
      jest.spyOn(service as any, 'loadSharedFederationVoiceServers').mockResolvedValue([]);
      jest.spyOn(service as any, 'attachLiveStatus').mockResolvedValue(undefined);

      const permissionManager = (
        service as unknown as { permissionManager: { hasPermission: jest.Mock } }
      ).permissionManager;
      permissionManager.hasPermission.mockResolvedValue(false);

      const result = await service.listAccessibleVoiceServers('user-1');
      expect(result).toEqual([]);
    });

    it('should load own and shared sources in parallel before policy filtering', async () => {
      jest.spyOn(service as any, 'loadUserOrgIds').mockResolvedValue(['org-1']);
      jest.spyOn(service as any, 'loadUserFedIds').mockResolvedValue(['fed-1']);

      const ownOrgDeferred = createDeferred<AccessibleVoiceServer[]>();
      const ownFedDeferred = createDeferred<AccessibleVoiceServer[]>();
      const sharedOrgDeferred = createDeferred<AccessibleVoiceServer[]>();
      const sharedFedDeferred = createDeferred<AccessibleVoiceServer[]>();

      const ownOrgSpy = jest
        .spyOn(service as any, 'loadOwnOrgVoiceServers')
        .mockReturnValue(ownOrgDeferred.promise);
      const ownFedSpy = jest
        .spyOn(service as any, 'loadOwnFederationVoiceServers')
        .mockReturnValue(ownFedDeferred.promise);
      const sharedOrgSpy = jest
        .spyOn(service as any, 'loadSharedOrgVoiceServers')
        .mockReturnValue(sharedOrgDeferred.promise);
      const sharedFedSpy = jest
        .spyOn(service as any, 'loadSharedFederationVoiceServers')
        .mockReturnValue(sharedFedDeferred.promise);
      const filterSpy = jest
        .spyOn(service as any, 'filterAccessibleByPolicy')
        .mockResolvedValue([]);
      const attachSpy = jest.spyOn(service as any, 'attachLiveStatus').mockResolvedValue(undefined);

      const resultPromise = service.listAccessibleVoiceServers('user-1');
      await flushPromises();

      expect(ownOrgSpy).toHaveBeenCalledTimes(1);
      expect(ownFedSpy).toHaveBeenCalledTimes(1);
      expect(sharedOrgSpy).toHaveBeenCalledTimes(1);
      expect(sharedFedSpy).toHaveBeenCalledTimes(1);
      expect(filterSpy).not.toHaveBeenCalled();

      ownOrgDeferred.resolve([]);
      ownFedDeferred.resolve([]);
      sharedOrgDeferred.resolve([]);
      sharedFedDeferred.resolve([]);

      await resultPromise;

      expect(filterSpy).toHaveBeenCalledWith('user-1', []);
      expect(attachSpy).toHaveBeenCalledWith([]);
    });

    it('should evaluate policy checks with bounded parallelism', async () => {
      const entries: AccessibleVoiceServer[] = Array.from({ length: 10 }, (_, index) => ({
        scope: 'organization',
        ownerType: 'organization',
        ownerId: `org-${index + 1}`,
        ownerName: `Org ${index + 1}`,
        config: { ...testVoiceConfig },
      }));

      const gate = createDeferred<void>();
      let inFlight = 0;
      let maxInFlight = 0;

      const verifySpy = jest.spyOn(service, 'verifyAccess').mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await gate.promise;
        inFlight -= 1;
      });

      const filterPromise = (service as any).filterAccessibleByPolicy('user-1', entries);
      await flushPromises();

      expect(verifySpy).toHaveBeenCalled();
      expect(maxInFlight).toBeGreaterThan(1);
      expect(maxInFlight).toBeLessThan(entries.length);

      gate.resolve();

      const allowed = await filterPromise;
      expect(allowed).toHaveLength(entries.length);
    });

    it('should attach live status from in-memory config without owner config lookups', async () => {
      const orgEntry: AccessibleVoiceServer = {
        scope: 'organization',
        ownerType: 'organization',
        ownerId: 'org-1',
        ownerName: 'Org One',
        config: { ...testVoiceConfig },
      };
      const fedEntry: AccessibleVoiceServer = {
        scope: 'federation',
        ownerType: 'federation',
        ownerId: 'fed-1',
        ownerName: 'Fed One',
        config: { ...testVoiceConfig },
      };

      const orgStatusSpy = jest.spyOn(service, 'getOrgVoiceStatus');
      const fedStatusSpy = jest.spyOn(service, 'getFederationVoiceStatus');
      const querySpy = jest
        .spyOn(service as any, 'queryServerStatus')
        .mockResolvedValueOnce({ online: true, currentUsers: 5, maxUsers: 100 })
        .mockResolvedValueOnce({ online: false, currentUsers: 0, maxUsers: 0 });

      await (service as any).attachLiveStatus([orgEntry, fedEntry]);

      expect(orgStatusSpy).not.toHaveBeenCalled();
      expect(fedStatusSpy).not.toHaveBeenCalled();
      expect(querySpy).toHaveBeenNthCalledWith(1, orgEntry.config, 'org:org-1');
      expect(querySpy).toHaveBeenNthCalledWith(2, fedEntry.config, 'fed:fed-1');
      expect(orgEntry.status).toEqual({ online: true, currentUsers: 5, maxUsers: 100 });
      expect(fedEntry.status).toEqual({ online: false, currentUsers: 0, maxUsers: 0 });
    });
  });

  describe('getOrgVoiceStats', () => {
    it('should return null when voice is disabled', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: {},
      });

      const result = await service.getOrgVoiceStats('org-1');
      expect(result).toBeNull();
    });
  });

  describe('getWhitelistSuggestions', () => {
    it('should throw NotFoundError when org does not exist', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      await expect(service.getWhitelistSuggestions('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should return empty array when no relationships exist', async () => {
      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1', settings: {} });
      mockFedMemberRepo.find.mockResolvedValue([]);
      mockDiplomacyRepo.find.mockResolvedValue([]);
      mockRelationshipRepo.find.mockResolvedValue([]);

      const result = await service.getWhitelistSuggestions('org-1');
      expect(result).toEqual([]);
    });

    it('should return federation suggestions from active memberships', async () => {
      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1', settings: {} });
      mockFedMemberRepo.find.mockResolvedValue([{ federationId: 'fed-1' }]);

      const mockFedQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'fed-1', name: 'Test Federation' }]),
      };
      mockFedRepo.createQueryBuilder = jest.fn().mockReturnValue(mockFedQb);

      const mockMemberQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            organizationId: 'org-2',
            organizationName: 'Allied Org',
            federationId: 'fed-1',
          },
        ]),
      };
      mockFedMemberRepo.createQueryBuilder = jest.fn().mockReturnValue(mockMemberQb);

      mockDiplomacyRepo.find.mockResolvedValue([]);
      mockRelationshipRepo.find.mockResolvedValue([]);

      const result = await service.getWhitelistSuggestions('org-1');

      expect(result).toHaveLength(2);
      const fedSuggestion = result.find(s => s.targetId === 'fed-1');
      expect(fedSuggestion).toBeDefined();
      expect(fedSuggestion?.type).toBe('federation');
      expect(fedSuggestion?.source).toBe('federation_membership');

      const orgSuggestion = result.find(s => s.targetId === 'org-2');
      expect(orgSuggestion).toBeDefined();
      expect(orgSuggestion?.type).toBe('organization');
      expect(orgSuggestion?.targetName).toBe('Allied Org');
    });

    it('should return diplomacy suggestions from active alliances', async () => {
      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1', settings: {} });
      mockFedMemberRepo.find.mockResolvedValue([]);
      mockDiplomacyRepo.find.mockResolvedValue([
        { orgId1: 'org-1', orgId2: 'org-3', allianceType: 'full_alliance' },
        { orgId1: 'org-4', orgId2: 'org-1', allianceType: 'trade' },
      ]);

      const mockOrgQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'org-3', name: 'Full Alliance Org' },
          { id: 'org-4', name: 'Trade Partner Org' },
        ]),
      };
      mockOrgRepo.createQueryBuilder = jest.fn().mockReturnValue(mockOrgQb);

      mockRelationshipRepo.find.mockResolvedValue([]);

      const result = await service.getWhitelistSuggestions('org-1');

      expect(result).toHaveLength(2);
      const allianceSuggestion = result.find(s => s.targetId === 'org-3');
      expect(allianceSuggestion?.source).toBe('alliance_diplomacy');
      expect(allianceSuggestion?.sourceLabel).toBe('Full Alliance');

      const tradeSuggestion = result.find(s => s.targetId === 'org-4');
      expect(tradeSuggestion?.source).toBe('alliance_diplomacy');
      expect(tradeSuggestion?.sourceLabel).toBe('Trade Alliance');
    });

    it('should return relationship suggestions from positive relationships', async () => {
      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1', settings: {} });
      mockFedMemberRepo.find.mockResolvedValue([]);
      mockDiplomacyRepo.find.mockResolvedValue([]);
      mockRelationshipRepo.find.mockResolvedValue([
        { targetOrganizationId: 'org-5', type: 'allied' },
        { targetOrganizationId: 'org-6', type: 'partnership' },
      ]);

      const mockOrgQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'org-5', name: 'Allied Partner' },
          { id: 'org-6', name: 'Business Partner' },
        ]),
      };
      mockOrgRepo.createQueryBuilder = jest.fn().mockReturnValue(mockOrgQb);

      const result = await service.getWhitelistSuggestions('org-1');

      expect(result).toHaveLength(2);
      const alliedSuggestion = result.find(s => s.targetId === 'org-5');
      expect(alliedSuggestion?.source).toBe('organization_relationship');
      expect(alliedSuggestion?.sourceLabel).toBe('Allied');

      const partnerSuggestion = result.find(s => s.targetId === 'org-6');
      expect(partnerSuggestion?.source).toBe('organization_relationship');
      expect(partnerSuggestion?.sourceLabel).toBe('Partnership');
    });

    it('should mark already-whitelisted suggestions', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: {
          voiceServer: {
            enabled: true,
            serverType: 'mumble',
            host: 'test.com',
            port: 64738,
            sharing: {
              enabled: true,
              whitelist: [{ type: 'organization', targetId: 'org-3', targetName: 'Already Added' }],
            },
          },
        },
      });
      mockFedMemberRepo.find.mockResolvedValue([]);
      mockDiplomacyRepo.find.mockResolvedValue([
        { orgId1: 'org-1', orgId2: 'org-3', allianceType: 'full_alliance' },
      ]);

      const mockOrgQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'org-3', name: 'Already Added' }]),
      };
      mockOrgRepo.createQueryBuilder = jest.fn().mockReturnValue(mockOrgQb);

      mockRelationshipRepo.find.mockResolvedValue([]);

      const result = await service.getWhitelistSuggestions('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].alreadyWhitelisted).toBe(true);
    });

    it('should de-duplicate suggestions from multiple sources', async () => {
      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1', settings: {} });

      // org-2 appears in both federation and diplomacy
      mockFedMemberRepo.find.mockResolvedValue([{ federationId: 'fed-1' }]);

      const mockFedQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'fed-1', name: 'Test Fed' }]),
      };
      mockFedRepo.createQueryBuilder = jest.fn().mockReturnValue(mockFedQb);

      const mockFedMemberQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { organizationId: 'org-2', organizationName: 'Shared Org', federationId: 'fed-1' },
          ]),
      };
      mockFedMemberRepo.createQueryBuilder = jest.fn().mockReturnValue(mockFedMemberQb);

      // Same org also has diplomacy
      mockDiplomacyRepo.find.mockResolvedValue([
        { orgId1: 'org-1', orgId2: 'org-2', allianceType: 'trade' },
      ]);

      const mockOrgQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'org-2', name: 'Shared Org' }]),
      };
      mockOrgRepo.createQueryBuilder = jest.fn().mockReturnValue(mockOrgQb);

      mockRelationshipRepo.find.mockResolvedValue([]);

      const result = await service.getWhitelistSuggestions('org-1');

      // org-2 should appear only once (first source wins = federation)
      const org2Suggestions = result.filter(s => s.targetId === 'org-2');
      expect(org2Suggestions).toHaveLength(1);
      expect(org2Suggestions[0].source).toBe('federation_membership');
    });
  });

  describe('getFederationWhitelistSuggestions', () => {
    it('should throw NotFoundError when federation does not exist', async () => {
      mockFedRepo.findOne.mockResolvedValue(null);

      await expect(service.getFederationWhitelistSuggestions('fed-missing')).rejects.toThrow(
        'Federation not found'
      );
    });

    it('should return member org and shared federation suggestions', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: 'fed-main',
        settings: {
          voiceServer: {
            enabled: true,
            serverType: 'mumble',
            host: 'voice.example.com',
            port: 64738,
            sharing: {
              enabled: true,
              whitelist: [{ type: 'organization', targetId: 'org-2', targetName: 'Org Two' }],
            },
          },
        },
      });

      mockFedMemberRepo.find
        .mockResolvedValueOnce([
          { organizationId: 'org-1', organizationName: 'Org One' },
          { organizationId: 'org-2', organizationName: 'Org Two' },
        ])
        .mockResolvedValueOnce([
          { federationId: 'fed-main', organizationId: 'org-1' },
          { federationId: 'fed-ally', organizationId: 'org-1' },
        ]);

      mockFedRepo.find.mockResolvedValue([{ id: 'fed-ally', name: 'Ally Federation' }]);
      mockDiplomacyRepo.find.mockResolvedValue([]);
      mockRelationshipRepo.find.mockResolvedValue([]);

      const result = await service.getFederationWhitelistSuggestions('fed-main');

      const memberSuggestion = result.find(s => s.targetId === 'org-1');
      expect(memberSuggestion).toBeDefined();
      expect(memberSuggestion?.type).toBe('organization');
      expect(memberSuggestion?.source).toBe('federation_membership');

      const whitelistedMember = result.find(s => s.targetId === 'org-2');
      expect(whitelistedMember).toBeDefined();
      expect(whitelistedMember?.alreadyWhitelisted).toBe(true);

      const sharedFedSuggestion = result.find(s => s.targetId === 'fed-ally');
      expect(sharedFedSuggestion).toBeDefined();
      expect(sharedFedSuggestion?.type).toBe('federation');
      expect(sharedFedSuggestion?.source).toBe('federation_membership');
    });
  });

  describe('getFederationWhitelistSuggestionsForUser', () => {
    it('should enforce federation access before returning suggestions', async () => {
      const accessSpy = jest
        .spyOn(service as any, 'requireUserFederationAccess')
        .mockResolvedValue(undefined);
      const suggestionsSpy = jest
        .spyOn(service, 'getFederationWhitelistSuggestions')
        .mockResolvedValue([]);

      const result = await service.getFederationWhitelistSuggestionsForUser('fed-1', 'user-1');

      expect(accessSpy).toHaveBeenCalledWith('user-1', 'fed-1');
      expect(suggestionsSpy).toHaveBeenCalledWith('fed-1');
      expect(result).toEqual([]);
    });
  });
});
