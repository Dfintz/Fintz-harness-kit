import { PermissionAction, ResourceType } from '../../models/OrganizationPermission';
import {
  InviteMemberParams,
  OrganizationAggregatorService,
  OrganizationSetupParams,
} from '../aggregators/OrganizationAggregatorService';
import { NotificationService } from '../communication';
import { OrganizationMemberService } from '../organization/OrganizationMemberService';
import { OrganizationPermissionService } from '../organization/OrganizationPermissionService';
import { OrganizationService } from '../organization/OrganizationService';
import { OrganizationSettingsService } from '../organization/OrganizationSettingsService';
import { UserService } from '../user/UserService';

// Mock all dependencies
jest.mock('../organization/OrganizationService');
jest.mock('../organization/OrganizationMemberService');
jest.mock('../organization/OrganizationPermissionService');
jest.mock('../organization/OrganizationSettingsService');
jest.mock('../user/UserService');
jest.mock('../communication');
jest.mock('../../data-source', () => ({
  AppDataSource: {
    transaction: jest.fn(callback => callback({})),
    getRepository: jest.fn(() => ({
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    })),
  },
}));

describe('OrganizationAggregatorService', () => {
  let service: OrganizationAggregatorService;
  let mockOrgService: jest.Mocked<OrganizationService>;
  let mockMemberService: jest.Mocked<OrganizationMemberService>;
  let mockPermissionService: jest.Mocked<OrganizationPermissionService>;
  let mockSettingsService: jest.Mocked<OrganizationSettingsService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new OrganizationAggregatorService();

    // Access internal services
    mockOrgService = (service as any).organizationService;
    mockMemberService = (service as any).memberService;
    mockPermissionService = (service as any).permissionService;
    mockSettingsService = (service as any).settingsService;
    mockUserService = (service as any).userService;
    mockNotificationService = (service as any).notificationService;
  });

  describe('inviteAndOnboardMember', () => {
    const mockMember = {
      id: 'member-123',
      organizationId: 'org-456',
      userId: 'user-789',
      role: 'member',
      isActive: true,
      joinedAt: new Date(),
      createdAt: new Date(),
    };

    it('should invite member with role and permissions', async () => {
      // Arrange
      const params: InviteMemberParams = {
        organizationId: 'org-456',
        userId: 'user-789',
        invitedBy: 'user-admin',
        role: 'pilot',
        title: 'Senior Pilot',
        permissions: [
          {
            resource: 'ACTIVITY' as any,
            actions: [PermissionAction.CREATE, 'READ' as any],
          },
          {
            resource: ResourceType.EVENT,
            actions: ['READ' as any],
          },
        ],
        message: 'Welcome to our organization!',
        sendNotification: true,
      };

      const mockPermissions = [
        {
          id: 'perm-1',
          resource: 'ACTIVITY' as any,
          actions: [PermissionAction.CREATE, 'READ' as any],
        },
        { id: 'perm-2', resource: ResourceType.EVENT, actions: ['READ' as any] },
      ];

      mockMemberService.addMember = jest.fn().mockResolvedValue(mockMember);
      mockPermissionService.grantPermission = jest
        .fn()
        .mockResolvedValueOnce(mockPermissions[0])
        .mockResolvedValueOnce(mockPermissions[1]);

      // Act
      const result = await service.inviteAndOnboardMember(params);

      // Assert
      expect(result).toBeDefined();
      expect(result.member).toEqual(mockMember);
      expect(result.permissions).toHaveLength(2);
      expect(mockMemberService.addMember).toHaveBeenCalledWith(
        'org-456',
        'user-789',
        'pilot',
        'Senior Pilot',
        expect.objectContaining({
          invitedBy: 'user-admin',
          inviteMessage: 'Welcome to our organization!',
        }),
        undefined,
        { acquisitionSource: 'manual' }
      );
      expect(mockPermissionService.grantPermission).toHaveBeenCalledTimes(2);
    });

    it('should invite member without permissions', async () => {
      // Arrange
      const params: InviteMemberParams = {
        organizationId: 'org-456',
        userId: 'user-789',
        invitedBy: 'user-admin',
        role: 'member',
        sendNotification: false,
      };

      mockMemberService.addMember = jest.fn().mockResolvedValue(mockMember);

      // Act
      const result = await service.inviteAndOnboardMember(params);

      // Assert
      expect(result.member).toEqual(mockMember);
      expect(result.permissions).toHaveLength(0);
      expect(mockPermissionService.grantPermission).not.toHaveBeenCalled();
    });

    it('should use default role when not specified', async () => {
      // Arrange
      const params: InviteMemberParams = {
        organizationId: 'org-456',
        userId: 'user-789',
        invitedBy: 'user-admin',
      };

      mockMemberService.addMember = jest.fn().mockResolvedValue(mockMember);

      // Act
      const result = await service.inviteAndOnboardMember(params);

      // Assert
      expect(mockMemberService.addMember).toHaveBeenCalledWith(
        'org-456',
        'user-789',
        'member', // Default role
        undefined,
        expect.any(Object),
        undefined,
        { acquisitionSource: 'manual' }
      );
    });

    it('should continue if permission grant fails', async () => {
      // Arrange
      const params: InviteMemberParams = {
        organizationId: 'org-456',
        userId: 'user-789',
        invitedBy: 'user-admin',
        permissions: [
          {
            resource: 'ACTIVITY' as any,
            actions: [PermissionAction.CREATE],
          },
          {
            resource: ResourceType.EVENT,
            actions: ['READ' as any],
          },
        ],
      };

      mockMemberService.addMember = jest.fn().mockResolvedValue(mockMember);
      mockPermissionService.grantPermission = jest
        .fn()
        .mockResolvedValueOnce({ id: 'perm-1' })
        .mockRejectedValueOnce(new Error('Permission grant failed'));

      // Act
      const result = await service.inviteAndOnboardMember(params);

      // Assert - should complete with partial permissions
      expect(result.member).toEqual(mockMember);
      expect(result.permissions).toHaveLength(1);
    });

    it('should rollback on member creation failure', async () => {
      // Arrange
      const params: InviteMemberParams = {
        organizationId: 'org-456',
        userId: 'user-789',
        invitedBy: 'user-admin',
      };

      mockMemberService.addMember = jest.fn().mockRejectedValue(new Error('User already member'));

      // Act & Assert
      await expect(service.inviteAndOnboardMember(params)).rejects.toThrow('User already member');
      expect(mockPermissionService.grantPermission).not.toHaveBeenCalled();
    });
  });

  describe('offboardMember', () => {
    it('should offboard member and revoke permissions', async () => {
      // Arrange
      mockPermissionService.revokeAllUserPermissions = jest.fn().mockResolvedValue(undefined);
      mockMemberService.removeMember = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await service.offboardMember(
        'org-456',
        'user-789',
        'user-admin',
        'Voluntary departure'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockPermissionService.revokeAllUserPermissions).toHaveBeenCalledWith(
        'user-789',
        'org-456'
      );
      expect(mockMemberService.removeMember).toHaveBeenCalledWith('org-456', 'user-789');
    });

    it('should offboard member without reason', async () => {
      // Arrange
      mockPermissionService.revokeAllUserPermissions = jest.fn().mockResolvedValue(undefined);
      mockMemberService.removeMember = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await service.offboardMember('org-456', 'user-789', 'user-admin');

      // Assert
      expect(result.success).toBe(true);
    });

    it('should throw error when member removal fails', async () => {
      // Arrange
      mockPermissionService.revokeAllUserPermissions = jest.fn().mockResolvedValue(undefined);
      mockMemberService.removeMember = jest.fn().mockRejectedValue(new Error('Member not found'));

      // Act & Assert
      await expect(service.offboardMember('org-456', 'nonexistent', 'user-admin')).rejects.toThrow(
        'Member not found'
      );
    });

    it('should handle permission revocation failure gracefully', async () => {
      // Arrange
      mockPermissionService.revokeAllUserPermissions = jest
        .fn()
        .mockRejectedValue(new Error('Permission service error'));
      mockMemberService.removeMember = jest.fn().mockResolvedValue(undefined);

      // Act & Assert - should fail the whole operation
      await expect(service.offboardMember('org-456', 'user-789', 'user-admin')).rejects.toThrow(
        'Permission service error'
      );
    });
  });

  describe('bulkInviteMembers', () => {
    it('should successfully invite multiple members', async () => {
      // Arrange
      const invitations = [
        { userId: 'user-1', invitedBy: 'user-admin', role: 'pilot' },
        { userId: 'user-2', invitedBy: 'user-admin', role: 'engineer' },
        { userId: 'user-3', invitedBy: 'user-admin', role: 'medic' },
      ];

      const mockMembers = [
        { id: 'member-1', userId: 'user-1', role: 'pilot' },
        { id: 'member-2', userId: 'user-2', role: 'engineer' },
        { id: 'member-3', userId: 'user-3', role: 'medic' },
      ];

      mockMemberService.addMember = jest
        .fn()
        .mockResolvedValueOnce(mockMembers[0])
        .mockResolvedValueOnce(mockMembers[1])
        .mockResolvedValueOnce(mockMembers[2]);

      // Act
      const result = await service.bulkInviteMembers('org-456', invitations, 'user-admin');

      // Assert
      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].userId).toBe('user-1');
      expect(result.successful[1].userId).toBe('user-2');
      expect(result.successful[2].userId).toBe('user-3');
      expect(mockMemberService.addMember).toHaveBeenCalledTimes(3);
    });

    it('should handle partial success in bulk invite', async () => {
      // Arrange
      const invitations = [
        { userId: 'user-1', invitedBy: 'user-admin', role: 'pilot' },
        { userId: 'user-2', invitedBy: 'user-admin', role: 'engineer' },
        { userId: 'user-3', invitedBy: 'user-admin', role: 'medic' },
      ];

      const mockMember1 = { id: 'member-1', userId: 'user-1', role: 'pilot' };
      const mockMember3 = { id: 'member-3', userId: 'user-3', role: 'medic' };

      mockMemberService.addMember = jest
        .fn()
        .mockResolvedValueOnce(mockMember1)
        .mockRejectedValueOnce(new Error('User already member'))
        .mockResolvedValueOnce(mockMember3);

      // Act
      const result = await service.bulkInviteMembers('org-456', invitations, 'user-admin');

      // Assert
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.successful[0].userId).toBe('user-1');
      expect(result.successful[1].userId).toBe('user-3');
      expect(result.failed[0].userId).toBe('user-2');
      expect(result.failed[0].error).toContain('User already member');
    });

    it('should handle all failures in bulk invite', async () => {
      // Arrange
      const invitations = [
        { userId: 'user-1', invitedBy: 'user-admin' },
        { userId: 'user-2', invitedBy: 'user-admin' },
      ];

      mockMemberService.addMember = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.bulkInviteMembers('org-456', invitations, 'user-admin');

      // Assert
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(2);
    });

    it('should handle empty invitation list', async () => {
      // Act
      const result = await service.bulkInviteMembers('org-456', [], 'user-admin');

      // Assert
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(mockMemberService.addMember).not.toHaveBeenCalled();
    });
  });

  describe('setupNewOrganization', () => {
    const mockOrganization = {
      id: 'org-new-123',
      name: 'New Mining Corp',
      description: 'Professional mining organization',
      ownerId: 'user-owner',
      createdAt: new Date(),
    };

    const mockOwnerMember = {
      id: 'member-owner',
      organizationId: 'org-new-123',
      userId: 'user-owner',
      role: 'owner',
      isActive: true,
    };

    const mockSettings = {
      id: 'settings-1',
      organizationId: 'org-new-123',
      allowPublicJoin: false,
      requireApproval: true,
      maxMembers: 100,
    };

    it('should setup new organization with full configuration', async () => {
      // Arrange
      const params: OrganizationSetupParams = {
        name: 'New Mining Corp',
        ownerId: 'user-owner',
        description: 'Professional mining organization',
        settings: {
          allowPublicJoin: false,
          requireApproval: true,
          maxMembers: 100,
        },
      };

      mockOrgService.createOrganization = jest.fn().mockResolvedValue(mockOrganization);
      mockMemberService.getMember = jest.fn().mockResolvedValue(mockOwnerMember);
      mockSettingsService.updateSettings = jest.fn().mockResolvedValue(mockSettings);

      // Act
      const result = await service.setupNewOrganization(params);

      // Assert
      expect(result).toBeDefined();
      expect(result.organization).toEqual(mockOrganization);
      expect(result.ownerMember).toEqual(mockOwnerMember);
      expect(result.settings).toEqual(mockSettings);
      expect(mockOrgService.createOrganization).toHaveBeenCalledWith(
        {
          name: 'New Mining Corp',
          description: 'Professional mining organization',
        },
        'user-owner'
      );
      expect(mockMemberService.getMember).toHaveBeenCalledWith('org-new-123', 'user-owner');
      expect(mockSettingsService.updateSettings).toHaveBeenCalledWith(
        'org-new-123',
        params.settings
      );
    });

    it('should setup organization with minimal configuration', async () => {
      // Arrange
      const params: OrganizationSetupParams = {
        name: 'Simple Org',
        ownerId: 'user-owner',
      };

      mockOrgService.createOrganization = jest.fn().mockResolvedValue(mockOrganization);
      mockMemberService.getMember = jest.fn().mockResolvedValue(mockOwnerMember);
      mockSettingsService.updateSettings = jest.fn().mockResolvedValue(mockSettings);

      // Act
      const result = await service.setupNewOrganization(params);

      // Assert
      expect(result.organization).toEqual(mockOrganization);
      expect(result.ownerMember).toEqual(mockOwnerMember);
      expect(mockSettingsService.updateSettings).toHaveBeenCalledWith('org-new-123', {});
    });

    it('should throw error if owner member not created', async () => {
      // Arrange
      const params: OrganizationSetupParams = {
        name: 'Failed Org',
        ownerId: 'user-owner',
      };

      mockOrgService.createOrganization = jest.fn().mockResolvedValue(mockOrganization);
      mockMemberService.getMember = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.setupNewOrganization(params)).rejects.toThrow(
        'Owner member not created'
      );
    });

    it('should rollback on organization creation failure', async () => {
      // Arrange
      const params: OrganizationSetupParams = {
        name: 'Duplicate Org',
        ownerId: 'user-owner',
      };

      mockOrgService.createOrganization = jest
        .fn()
        .mockRejectedValue(new Error('Organization name already exists'));

      // Act & Assert
      await expect(service.setupNewOrganization(params)).rejects.toThrow(
        'Organization name already exists'
      );
      expect(mockMemberService.getMember).not.toHaveBeenCalled();
      expect(mockSettingsService.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe('getOrganizationOverview', () => {
    const mockOrganization = {
      id: 'org-456',
      name: 'Test Organization',
      description: 'Test description',
      ownerId: 'user-owner',
    };

    const mockMembers = [
      {
        id: 'm-1',
        userId: 'user-1',
        isActive: true,
        joinedAt: new Date('2025-10-15'),
        createdAt: new Date('2025-10-15'),
      },
      {
        id: 'm-2',
        userId: 'user-2',
        isActive: true,
        joinedAt: new Date('2025-10-16'),
        createdAt: new Date('2025-10-16'),
      },
      {
        id: 'm-3',
        userId: 'user-3',
        isActive: false,
        joinedAt: null,
        createdAt: new Date('2025-10-17'),
      },
      {
        id: 'm-4',
        userId: 'user-4',
        isActive: true,
        joinedAt: new Date('2025-10-18'),
        createdAt: new Date('2025-10-18'),
      },
    ];

    const mockSettings = {
      allowPublicJoin: false,
      requireApproval: true,
    };

    it('should return comprehensive organization overview', async () => {
      // Arrange
      const mockResponse = {
        data: mockMembers,
        pagination: {
          total: 4,
          page: 1,
          limit: 100,
          totalPages: 1,
        },
      };

      mockOrgService.getOrganizationById = jest.fn().mockResolvedValue(mockOrganization);
      mockMemberService.getMembers = jest.fn().mockResolvedValue(mockResponse);
      mockSettingsService.getSettings = jest.fn().mockResolvedValue(mockSettings);

      // Act
      const result = await service.getOrganizationOverview('org-456');

      // Assert
      expect(result).toBeDefined();
      expect(result.organization).toEqual(mockOrganization);
      expect(result.memberCount).toBe(4);
      expect(result.memberStats.activeMembers).toBe(3);
      expect(result.memberStats.pendingInvitations).toBe(1);
      expect(result.recentMembers).toHaveLength(4);
      expect(result.recentMembers[0].id).toBe('m-4'); // Most recent first
      expect(result.settings).toEqual(mockSettings);
    });

    it('should limit recent members to 10', async () => {
      // Arrange
      const manyMembers = Array.from({ length: 15 }, (_, i) => ({
        id: `m-${i}`,
        userId: `user-${i}`,
        isActive: true,
        joinedAt: new Date(`2025-10-${10 + i}`),
        createdAt: new Date(`2025-10-${10 + i}`),
      }));

      const mockResponse = {
        data: manyMembers,
        pagination: {
          total: 15,
          page: 1,
          limit: 100,
          totalPages: 1,
        },
      };

      mockOrgService.getOrganizationById = jest.fn().mockResolvedValue(mockOrganization);
      mockMemberService.getMembers = jest.fn().mockResolvedValue(mockResponse);
      mockSettingsService.getSettings = jest.fn().mockResolvedValue(mockSettings);

      // Act
      const result = await service.getOrganizationOverview('org-456');

      // Assert
      expect(result.recentMembers).toHaveLength(10);
      expect(result.memberCount).toBe(15);
    });

    it('should throw error when organization not found', async () => {
      // Arrange
      mockOrgService.getOrganizationById = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.getOrganizationOverview('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
      expect(mockMemberService.getMembers).not.toHaveBeenCalled();
    });

    it('should handle organization with no members', async () => {
      // Arrange
      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 100,
          totalPages: 0,
        },
      };

      mockOrgService.getOrganizationById = jest.fn().mockResolvedValue(mockOrganization);
      mockMemberService.getMembers = jest.fn().mockResolvedValue(mockResponse);
      mockSettingsService.getSettings = jest.fn().mockResolvedValue(mockSettings);

      // Act
      const result = await service.getOrganizationOverview('org-456');

      // Assert
      expect(result.memberCount).toBe(0);
      expect(result.memberStats.activeMembers).toBe(0);
      expect(result.memberStats.pendingInvitations).toBe(0);
      expect(result.recentMembers).toHaveLength(0);
    });
  });

  describe('Transaction Safety', () => {
    it('should handle permission grant failure without rolling back member creation', async () => {
      // Arrange
      const params: InviteMemberParams = {
        organizationId: 'org-456',
        userId: 'user-789',
        invitedBy: 'user-admin',
        permissions: [
          {
            resource: 'ACTIVITY' as any,
            actions: [PermissionAction.CREATE],
          },
        ],
      };

      mockMemberService.addMember = jest.fn().mockResolvedValue({ id: 'member-123' });
      mockPermissionService.grantPermission = jest
        .fn()
        .mockRejectedValue(new Error('Constraint violation'));

      // Act
      const result = await service.inviteAndOnboardMember(params);

      // Assert - member created successfully, permission failed gracefully
      expect(result.member).toBeDefined();
      expect(result.permissions).toHaveLength(0); // Permission grant failed but caught
    });

    it('should rollback offboard on transaction failure', async () => {
      // Arrange
      mockPermissionService.revokeAllUserPermissions = jest.fn().mockResolvedValue(undefined);
      mockMemberService.removeMember = jest
        .fn()
        .mockRejectedValue(new Error('Foreign key constraint'));

      // Act & Assert
      await expect(service.offboardMember('org-456', 'user-789', 'user-admin')).rejects.toThrow(
        'Foreign key constraint'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle member with no permissions', async () => {
      // Arrange
      const params: InviteMemberParams = {
        organizationId: 'org-456',
        userId: 'user-789',
        invitedBy: 'user-admin',
        permissions: [],
      };

      mockMemberService.addMember = jest.fn().mockResolvedValue({ id: 'member-123' });

      // Act
      const result = await service.inviteAndOnboardMember(params);

      // Assert
      expect(result.permissions).toHaveLength(0);
      expect(mockPermissionService.grantPermission).not.toHaveBeenCalled();
    });

    it('should handle settings service failure in organization setup', async () => {
      // Arrange
      const params: OrganizationSetupParams = {
        name: 'Test Org',
        ownerId: 'user-owner',
        settings: { allowPublicJoin: true },
      };

      mockOrgService.createOrganization = jest.fn().mockResolvedValue({ id: 'org-123' });
      mockMemberService.getMember = jest.fn().mockResolvedValue({ id: 'member-1' });
      mockSettingsService.updateSettings = jest.fn().mockRejectedValue(new Error('Settings error'));

      // Act & Assert
      await expect(service.setupNewOrganization(params)).rejects.toThrow('Settings error');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

