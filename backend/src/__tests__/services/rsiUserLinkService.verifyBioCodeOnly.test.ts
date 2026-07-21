import { QueryFailedError } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { rsiApiService } from '../../services/external/RSIApiService';
import { rsiCrawlerService } from '../../services/external/RsiCrawlerService';
import { RsiUserLinkService } from '../../services/external/RsiUserLinkService';
import { buildRsiVerificationUrl } from '../../utils/rsiVerificationToken';

jest.mock('../../services/team/TeamService', () => ({
  TeamService: jest.fn().mockImplementation(() => ({
    addMemberToTeam: jest.fn(),
    removeMemberFromTeam: jest.fn(),
  })),
}));

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    isInitialized: true,
  },
}));

jest.mock('../../services/external/RSIApiService', () => ({
  rsiApiService: {
    fetchUserData: jest.fn(),
    verifyOrganizationMembership: jest.fn(),
  },
}));

jest.mock('../../services/external/RsiCrawlerService', () => ({
  rsiCrawlerService: {
    invalidateCitizenCache: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type VerifyBioCodeOnlyLink = Parameters<RsiUserLinkService['verifyBioCodeOnly']>[0];

type MockUserLinkRepository = {
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  find: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
};

type MockUserRepository = {
  findOne: jest.Mock;
  update: jest.Mock;
};

type MockRoleMappingRepository = {
  findOne: jest.Mock;
  find: jest.Mock;
};

function makeLink(overrides: Partial<VerifyBioCodeOnlyLink> = {}): VerifyBioCodeOnlyLink {
  return {
    id: 'link-1',
    userId: 'user-1',
    organizationId: 'org-1',
    rsiHandle: 'PilotOne',
    verificationCode: 'SCFM-ABC123FF',
    verificationMethod: 'bio_code',
    markVerified: jest.fn(),
    ...overrides,
  } as unknown as VerifyBioCodeOnlyLink;
}

describe('RsiUserLinkService.verifyBioCodeOnly', () => {
  let service: RsiUserLinkService;
  let mockUserLinkRepo: MockUserLinkRepository;
  let mockUserRepo: MockUserRepository;
  let mockRoleMappingRepo: MockRoleMappingRepository;

  const mockApi = rsiApiService as jest.Mocked<typeof rsiApiService>;
  const mockCrawler = rsiCrawlerService as jest.Mocked<typeof rsiCrawlerService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserLinkRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockUserRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockRoleMappingRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    (AppDataSource.getRepository as unknown as jest.Mock).mockImplementation(
      (entity: { name?: string }) => {
        const name = entity?.name;
        if (name === 'User') {
          return mockUserRepo;
        }
        if (name === 'RsiRoleMapping') {
          return mockRoleMappingRepo;
        }
        return mockUserLinkRepo;
      }
    );

    service = new RsiUserLinkService();
  });

  it('verifies when bio contains the full verification URL token', async () => {
    const link = makeLink();
    const verificationUrl = buildRsiVerificationUrl(link.verificationCode);

    mockApi.fetchUserData.mockResolvedValue({
      bio: `Identity proof ${verificationUrl}`,
      citizenRecord: 'CR-00001',
    });
    mockUserLinkRepo.findOne.mockResolvedValue(null);
    mockUserRepo.findOne.mockResolvedValue(null);
    mockUserRepo.update.mockResolvedValue({ affected: 1 });
    mockUserLinkRepo.save.mockResolvedValue(link);

    const result = await service.verifyBioCodeOnly(link);

    expect(result).toEqual({ success: true, verified: true });
    expect(mockCrawler.invalidateCitizenCache).toHaveBeenCalledWith('PilotOne');
    expect(link.markVerified).toHaveBeenCalledTimes(1);
    expect(mockUserRepo.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        rsiHandle: 'PilotOne',
        rsiVerified: true,
        rsiCitizenRecord: 'CR-00001',
      })
    );
    expect(mockUserLinkRepo.save).toHaveBeenCalledWith(link);
  });

  it('fails when citizen record is already verified by another user', async () => {
    const link = makeLink();

    mockApi.fetchUserData.mockResolvedValue({
      bio: `proof ${buildRsiVerificationUrl(link.verificationCode)}`,
      citizenRecord: 'CR-DUPLICATE',
    });
    mockUserRepo.findOne.mockResolvedValue({ id: 'other-user' });

    const result = await service.verifyBioCodeOnly(link);

    expect(result).toEqual({
      success: false,
      verified: false,
      error: 'This RSI account is already verified by another user.',
    });
    expect(link.markVerified).not.toHaveBeenCalled();
    expect(mockUserRepo.update).not.toHaveBeenCalled();
    expect(mockUserLinkRepo.save).not.toHaveBeenCalled();
  });

  it('fails deterministically when DB unique race hits citizen-record verified index', async () => {
    const link = makeLink();

    mockApi.fetchUserData.mockResolvedValue({
      bio: `proof ${buildRsiVerificationUrl(link.verificationCode)}`,
      citizenRecord: 'CR-RACE',
    });

    mockUserLinkRepo.findOne.mockResolvedValue(null);
    mockUserRepo.findOne.mockResolvedValue(null);

    const dbRaceError = new QueryFailedError('UPDATE users SET rsi_verified = true', [], {
      code: '23505',
      constraint: 'UQ_users_rsi_citizen_record_verified',
    } as Record<string, string>);

    mockUserRepo.update.mockRejectedValue(dbRaceError);

    const result = await service.verifyBioCodeOnly(link);

    expect(result).toEqual({
      success: false,
      verified: false,
      error: 'This RSI account is already verified by another user.',
    });
    expect(link.markVerified).not.toHaveBeenCalled();
    expect(mockUserLinkRepo.save).not.toHaveBeenCalled();
  });

  it('fails in strict mode when user projection update affects zero rows', async () => {
    const link = makeLink();

    mockApi.fetchUserData.mockResolvedValue({
      bio: `proof ${buildRsiVerificationUrl(link.verificationCode)}`,
      citizenRecord: 'CR-MISSING-USER',
    });
    mockUserLinkRepo.findOne.mockResolvedValue(null);
    mockUserRepo.findOne.mockResolvedValue(null);
    mockUserRepo.update.mockResolvedValue({ affected: 0 });

    const result = await service.verifyBioCodeOnly(link);

    expect(result).toEqual({
      success: false,
      verified: false,
      error: 'User profile not found for RSI verification sync',
    });
    expect(link.markVerified).not.toHaveBeenCalled();
    expect(mockUserLinkRepo.save).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
