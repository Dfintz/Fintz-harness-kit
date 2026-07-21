import { AppDataSource } from '../../../data-source';
import { BlacklistSharingConfig } from '../../../models/BlacklistSharingConfig';
import {
  ModerationIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../../../models/ModerationIncident';
import {
  OrganizationRelationship,
  RelationshipType,
  RelationshipStatus,
} from '../../../models/OrganizationRelationship';
import { BlacklistSharingService } from '../BlacklistSharingService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');
jest.mock('../../../websocket/websocketServer', () => ({
  emitToOrganization: jest.fn(),
}));

import { emitToOrganization } from '../../../websocket/websocketServer';

describe('BlacklistSharingService', () => {
  let sharingService: BlacklistSharingService;
  let mockConfigRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockRelationshipRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockIncidentRepository: jest.Mocked<Record<string, jest.Mock>>;

  // Test data
  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testUserName = 'TestModerator';
  const allyOrgId = 'org-ally-456';
  const targetDiscordId = '987654321098765432';

  const mockConfig: BlacklistSharingConfig = {
    id: 'config-123',
    organizationId: testOrgId,
    shareWarnings: false,
    shareTimeouts: true,
    shareKicks: true,
    shareBans: true,
    receiveAlerts: true,
    minAlertSeverity: 2,
    alertChannelId: '123456789',
    autoShareWithAllies: true,
    autoShareMinSeverity: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    sharedWithOrgs: [],
    shouldShareIncidentType: jest.fn((type: string) => {
      if (type === 'warning') return false;
      return true;
    }),
    shouldAlert: jest.fn((severity: number) => severity >= 2),
    shouldAutoShare: jest.fn((severity: number) => severity >= 3),
    getSharingSummary: jest.fn(() => ({
      sharingEnabled: true,
      sharedTypes: ['timeouts', 'kicks', 'bans'],
      alertsEnabled: true,
      alertChannel: '123456789',
    })),
    isSharedWith: jest.fn(),
    canAccessFromOrg: jest.fn(),
    addSharedOrg: jest.fn(),
    removeSharedOrg: jest.fn(),
    isOwnedBy: jest.fn(),
    getAccessibleOrgs: jest.fn(),
    isSoftDeleted: jest.fn(),
    isNotDeleted: jest.fn(),
  } as unknown as BlacklistSharingConfig;

  const mockIncident: ModerationIncident = {
    id: 'incident-123',
    organizationId: testOrgId,
    guildId: '123456789012345678',
    guildName: 'Test Guild',
    targetDiscordId,
    targetUsername: 'TestTarget',
    moderatorId: testUserId,
    moderatorDiscordId: testUserId,
    moderatorUsername: testUserName,
    incidentType: IncidentType.BAN,
    severity: IncidentSeverity.BAN,
    status: IncidentStatus.ACTIVE,
    reason: 'Test ban reason',
    isShared: true,
    isAutoDetected: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sharedWithOrgs: [],
    isActive: jest.fn(() => true),
    isExpired: jest.fn(() => false),
    getSeverityLabel: jest.fn(() => 'Ban'),
    getSeverityEmoji: jest.fn(() => '🔨'),
    isSharedWith: jest.fn(),
    canAccessFromOrg: jest.fn(),
    addSharedOrg: jest.fn(),
    removeSharedOrg: jest.fn(),
    isOwnedBy: jest.fn(),
    getAccessibleOrgs: jest.fn(),
    isSoftDeleted: jest.fn(),
    isNotDeleted: jest.fn(),
  } as unknown as ModerationIncident;

  const mockAllyRelationship: OrganizationRelationship = {
    id: 'rel-123',
    organizationId: testOrgId,
    targetOrganizationId: allyOrgId,
    type: RelationshipType.ALLIED,
    status: RelationshipStatus.ACTIVE,
    isMutual: true,
    trustScore: 80,
    relationshipStrength: 75,
    interactionCount: 10,
    positiveInteractions: 8,
    negativeInteractions: 2,
    isPublic: false,
    requiresApproval: false,
    autoRenew: false,
    isMutuallyRecognized: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OrganizationRelationship;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config repository
    mockConfigRepository = {
      create: jest.fn(data => ({ ...mockConfig, ...data })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(() => Promise.resolve([])),
      })),
      metadata: { name: 'BlacklistSharingConfig' },
    };

    // Mock relationship repository
    mockRelationshipRepository = {
      find: jest.fn(() => Promise.resolve([mockAllyRelationship])),
    };

    // Mock incident repository
    mockIncidentRepository = {
      find: jest.fn(() => Promise.resolve([mockIncident])),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn(() => Promise.resolve(1)),
        getMany: jest.fn(() => Promise.resolve([mockIncident])),
      })),
    };

    // Mock AppDataSource.getRepository to return appropriate mock based on entity
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === BlacklistSharingConfig) {
        return mockConfigRepository;
      }
      if (entity === OrganizationRelationship) {
        return mockRelationshipRepository;
      }
      if (entity === ModerationIncident) {
        return mockIncidentRepository;
      }
      return mockConfigRepository;
    });

    // Create service instance
    sharingService = new BlacklistSharingService();
  });

  describe('getConfig', () => {
    it('should return existing config when found', async () => {
      mockConfigRepository.findOne.mockResolvedValue(mockConfig);

      const result = await sharingService.getConfig(testOrgId);

      expect(result).toBeDefined();
      expect(result.organizationId).toBe(testOrgId);
    });

    it('should create default config when none exists', async () => {
      mockConfigRepository.findOne.mockResolvedValue(null);

      const result = await sharingService.getConfig(testOrgId);

      expect(mockConfigRepository.create).toHaveBeenCalled();
      expect(mockConfigRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update sharing configuration', async () => {
      mockConfigRepository.findOne.mockResolvedValue(mockConfig);

      const updates = {
        shareWarnings: true,
        receiveAlerts: false,
      };

      const result = await sharingService.updateConfig(
        testOrgId,
        testUserId,
        testUserName,
        updates
      );

      expect(result).toBeDefined();
    });

    it('should throw error for invalid severity values', async () => {
      mockConfigRepository.findOne.mockResolvedValue(mockConfig);

      await expect(
        sharingService.updateConfig(testOrgId, testUserId, testUserName, { minAlertSeverity: 10 })
      ).rejects.toThrow('minAlertSeverity must be between 1 and 5');
    });
  });

  describe('getAlliedOrganizations', () => {
    it('should return allied organizations with positive relationship types', async () => {
      mockRelationshipRepository.find.mockResolvedValue([mockAllyRelationship]);

      const result = await sharingService.getAlliedOrganizations(testOrgId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no allies found', async () => {
      mockRelationshipRepository.find.mockResolvedValue([]);

      const result = await sharingService.getAlliedOrganizations(testOrgId);

      expect(result).toEqual([]);
    });
  });

  describe('shareIncidentWithAllies', () => {
    it('should share incident with allied organizations', async () => {
      mockConfigRepository.findOne.mockResolvedValue(mockConfig);
      mockRelationshipRepository.find.mockResolvedValue([mockAllyRelationship]);

      // Mock the ally's config as well
      const allyConfig = { ...mockConfig, organizationId: allyOrgId };
      mockConfigRepository.findOne.mockImplementation(opts => {
        if (opts?.where?.organizationId === allyOrgId) {
          return Promise.resolve(allyConfig);
        }
        return Promise.resolve(mockConfig);
      });

      const result = await sharingService.shareIncidentWithAllies(
        mockIncident,
        testOrgId,
        testUserId,
        testUserName
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should not share if incident type is not configured for sharing', async () => {
      const warningIncident = { ...mockIncident, incidentType: IncidentType.WARNING };
      mockConfigRepository.findOne.mockResolvedValue(mockConfig);

      const result = await sharingService.shareIncidentWithAllies(
        warningIncident as ModerationIncident,
        testOrgId,
        testUserId,
        testUserName
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when no allies exist', async () => {
      mockConfigRepository.findOne.mockResolvedValue(mockConfig);
      mockRelationshipRepository.find.mockResolvedValue([]);

      const result = await sharingService.shareIncidentWithAllies(
        mockIncident,
        testOrgId,
        testUserId,
        testUserName
      );

      expect(result).toEqual([]);
    });
  });

  describe('getIncidentFeed', () => {
    it('should return paginated incident feed', async () => {
      mockRelationshipRepository.find.mockResolvedValue([mockAllyRelationship]);

      const result = await sharingService.getIncidentFeed(testOrgId, {
        page: 1,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.incidents).toBeDefined();
      expect(Array.isArray(result.incidents)).toBe(true);
    });

    it('should filter by minimum severity', async () => {
      mockRelationshipRepository.find.mockResolvedValue([mockAllyRelationship]);

      const result = await sharingService.getIncidentFeed(testOrgId, {
        minSeverity: IncidentSeverity.KICK,
      });

      expect(result).toBeDefined();
    });

    it('should return empty array when no conditions match', async () => {
      mockRelationshipRepository.find.mockResolvedValue([]);

      const result = await sharingService.getIncidentFeed(testOrgId, {
        includeOwn: false,
        includeShared: true,
      });

      expect(result.incidents).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('checkUserAcrossAllies', () => {
    it('should return combined incidents from own org and allies', async () => {
      mockIncidentRepository.find.mockResolvedValue([mockIncident]);
      mockRelationshipRepository.find.mockResolvedValue([mockAllyRelationship]);

      const result = await sharingService.checkUserAcrossAllies(testOrgId, targetDiscordId);

      expect(result).toBeDefined();
      expect(result.ownIncidents).toBeDefined();
      expect(result.alliedIncidents).toBeDefined();
      expect(result.totalIncidents).toBeGreaterThanOrEqual(0);
    });

    it('should calculate highest severity correctly', async () => {
      const banIncident = { ...mockIncident, severity: IncidentSeverity.BAN };
      mockIncidentRepository.find.mockResolvedValue([banIncident as ModerationIncident]);
      mockRelationshipRepository.find.mockResolvedValue([]);

      const result = await sharingService.checkUserAcrossAllies(testOrgId, targetDiscordId);

      expect(result.highestSeverity).toBe(IncidentSeverity.BAN);
    });

    it('should detect active incidents', async () => {
      const activeIncident = { ...mockIncident, status: IncidentStatus.ACTIVE };
      mockIncidentRepository.find.mockResolvedValue([activeIncident as ModerationIncident]);
      mockRelationshipRepository.find.mockResolvedValue([]);

      const result = await sharingService.checkUserAcrossAllies(testOrgId, targetDiscordId);

      expect(result.hasActiveIncident).toBe(true);
    });
  });

  describe('BlacklistSharingConfig model methods', () => {
    const config = new BlacklistSharingConfig();

    beforeEach(() => {
      config.shareWarnings = false;
      config.shareTimeouts = true;
      config.shareKicks = true;
      config.shareBans = true;
      config.receiveAlerts = true;
      config.minAlertSeverity = 2;
      config.autoShareWithAllies = true;
      config.autoShareMinSeverity = 3;
    });

    it('shouldShareIncidentType returns correct values', () => {
      expect(config.shouldShareIncidentType('warning')).toBe(false);
      expect(config.shouldShareIncidentType('timeout')).toBe(true);
      expect(config.shouldShareIncidentType('long_timeout')).toBe(true);
      expect(config.shouldShareIncidentType('kick')).toBe(true);
      expect(config.shouldShareIncidentType('ban')).toBe(true);
    });

    it('shouldAlert returns correct values based on severity', () => {
      expect(config.shouldAlert(1)).toBe(false);
      expect(config.shouldAlert(2)).toBe(true);
      expect(config.shouldAlert(5)).toBe(true);
    });

    it('shouldAutoShare returns correct values based on severity', () => {
      expect(config.shouldAutoShare(2)).toBe(false);
      expect(config.shouldAutoShare(3)).toBe(true);
      expect(config.shouldAutoShare(5)).toBe(true);
    });

    it('getSharingSummary returns correct summary', () => {
      const summary = config.getSharingSummary();
      expect(summary.sharingEnabled).toBe(true);
      expect(summary.sharedTypes).toContain('timeouts');
      expect(summary.sharedTypes).toContain('kicks');
      expect(summary.sharedTypes).toContain('bans');
      expect(summary.sharedTypes).not.toContain('warnings');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

