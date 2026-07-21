import crypto from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { Organization } from '../../models/Organization';
import { User } from '../../models/User';
import { RsiApiService } from '../../services/external/RSIApiService';
import { RsiVerificationService } from '../../services/user/RsiVerificationService';

// Mock dependencies
jest.mock('../../services/external/RSIApiService');

// Mock rsiCrawlerService — individual tests can override per-method as needed
jest.mock('../../services/external/RsiCrawlerService', () => ({
  rsiCrawlerService: {
    crawlCitizen: jest.fn().mockRejectedValue(new Error('Crawler unavailable')),
    crawlUserMemberships: jest.fn().mockRejectedValue(new Error('Crawler unavailable')),
    crawlOrganization: jest.fn().mockRejectedValue(new Error('Crawler unavailable')),
    invalidateOrgCache: jest.fn(),
  },
}));

// Import the mock so individual tests can control it
import { rsiCrawlerService } from '../../services/external/RsiCrawlerService';
const mockCrawler = rsiCrawlerService as jest.Mocked<typeof rsiCrawlerService>;

jest.mock('../../data-source', () => {
  const mockRepo = {
    findOne: jest.fn().mockResolvedValue(null),
  };
  return {
    AppDataSource: {
      getRepository: jest.fn().mockReturnValue(mockRepo),
      isInitialized: true,
    },
  };
});

// Get the mock membership repository for controlling in tests
import { AppDataSource } from '../../data-source';
const mockMembershipRepo = (AppDataSource.getRepository as jest.Mock)() as { findOne: jest.Mock };

