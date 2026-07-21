import { SyncStatus, VerificationMethod } from '../../models/RsiUserLink';
import { RsiUserLinkService, rsiUserLinkService } from '../../services/external/RsiUserLinkService';

// Mock TeamService before RsiUserLinkService imports it
jest.mock('../../services/team/TeamService', () => ({
  TeamService: jest.fn().mockImplementation(() => ({
    addMemberToTeam: jest.fn(),
    removeMemberFromTeam: jest.fn(),
  })),
}));

// Mock the dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      create: jest.fn((data: Record<string, unknown>) => ({ id: 'test-uuid', ...data })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'test-uuid', ...entity })
      ),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    })),
  },
}));

// Mock the data-source (used by RsiUserLinkService constructor)
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      create: jest.fn((data: Record<string, unknown>) => ({ id: 'test-uuid', ...data })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'test-uuid', ...entity })
      ),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    })),
    isInitialized: true,
  },
}));

// Mock the RSI API service
jest.mock('../../services/external/RSIApiService', () => ({
  rsiApiService: {
    fetchUserData: jest.fn(),
    verifyOrganizationMembership: jest.fn(),
  },
}));

// Mock the RSI Role Sync service
jest.mock('../../services/external/RsiRoleSyncService', () => ({
  rsiRoleSyncService: {
    verifyAndCacheMember: jest.fn(),
  },
}));

// Mock the RSI Role Mapping service
jest.mock('../../services/external/RsiRoleMappingService', () => ({
  rsiRoleMappingService: {
    getMappingByRank: jest.fn(),
    getMappingsByOrganization: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('RsiUserLinkService', () => {
  let service: RsiUserLinkService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RsiUserLinkService();
  });

  describe('Constructor', () => {
    it('should initialize the service', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(RsiUserLinkService);
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(rsiUserLinkService).toBeDefined();
      expect(rsiUserLinkService).toBeInstanceOf(RsiUserLinkService);
    });
  });
});

describe('RsiUserLink Model', () => {
  describe('VerificationMethod enum', () => {
    it('should have correct values', () => {
      expect(VerificationMethod.MANUAL).toBe('manual');
      expect(VerificationMethod.BIO_CODE).toBe('bio_code');
      expect(VerificationMethod.DISCORD_MATCH).toBe('discord_match');
    });
  });

  describe('SyncStatus enum', () => {
    it('should have correct values', () => {
      expect(SyncStatus.PENDING).toBe('pending');
      expect(SyncStatus.SYNCED).toBe('synced');
      expect(SyncStatus.FAILED).toBe('failed');
      expect(SyncStatus.REMOVED).toBe('removed');
    });
  });
});

describe('RsiUserLink Static Methods', () => {
  describe('generateVerificationCode', () => {
    it('should generate a code starting with SCFM-', async () => {
      // Import the model directly to access static method
      const { RsiUserLink } = await import('../../models/RsiUserLink');
      const code = RsiUserLink.generateVerificationCode();

      expect(code).toBeDefined();
      expect(code.startsWith('SCFM-')).toBe(true);
    });

    it('should generate a code with correct length', async () => {
      const { RsiUserLink } = await import('../../models/RsiUserLink');
      const code = RsiUserLink.generateVerificationCode();

      // SCFM- (5 chars) + 8 random chars = 13 total
      expect(code.length).toBe(13);
    });

    it('should generate unique codes', async () => {
      const { RsiUserLink } = await import('../../models/RsiUserLink');
      const codes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        codes.add(RsiUserLink.generateVerificationCode());
      }

      // All 100 codes should be unique (statistically very likely)
      expect(codes.size).toBe(100);
    });
  });
});

describe('RsiUserLink Instance Methods', () => {
  let linkInstance: {
    verifiedAt?: Date;
    syncStatus: string;
    discordUserId?: string;
    isVerified: () => boolean;
    isSynced: () => boolean;
    isPending: () => boolean;
    isRemoved: () => boolean;
    hasFailed: () => boolean;
    hasDiscordId: () => boolean;
  };

  beforeEach(async () => {
    const { RsiUserLink, SyncStatus } = await import('../../models/RsiUserLink');
    linkInstance = new RsiUserLink();
    linkInstance.syncStatus = SyncStatus.PENDING;
  });

  describe('isVerified', () => {
    it('should return false when verifiedAt is not set', () => {
      linkInstance.verifiedAt = undefined;
      expect(linkInstance.isVerified()).toBe(false);
    });

    it('should return true when verifiedAt is set', () => {
      linkInstance.verifiedAt = new Date();
      expect(linkInstance.isVerified()).toBe(true);
    });
  });

  describe('isSynced', () => {
    it('should return true when syncStatus is SYNCED', () => {
      linkInstance.syncStatus = SyncStatus.SYNCED;
      expect(linkInstance.isSynced()).toBe(true);
    });

    it('should return false when syncStatus is not SYNCED', () => {
      linkInstance.syncStatus = SyncStatus.PENDING;
      expect(linkInstance.isSynced()).toBe(false);
    });
  });

  describe('isPending', () => {
    it('should return true when syncStatus is PENDING', () => {
      linkInstance.syncStatus = SyncStatus.PENDING;
      expect(linkInstance.isPending()).toBe(true);
    });

    it('should return false when syncStatus is not PENDING', () => {
      linkInstance.syncStatus = SyncStatus.SYNCED;
      expect(linkInstance.isPending()).toBe(false);
    });
  });

  describe('isRemoved', () => {
    it('should return true when syncStatus is REMOVED', () => {
      linkInstance.syncStatus = SyncStatus.REMOVED;
      expect(linkInstance.isRemoved()).toBe(true);
    });

    it('should return false when syncStatus is not REMOVED', () => {
      linkInstance.syncStatus = SyncStatus.SYNCED;
      expect(linkInstance.isRemoved()).toBe(false);
    });
  });

  describe('hasFailed', () => {
    it('should return true when syncStatus is FAILED', () => {
      linkInstance.syncStatus = SyncStatus.FAILED;
      expect(linkInstance.hasFailed()).toBe(true);
    });

    it('should return false when syncStatus is not FAILED', () => {
      linkInstance.syncStatus = SyncStatus.SYNCED;
      expect(linkInstance.hasFailed()).toBe(false);
    });
  });

  describe('hasDiscordId', () => {
    it('should return true when discordUserId is set', () => {
      linkInstance.discordUserId = '123456789012345678';
      expect(linkInstance.hasDiscordId()).toBe(true);
    });

    it('should return false when discordUserId is not set', () => {
      linkInstance.discordUserId = undefined;
      expect(linkInstance.hasDiscordId()).toBe(false);
    });

    it('should return false when discordUserId is empty', () => {
      linkInstance.discordUserId = '';
      expect(linkInstance.hasDiscordId()).toBe(false);
    });
  });
});

describe('AffiliateHandling enum', () => {
  it('should have correct values', async () => {
    const { AffiliateHandling } = await import('../../services/external/RsiUserLinkService');

    expect(AffiliateHandling.INCLUDE).toBe('include');
    expect(AffiliateHandling.EXCLUDE).toBe('exclude');
    expect(AffiliateHandling.SPECIAL_ROLE).toBe('special_role');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
