import { AppDataSource } from '../../../data-source';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { User } from '../../../models/User';
import { ForbiddenError } from '../../../utils/apiErrors';
import { logAuditEvent } from '../../../utils/auditLogger';
import { UserPreferencesService } from '../UserPreferencesService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');

describe('UserPreferencesService - Organization Membership Verification', () => {
  let service: UserPreferencesService;
  let mockUserRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockUserOrgRepository: jest.Mocked<Record<string, jest.Mock>>;

  // Test data
  const testUserId = 'user-123';
  const testOrgId = 'org-456';
  const testUsername = 'testuser';

  const mockUser: User = {
    id: testUserId,
    username: testUsername,
    email: 'test@example.com',
    activeOrgId: undefined,
  } as User;

  const mockMembership: OrganizationMembership = {
    id: 'membership-123',
    userId: testUserId,
    organizationId: testOrgId,
    role: 'member',
  } as OrganizationMembership;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup repository mocks
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as jest.Mocked<Record<string, jest.Mock>>;

    mockUserOrgRepository = {
      findOne: jest.fn(),
    } as jest.Mocked<Record<string, jest.Mock>>;

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock) = jest.fn(entity => {
      if (entity === User) {
        return mockUserRepository;
      }
      if (entity === OrganizationMembership) {
        return mockUserOrgRepository;
      }
      return {};
    });

    service = new UserPreferencesService();
  });

  describe('setActiveOrganization', () => {
    it('should set active organization when user is a member', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserOrgRepository.findOne.mockResolvedValue(mockMembership);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        activeOrgId: testOrgId,
      });

      // Act
      const result = await service.setActiveOrganization(testUserId, testOrgId);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: testUserId },
      });
      expect(mockUserOrgRepository.findOne).toHaveBeenCalledWith({
        where: { userId: testUserId, organizationId: testOrgId, isActive: true },
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.activeOrgId).toBe(testOrgId);
      expect(logAuditEvent).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user is not a member', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserOrgRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.setActiveOrganization(testUserId, testOrgId)).rejects.toThrow(
        ForbiddenError
      );

      expect(mockUserOrgRepository.findOne).toHaveBeenCalledWith({
        where: { userId: testUserId, organizationId: testOrgId, isActive: true },
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should audit log unauthorized access attempt', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserOrgRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.setActiveOrganization(testUserId, testOrgId)).rejects.toThrow(
        ForbiddenError
      );

      // Verify audit logging
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AUTHZ_FAILURE',
          userId: testUserId,
          username: testUsername,
          resource: `organization/${testOrgId}`,
          action: 'SET_ACTIVE_ORGANIZATION',
          metadata: expect.objectContaining({
            userId: testUserId,
            organizationId: testOrgId,
            attemptedAction: 'setActiveOrganization',
          }),
        })
      );
    });

    it('should throw ForbiddenError with correct message and details', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserOrgRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      let thrownError: Error | undefined;
      try {
        await service.setActiveOrganization(testUserId, testOrgId);
      } catch (error: unknown) {
        thrownError = error as Error;
      }

      expect(thrownError).toBeInstanceOf(ForbiddenError);
      if (thrownError instanceof ForbiddenError) {
        expect(thrownError.message).toBe('You are not a member of this organization');
        expect(thrownError.statusCode).toBe(403);
        expect(thrownError.details).toEqual({});
      }
    });

    it('should throw Error when user is not found', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.setActiveOrganization(testUserId, testOrgId)).rejects.toThrow(
        'User not found'
      );

      expect(mockUserOrgRepository.findOne).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should update activeOrgChangedAt timestamp', async () => {
      // Arrange
      const userWithTimestamp = { ...mockUser };
      mockUserRepository.findOne.mockResolvedValue(userWithTimestamp);
      mockUserOrgRepository.findOne.mockResolvedValue(mockMembership);

      let savedUser: any;
      mockUserRepository.save.mockImplementation(user => {
        savedUser = user;
        return Promise.resolve(user);
      });

      // Act
      await service.setActiveOrganization(testUserId, testOrgId);

      // Assert
      expect(savedUser).toBeDefined();
      expect(savedUser.activeOrgChangedAt).toBeInstanceOf(Date);
      expect(savedUser.activeOrgId).toBe(testOrgId);
    });

    it('should verify membership for different organization IDs', async () => {
      // Arrange
      const differentOrgId = 'org-789';
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserOrgRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.setActiveOrganization(testUserId, differentOrgId)).rejects.toThrow(
        ForbiddenError
      );

      expect(mockUserOrgRepository.findOne).toHaveBeenCalledWith({
        where: { userId: testUserId, organizationId: differentOrgId, isActive: true },
      });
    });

    it('should allow switching between organizations user is member of', async () => {
      // Arrange
      const firstOrgId = 'org-111';
      const secondOrgId = 'org-222';
      const freshUser = { ...mockUser, activeOrgId: undefined };

      mockUserRepository.findOne.mockResolvedValue(freshUser);
      mockUserOrgRepository.findOne.mockResolvedValueOnce({
        ...mockMembership,
        organizationId: firstOrgId,
      });
      mockUserRepository.save.mockResolvedValueOnce({
        ...freshUser,
        activeOrgId: firstOrgId,
      });

      // Act - Set first organization
      const result1 = await service.setActiveOrganization(testUserId, firstOrgId);

      // Assert first call
      expect(result1.activeOrgId).toBe(firstOrgId);

      // Arrange - Setup for second organization
      // User now has activeOrgId set to firstOrgId
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        activeOrgId: firstOrgId,
      });
      // First findOne: current org membership check (role != owner/founder → allowed)
      mockUserOrgRepository.findOne.mockResolvedValueOnce({
        ...mockMembership,
        organizationId: firstOrgId,
        role: 'member',
      });
      // Second findOne: target org membership verification
      mockUserOrgRepository.findOne.mockResolvedValueOnce({
        ...mockMembership,
        organizationId: secondOrgId,
      });
      mockUserRepository.save.mockResolvedValueOnce({
        ...mockUser,
        activeOrgId: secondOrgId,
      });

      // Act - Switch to second organization
      const result2 = await service.setActiveOrganization(testUserId, secondOrgId);

      // Assert second call
      expect(result2.activeOrgId).toBe(secondOrgId);
    });

    it('should prevent founders from switching primary organization', async () => {
      // Arrange
      const currentOrgId = 'org-current';
      const newOrgId = 'org-new';

      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        activeOrgId: currentOrgId,
      });
      // Current org membership → founder role
      mockUserOrgRepository.findOne.mockResolvedValueOnce({
        ...mockMembership,
        organizationId: currentOrgId,
        role: 'founder',
      });

      // Act & Assert
      await expect(service.setActiveOrganization(testUserId, newOrgId)).rejects.toThrow(
        'Organization founders and owners cannot switch their primary organization'
      );
    });

    it('should prevent owners from switching primary organization', async () => {
      // Arrange
      const currentOrgId = 'org-current';
      const newOrgId = 'org-new';

      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        activeOrgId: currentOrgId,
      });
      // Current org membership → owner role
      mockUserOrgRepository.findOne.mockResolvedValueOnce({
        ...mockMembership,
        organizationId: currentOrgId,
        role: 'owner',
      });

      // Act & Assert
      await expect(service.setActiveOrganization(testUserId, newOrgId)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('getActiveOrganizationContext', () => {
    it('should return organization context when user is a member', async () => {
      // Arrange
      const testJoinedAt = new Date('2024-01-01');
      const userWithActiveOrg = {
        ...mockUser,
        activeOrgId: testOrgId,
      };
      const membershipWithDetails = {
        ...mockMembership,
        role: 'admin',
        joinedAt: testJoinedAt,
        permissions: ['read', 'write'],
      };

      mockUserRepository.findOne.mockResolvedValue(userWithActiveOrg);
      mockUserOrgRepository.findOne.mockResolvedValue(membershipWithDetails);

      // Act
      const result = await service.getActiveOrganizationContext(testUserId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.activeOrgId).toBe(testOrgId);
      expect(result?.roleInOrg).toBe('admin');
      expect(result?.joinedAt).toBe(testJoinedAt);
      expect(result?.permissions).toEqual(['read', 'write']);
      expect(result?.isAdmin).toBe(true);
      expect(result?.isOwner).toBe(false);
      expect(mockUserOrgRepository.findOne).toHaveBeenCalledWith({
        where: { userId: testUserId, organizationId: testOrgId, isActive: true },
      });
      expect(logAuditEvent).not.toHaveBeenCalled();
    });

    it('should return null when user has no active organization', async () => {
      // Arrange
      const userWithoutActiveOrg = {
        ...mockUser,
        activeOrgId: undefined,
      };
      mockUserRepository.findOne.mockResolvedValue(userWithoutActiveOrg);

      // Act
      const result = await service.getActiveOrganizationContext(testUserId);

      // Assert
      expect(result).toBeNull();
      expect(mockUserOrgRepository.findOne).not.toHaveBeenCalled();
      expect(logAuditEvent).not.toHaveBeenCalled();
    });

    it('should return null when user is not a member of active organization', async () => {
      // Arrange
      const userWithActiveOrg = {
        ...mockUser,
        activeOrgId: testOrgId,
      };
      mockUserRepository.findOne.mockResolvedValue(userWithActiveOrg);
      mockUserOrgRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getActiveOrganizationContext(testUserId);

      // Assert
      expect(result).toBeNull();
      expect(mockUserOrgRepository.findOne).toHaveBeenCalledWith({
        where: { userId: testUserId, organizationId: testOrgId, isActive: true },
      });
    });

    it('should audit log when user is not a member of active organization', async () => {
      // Arrange
      const userWithActiveOrg = {
        ...mockUser,
        activeOrgId: testOrgId,
      };
      mockUserRepository.findOne.mockResolvedValue(userWithActiveOrg);
      mockUserOrgRepository.findOne.mockResolvedValue(null);

      // Act
      await service.getActiveOrganizationContext(testUserId);

      // Assert
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AUTHZ_FAILURE',
          userId: testUserId,
          username: testUsername,
          resource: `organization/${testOrgId}`,
          action: 'GET_ACTIVE_ORGANIZATION_CONTEXT',
          metadata: expect.objectContaining({
            userId: testUserId,
            organizationId: testOrgId,
            attemptedAction: 'getActiveOrganizationContext',
          }),
        })
      );
    });

    it('should correctly identify owner role', async () => {
      // Arrange
      const userWithActiveOrg = {
        ...mockUser,
        activeOrgId: testOrgId,
      };
      const ownerMembership = {
        ...mockMembership,
        role: 'owner',
        joinedAt: new Date(),
        permissions: ['all'],
      };

      mockUserRepository.findOne.mockResolvedValue(userWithActiveOrg);
      mockUserOrgRepository.findOne.mockResolvedValue(ownerMembership);

      // Act
      const result = await service.getActiveOrganizationContext(testUserId);

      // Assert
      expect(result?.roleInOrg).toBe('owner');
      expect(result?.isOwner).toBe(true);
      expect(result?.isAdmin).toBe(true); // owners are also admins
    });

    it('should correctly identify regular member role', async () => {
      // Arrange
      const userWithActiveOrg = {
        ...mockUser,
        activeOrgId: testOrgId,
      };
      const memberMembership = {
        ...mockMembership,
        role: 'member',
        joinedAt: new Date(),
        permissions: [],
      };

      mockUserRepository.findOne.mockResolvedValue(userWithActiveOrg);
      mockUserOrgRepository.findOne.mockResolvedValue(memberMembership);

      // Act
      const result = await service.getActiveOrganizationContext(testUserId);

      // Assert
      expect(result?.roleInOrg).toBe('member');
      expect(result?.isOwner).toBe(false);
      expect(result?.isAdmin).toBe(false);
    });

    it('should handle membership without custom permissions', async () => {
      // Arrange
      const userWithActiveOrg = {
        ...mockUser,
        activeOrgId: testOrgId,
      };
      const membershipWithoutPermissions = {
        ...mockMembership,
        permissions: undefined,
      };

      mockUserRepository.findOne.mockResolvedValue(userWithActiveOrg);
      mockUserOrgRepository.findOne.mockResolvedValue(membershipWithoutPermissions);

      // Act
      const result = await service.getActiveOrganizationContext(testUserId);

      // Assert
      expect(result?.permissions).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