/** Hash a verification code the same way RsiVerificationService does */
function hashVerificationCode(code: string): string {
  const secret = process.env.JWT_SECRET || 'default-hmac-secret';
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}
describe('RsiVerificationService', () => {
  let service: RsiVerificationService;
  let mockUserRepository: jest.Mocked<Repository<User>>;
  let mockOrganizationRepository: jest.Mocked<Repository<Organization>>;
  let mockRsiApiService: jest.Mocked<RsiApiService>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    discordId: 'discord-123',
    role: 'user',
    rsiHandle: undefined,
    rsiVerified: false,
    rsiVerifiedAt: undefined,
    rsiVerificationCode: undefined,
    rsiVerificationCodeExpiresAt: undefined,
  } as unknown as User;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset crawler mocks to the default "fail" state so each test is isolated
    mockCrawler.crawlCitizen.mockRejectedValue(new Error('Crawler unavailable'));
    mockCrawler.crawlUserMemberships.mockRejectedValue(new Error('Crawler unavailable'));
    mockCrawler.crawlOrganization.mockRejectedValue(new Error('Crawler unavailable'));

    // Create mock repositories
    mockUserRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    mockOrganizationRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<Organization>>;

    // Create mock RSI API service
    mockRsiApiService = new RsiApiService() as jest.Mocked<RsiApiService>;
    mockRsiApiService.verifyHandle = jest.fn();
    mockRsiApiService.verifyBioCode = jest.fn();
    mockRsiApiService.verifyOrgDescriptionCode = jest.fn();
    mockRsiApiService.verifyOrganizationMembership = jest.fn();
    mockRsiApiService.fetchUserData = jest.fn();
    mockRsiApiService.fetchOrganizationData = jest.fn();

    // Create service with mocks
    service = new RsiVerificationService(
      mockUserRepository,
      mockOrganizationRepository,
      mockRsiApiService
    );
  });

  describe('initiateVerification', () => {
    it('should initiate verification with valid RSI handle', async () => {
      mockRsiApiService.verifyHandle.mockResolvedValue({
        verified: true,
        handle: 'TestHandle',
        displayName: 'Test User',
      });
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.initiateVerification('user-123', 'TestHandle');

      expect(result.success).toBe(true);
      expect(result.verificationCode).toMatch(/^SCFM-[A-F0-9]{24}$/);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.rsiHandle).toBe('TestHandle');
    });

    it('should fail if RSI handle is empty', async () => {
      const result = await service.initiateVerification('user-123', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RSI handle is required');
    });

    it('should fail if RSI handle does not exist', async () => {
      mockRsiApiService.verifyHandle.mockResolvedValue({
        verified: false,
        error: 'RSI handle not found',
      });

      const result = await service.initiateVerification('user-123', 'NonExistentHandle');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RSI handle not found');
    });

    it('should fail if handle is already verified by another user', async () => {
      mockRsiApiService.verifyHandle.mockResolvedValue({
        verified: true,
        handle: 'TestHandle',
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'other-user-456',
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      } as User);

      const result = await service.initiateVerification('user-123', 'TestHandle');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This RSI handle is already verified by another account');
    });

    it('should allow re-verification by same user', async () => {
      mockRsiApiService.verifyHandle.mockResolvedValue({
        verified: true,
        handle: 'TestHandle',
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      } as User);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.initiateVerification('user-123', 'TestHandle');

      expect(result.success).toBe(true);
    });

    it('should set isExternalError when RSI API throws (service unavailable)', async () => {
      mockRsiApiService.verifyHandle.mockRejectedValue(
        new Error('Error fetching user data: ECONNREFUSED')
      );

      const result = await service.initiateVerification('user-123', 'TestHandle');

      expect(result.success).toBe(false);
      expect(result.isExternalError).toBe(true);
    });

    it('should set isExternalError when RSI API circuit breaker is open', async () => {
      mockRsiApiService.verifyHandle.mockRejectedValue(
        new Error('RSI API circuit breaker is OPEN. Try again in 25 seconds')
      );

      const result = await service.initiateVerification('user-123', 'TestHandle');

      expect(result.success).toBe(false);
      expect(result.isExternalError).toBe(true);
    });
  });

  describe('completeVerification', () => {
    it('should complete verification when code is found in bio', async () => {
      const verificationCode = 'SCFM-AABBCCDDEE112233AABB4455';
      const verificationCodeHash = hashVerificationCode(verificationCode);
      const userWithPendingVerification = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerificationCode: verificationCodeHash,
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      };
      mockUserRepository.findOne.mockResolvedValue(userWithPendingVerification as User);
      mockRsiApiService.fetchUserData.mockResolvedValue({
        handle: 'TestHandle',
        displayName: 'Test User',
        bio: `My RSI bio with verification code ${verificationCode} here`,
      });
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.rsiHandle).toBe('TestHandle');
      expect(result.displayName).toBe('Test User');
    });

    it('should fail if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should fail if no pending verification', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No pending RSI verification found');
    });

    it('should fail if verification code has expired', async () => {
      const expiredUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerificationCode: 'SCFM-TESTCODE123',
        rsiVerificationCodeExpiresAt: new Date(Date.now() - 86400000), // 24 hours ago
      };
      mockUserRepository.findOne.mockResolvedValue(expiredUser as User);

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Verification code has expired');
    });

    it('should fail if code not found in bio', async () => {
      const userWithPendingVerification = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerificationCode: hashVerificationCode('SCFM-AABBCCDDEE112233AABB4455'),
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000),
      };
      mockUserRepository.findOne.mockResolvedValue(userWithPendingVerification as User);
      mockRsiApiService.fetchUserData.mockResolvedValue({
        handle: 'TestHandle',
        bio: 'This bio has no verification codes at all',
      });

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Verification link not found in your RSI bio');
    });

    it('should complete verification when the pasted link is in the bio', async () => {
      const verificationCode = 'SCFM-AABBCCDDEE112233AABB4455';
      const userWithPendingVerification = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerificationCode: hashVerificationCode(verificationCode),
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000),
      };
      mockUserRepository.findOne.mockResolvedValue(userWithPendingVerification as User);
      // The token is embedded in a pasted verification link, not a bare code
      mockCrawler.crawlCitizen.mockResolvedValue({
        handle: 'TestHandle',
        displayName: 'Test User',
        bio: `Check me out: https://fringecore.space/verify/rsi/${verificationCode}`,
      });
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });

    it('should capture the immutable citizen record on success', async () => {
      const verificationCode = 'SCFM-AABBCCDDEE112233AABB4455';
      const userWithPendingVerification = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerificationCode: hashVerificationCode(verificationCode),
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000),
      };
      // 1st findOne loads the user, 2nd is the dedup lookup (no conflict)
      mockUserRepository.findOne
        .mockResolvedValueOnce(userWithPendingVerification as User)
        .mockResolvedValueOnce(null);
      mockCrawler.crawlCitizen.mockResolvedValue({
        handle: 'TestHandle',
        displayName: 'Test User',
        bio: `Verify ${verificationCode}`,
        citizenRecord: '15258',
      });
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ rsiCitizenRecord: '15258' })
      );
    });

    it('should reject when the citizen record is already verified by another user', async () => {
      const verificationCode = 'SCFM-AABBCCDDEE112233AABB4455';
      const userWithPendingVerification = {
        ...mockUser,
        id: 'user-123',
        rsiHandle: 'TestHandle',
        rsiVerificationCode: hashVerificationCode(verificationCode),
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000),
      };
      mockUserRepository.findOne
        .mockResolvedValueOnce(userWithPendingVerification as User)
        .mockResolvedValueOnce({ id: 'other-user', rsiCitizenRecord: '15258' } as User);
      mockCrawler.crawlCitizen.mockResolvedValue({
        handle: 'TestHandle',
        displayName: 'Test User',
        bio: `Verify ${verificationCode}`,
        citizenRecord: '15258',
      });

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already verified by another user');
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should return a conflict when DB uniqueness is hit during final verification write', async () => {
      const verificationCode = 'SCFM-AABBCCDDEE112233AABB4455';
      const userWithPendingVerification = {
        ...mockUser,
        id: 'user-123',
        rsiHandle: 'TestHandle',
        rsiVerificationCode: hashVerificationCode(verificationCode),
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000),
      };

      mockUserRepository.findOne
        .mockResolvedValueOnce(userWithPendingVerification as User)
        .mockResolvedValueOnce(null);
      mockCrawler.crawlCitizen.mockResolvedValue({
        handle: 'TestHandle',
        displayName: 'Test User',
        bio: `Verify ${verificationCode}`,
        citizenRecord: '15258',
      });

      const uniqueConflict = new QueryFailedError('UPDATE users', [], {
        code: '23505',
        constraint: 'UQ_users_rsi_citizen_record_verified',
      });
      mockUserRepository.update.mockRejectedValue(uniqueConflict);

      const result = await service.completeVerification('user-123');

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error).toContain('already verified by another user');
    });
  });

  describe('autoDetectUserVerifications', () => {
    it('should verify pending users whose profile contains the link', async () => {
      const verificationCode = 'SCFM-AABBCCDDEE112233AABB4455';
      const pendingUser = {
        ...mockUser,
        id: 'user-123',
        rsiHandle: 'TestHandle',
        rsiVerificationCode: hashVerificationCode(verificationCode),
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000),
      };
      // QueryBuilder returns one pending user; completeVerification re-fetches it
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([pendingUser]),
      };
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as any);
      mockUserRepository.findOne.mockResolvedValue(pendingUser as User);
      mockCrawler.crawlCitizen.mockResolvedValue({
        handle: 'TestHandle',
        displayName: 'Test User',
        bio: `Verify me ${verificationCode}`,
      });
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.autoDetectUserVerifications();

      expect(result.checked).toBe(1);
      expect(result.verified).toBe(1);
    });
  });

  describe('autoDetectOrganizationVerifications', () => {
    it('should verify pending orgs through completeOrganizationVerification', async () => {
      const pendingOrg = {
        id: 'org-123',
        ownerId: 'user-123',
        rsiVerified: false,
        rsiVerificationCode: hashVerificationCode('SCFM-AABBCCDDEE112233AABB4455'),
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000),
      } as Organization;

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([pendingOrg]),
      };
      mockOrganizationRepository.createQueryBuilder.mockReturnValue(qb as any);

      const completeSpy = jest
        .spyOn(service, 'completeOrganizationVerification')
        .mockResolvedValue({ success: true, verified: true, rsiHandle: 'TESTORG' });

      const result = await service.autoDetectOrganizationVerifications();

      expect(result.checked).toBe(1);
      expect(result.verified).toBe(1);
      expect(completeSpy).toHaveBeenCalledWith('user-123', 'org-123');
    });
  });

  describe('getVerificationStatus', () => {
    it('should return verified status for verified user', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
        rsiVerifiedAt: new Date(),
      };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);

      const status = await service.getVerificationStatus('user-123');

      expect(status.verified).toBe(true);
      expect(status.rsiHandle).toBe('TestHandle');
      expect(status.pendingVerification).toBe(false);
    });

    it('should return pending status for user with active verification code', async () => {
      const pendingUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: false,
        rsiVerificationCode: 'SCFM-TESTCODE123',
        rsiVerificationCodeExpiresAt: new Date(Date.now() + 86400000),
      };
      mockUserRepository.findOne.mockResolvedValue(pendingUser as User);

      const status = await service.getVerificationStatus('user-123');

      expect(status.verified).toBe(false);
      expect(status.pendingVerification).toBe(true);
    });

    it('should return unverified status for user without RSI link', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const status = await service.getVerificationStatus('user-123');

      expect(status.verified).toBe(false);
      expect(status.pendingVerification).toBe(false);
    });

    it('should return default status for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const status = await service.getVerificationStatus('user-123');

      expect(status.verified).toBe(false);
      expect(status.pendingVerification).toBe(false);
    });
  });

  describe('removeVerification', () => {
    it('should remove verification successfully', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.removeVerification('user-123');

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        rsiHandle: null,
        rsiCitizenRecord: null,
        rsiVerified: false,
        rsiVerifiedAt: null,
        rsiVerificationCode: null,
        rsiVerificationCodeExpiresAt: null,
      });
    });
  });

  describe('verifyOrganizationOwnership', () => {
    it('should verify organization owner', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);
      mockRsiApiService.verifyOrganizationMembership.mockResolvedValue({
        verified: true,
        isOwner: true,
        isAdmin: true,
        sid: 'TESTORG',
        name: 'Test Organization',
        rank: 'Founder',
      });

      const result = await service.verifyOrganizationOwnership('user-123', 'TESTORG');

      expect(result.success).toBe(true);
      expect(result.isOwner).toBe(true);
      expect(result.isAdmin).toBe(true);
      expect(result.orgSid).toBe('TESTORG');
      expect(result.userRank).toBe('Founder');
    });

    it('should fail if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.verifyOrganizationOwnership('user-123', 'TESTORG');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should fail if RSI handle not verified', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.verifyOrganizationOwnership('user-123', 'TESTORG');

      expect(result.success).toBe(false);
      expect(result.error).toContain('RSI handle not set');
    });

    it('should return non-owner status for regular members', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);
      mockRsiApiService.verifyOrganizationMembership.mockResolvedValue({
        verified: true,
        isOwner: false,
        isAdmin: false,
        sid: 'TESTORG',
        name: 'Test Organization',
        rank: 'Member',
      });

      const result = await service.verifyOrganizationOwnership('user-123', 'TESTORG');

      expect(result.success).toBe(true);
      expect(result.isOwner).toBe(false);
      expect(result.isAdmin).toBe(false);
    });

    it('should grant admin via star-level check when crawler rank is insufficient', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);

      // Crawler finds membership with a custom rank that isn't in the hardcoded list
      mockCrawler.crawlUserMemberships.mockResolvedValue([
        {
          sid: 'TESTORG',
          name: 'Test Organization',
          rank: 'Senior Officer',
          stars: 4,
          isMain: true,
        },
      ]);
      // API says they qualify as admin via 4+ stars
      mockRsiApiService.verifyOrganizationMembership.mockResolvedValue({
        verified: true,
        isOwner: false,
        isAdmin: true,
        sid: 'TESTORG',
        name: 'Test Organization',
        rank: 'Senior Officer',
      });

      const result = await service.verifyOrganizationOwnership('user-123', 'TESTORG');

      expect(result.success).toBe(true);
      expect(result.isOwner).toBe(false);
      expect(result.isAdmin).toBe(true);
      // API must NOT be called — crawler now provides stars directly
      expect(mockRsiApiService.verifyOrganizationMembership).not.toHaveBeenCalled();
    });

    it('should not call API for supplemental check when crawler rank grants admin', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);

      // Crawler finds membership with 'founder' rank — already grants owner+admin
      mockCrawler.crawlUserMemberships.mockResolvedValue([
        { sid: 'TESTORG', name: 'Test Organization', rank: 'Founder', stars: 0, isMain: true },
      ]);

      const result = await service.verifyOrganizationOwnership('user-123', 'TESTORG');

      expect(result.success).toBe(true);
      expect(result.isOwner).toBe(true);
      expect(result.isAdmin).toBe(true);
      // API must NOT be called when crawler rank already grants admin
      expect(mockRsiApiService.verifyOrganizationMembership).not.toHaveBeenCalled();
    });
  });

  describe('lookupRsiUser', () => {
    it('should return RSI user data', async () => {
      mockRsiApiService.verifyHandle.mockResolvedValue({
        verified: true,
        handle: 'TestHandle',
        displayName: 'Test User',
        bio: 'Test bio',
        organizations: [],
      });

      const result = await service.lookupRsiUser('TestHandle');

      expect(result.verified).toBe(true);
      expect(result.handle).toBe('TestHandle');
    });

    it('should return not found for invalid handle', async () => {
      mockRsiApiService.verifyHandle.mockResolvedValue({
        verified: false,
        error: 'RSI handle not found',
      });

      const result = await service.lookupRsiUser('InvalidHandle');

      expect(result.verified).toBe(false);
    });

    it('should use crawler when it works and not call Sentry API', async () => {
      mockCrawler.crawlCitizen.mockResolvedValue({
        handle: 'TestHandle',
        displayName: 'Test User',
        bio: 'Test bio',
      });

      const result = await service.lookupRsiUser('TestHandle');

      expect(result.verified).toBe(true);
      expect(result.handle).toBe('TestHandle');
      expect(result.displayName).toBe('Test User');
      // Sentry API must NOT be called when the crawler succeeds
      expect(mockRsiApiService.verifyHandle).not.toHaveBeenCalled();
    });
  });

  describe('lookupRsiOrganization', () => {
    it('should return RSI organization data', async () => {
      mockRsiApiService.fetchOrganizationData.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization',
      });

      const result = await service.lookupRsiOrganization('TESTORG');

      expect(result.found).toBe(true);
      expect(result.data?.sid).toBe('TESTORG');
    });

    it('should return not found for invalid organization', async () => {
      mockRsiApiService.fetchOrganizationData.mockResolvedValue({});

      const result = await service.lookupRsiOrganization('INVALID');

      expect(result.found).toBe(false);
    });
  });

  describe('initiateOrganizationVerification', () => {
    const mockOrg = {
      id: 'org-123',
      name: 'Test Org',
      ownerId: 'user-123',
      rsiSid: undefined,
      rsiVerified: false,
    } as Organization;

    it('should initiate organization verification successfully', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      };
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);
      mockRsiApiService.fetchOrganizationData.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization',
      });
      mockRsiApiService.verifyOrganizationMembership.mockResolvedValue({
        verified: true,
        isOwner: true,
        isAdmin: true,
      });
      mockOrganizationRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.initiateOrganizationVerification(
        'user-123',
        'org-123',
        'TESTORG'
      );

      expect(result.success).toBe(true);
      expect(result.verificationCode).toMatch(/^SCFM-[A-F0-9]{24}$/);
      expect(result.rsiHandle).toBe('TESTORG');
    });

    it('should fail if organization not found', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(null);

      const result = await service.initiateOrganizationVerification(
        'user-123',
        'org-123',
        'TESTORG'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Organization not found');
    });

    it('should fail if user is not owner or admin', async () => {
      const otherUserOrg = { ...mockOrg, ownerId: 'other-user' };
      mockOrganizationRepository.findOne.mockResolvedValue(otherUserOrg as Organization);
      mockMembershipRepo.findOne.mockResolvedValue({
        userId: 'user-123',
        organizationId: 'org-123',
        isActive: true,
        role: { name: 'member' },
      });

      const result = await service.initiateOrganizationVerification(
        'user-123',
        'org-123',
        'TESTORG'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only organization owners and admins can verify RSI organizations');
    });

    it('should fail if user RSI handle not verified', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockRsiApiService.fetchOrganizationData.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization',
      });

      const result = await service.initiateOrganizationVerification(
        'user-123',
        'org-123',
        'TESTORG'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('You must set an RSI handle before verifying an organization');
    });

    it('should use crawler for org check and membership check when crawler works', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      };
      mockOrganizationRepository.findOne
        .mockResolvedValueOnce(mockOrg) // org lookup
        .mockResolvedValueOnce(null); // existing verified org check
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);
      mockOrganizationRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Crawler succeeds for both org existence and membership
      mockCrawler.crawlOrganization.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization',
        memberCount: 10,
        affiliateCount: 0,
      } as any);
      mockCrawler.crawlUserMemberships.mockResolvedValue([
        { sid: 'TESTORG', name: 'Test Organization', rank: 'owner', stars: 0, isMain: true },
      ]);

      const result = await service.initiateOrganizationVerification(
        'user-123',
        'org-123',
        'TESTORG'
      );

      expect(result.success).toBe(true);
      expect(result.verificationCode).toMatch(/^SCFM-[A-F0-9]{24}$/);
      // Sentry API must NOT be called when the crawler succeeds and rank grants admin
      expect(mockRsiApiService.fetchOrganizationData).not.toHaveBeenCalled();
      expect(mockRsiApiService.verifyOrganizationMembership).not.toHaveBeenCalled();
    });

    it('should grant admin via crawler star level when rank does not match hardcoded list', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      };
      mockOrganizationRepository.findOne
        .mockResolvedValueOnce(mockOrg) // org lookup
        .mockResolvedValueOnce(null); // existing verified org check
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);
      mockOrganizationRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Crawler finds membership with a custom rank but 4 stars — admin via star level
      mockCrawler.crawlOrganization.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization',
        memberCount: 10,
        affiliateCount: 0,
      } as any);
      mockCrawler.crawlUserMemberships.mockResolvedValue([
        {
          sid: 'TESTORG',
          name: 'Test Organization',
          rank: 'Senior Officer',
          stars: 4,
          isMain: true,
        },
      ]);

      const result = await service.initiateOrganizationVerification(
        'user-123',
        'org-123',
        'TESTORG'
      );

      expect(result.success).toBe(true);
      expect(result.verificationCode).toMatch(/^SCFM-[A-F0-9]{24}$/);
      // API must NOT be called — crawler provides stars directly
      expect(mockRsiApiService.verifyOrganizationMembership).not.toHaveBeenCalled();
    });

    it('should reject when crawler finds member with low star level and non-admin rank', async () => {
      const verifiedUser = {
        ...mockUser,
        rsiHandle: 'TestHandle',
        rsiVerified: true,
      };
      mockOrganizationRepository.findOne
        .mockResolvedValueOnce(mockOrg) // org lookup
        .mockResolvedValueOnce(null); // existing verified org check
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as User);

      // Crawler finds membership with a regular member rank and low stars
      mockCrawler.crawlOrganization.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization',
        memberCount: 10,
        affiliateCount: 0,
      } as any);
      mockCrawler.crawlUserMemberships.mockResolvedValue([
        { sid: 'TESTORG', name: 'Test Organization', rank: 'Member', stars: 1, isMain: true },
      ]);

      const result = await service.initiateOrganizationVerification(
        'user-123',
        'org-123',
        'TESTORG'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('admin or owner of the RSI organization');
      // API must NOT be called — crawler handled the full check
      expect(mockRsiApiService.verifyOrganizationMembership).not.toHaveBeenCalled();
    });
  });

  describe('completeOrganizationVerification', () => {
    const mockOrg = {
      id: 'org-123',
      name: 'Test Org',
      ownerId: 'user-123',
      rsiSid: 'TESTORG',
      rsiVerified: false,
      rsiVerificationCode: 'SCFM-TEST123',
      rsiVerificationCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as Organization;

    it('should complete organization verification successfully', async () => {
      const verificationCode = 'SCFM-AABBCCDDEE112233AABB4455';
      const mockOrgWithHash = {
        ...mockOrg,
        rsiVerificationCode: hashVerificationCode(verificationCode),
      };
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrgWithHash as Organization);
      mockRsiApiService.fetchOrganizationData.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization',
        description: `Organization description with code ${verificationCode} here`,
      });
      mockOrganizationRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.completeOrganizationVerification('user-123', 'org-123');

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.rsiHandle).toBe('TESTORG');
    });

    it('should fail if organization not found', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(null);

      const result = await service.completeOrganizationVerification('user-123', 'org-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Organization not found');
    });

    it('should fail if verification code not found in description', async () => {
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrg);
      mockRsiApiService.fetchOrganizationData.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization',
        description: 'Organization description with no verification codes here',
      });

      const result = await service.completeOrganizationVerification('user-123', 'org-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Verification code not found');
    });

    it('should fail if verification code expired', async () => {
      const expiredOrg = {
        ...mockOrg,
        rsiVerificationCodeExpiresAt: new Date(Date.now() - 1000),
      };
      mockOrganizationRepository.findOne.mockResolvedValue(expiredOrg as Organization);

      const result = await service.completeOrganizationVerification('user-123', 'org-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should use crawler for org description check when crawler works', async () => {
      const verificationCode = 'SCFM-AABBCCDDEE112233AABB4455';
      const mockOrgWithHash = {
        ...mockOrg,
        rsiVerificationCode: hashVerificationCode(verificationCode),
      };
      mockOrganizationRepository.findOne.mockResolvedValue(mockOrgWithHash as Organization);
      mockOrganizationRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Crawler succeeds — returns description with the code
      mockCrawler.crawlOrganization.mockResolvedValue({
        sid: 'TESTORG',
        name: 'Test Organization via Crawler',
        description: `Organization description with code ${verificationCode} here`,
        memberCount: 10,
        affiliateCount: 0,
      } as any);

      const result = await service.completeOrganizationVerification('user-123', 'org-123');

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.displayName).toBe('Test Organization via Crawler');
      // Sentry API must NOT be called when the crawler succeeds
      expect(mockRsiApiService.fetchOrganizationData).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
