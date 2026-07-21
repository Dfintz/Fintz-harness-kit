import { AppDataSource } from '../../config/database';
import { Organization } from '../../models/Organization';
import { OrganizationActivity } from '../../models/OrganizationActivity';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { OrganizationPermission } from '../../models/OrganizationPermission';
import { User } from '../../models/User';
import { OrganizationBulkService } from '../../services/organization/OrganizationBulkService';
import { ForbiddenError } from '../../utils/apiErrors';

// Mock dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/security/core/RoleService', () => ({
  getRoleService: () => ({
    getRoleIdByName: jest.fn().mockResolvedValue('mock-role-id'),
  }),
}));

// Mock OrganizationPermissionService — default to allowed; tests override per-case
const mockCheckPermission = jest.fn().mockResolvedValue({ allowed: true });
jest.mock('../../services/organization/OrganizationPermissionService', () => ({
  OrganizationPermissionService: jest.fn().mockImplementation(() => ({
    checkPermission: mockCheckPermission,
  })),
}));

// Mock logAuditEvent to prevent real Winston I/O in unit tests
jest.mock('../../utils/auditLogger', () => ({
  AuditEventType: { ACTIVITY_ACTION: 'ACTIVITY_ACTION' },
  logAuditEvent: jest.fn(),
}));

describe('OrganizationBulkService', () => {
  let service: OrganizationBulkService;
  let mockOrgRepo: any;
  let mockMembershipRepo: any;
  let mockPermissionRepo: any;
  let mockActivityRepo: any;
  let mockUserRepo: any;

  beforeEach(() => {
    // Reset mocks — includes mockCheckPermission since jest.clearAllMocks() covers module mocks
    jest.clearAllMocks();
    // Default: permission allowed; individual tests override when needed
    mockCheckPermission.mockResolvedValue({ allowed: true });

    // Create fresh mock repositories
    mockOrgRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockMembershipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    mockPermissionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockActivityRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };

    mockUserRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === Organization) {
        return mockOrgRepo;
      }
      if (entity === OrganizationMembership) {
        return mockMembershipRepo;
      }
      if (entity === OrganizationPermission) {
        return mockPermissionRepo;
      }
      if (entity === OrganizationActivity) {
        return mockActivityRepo;
      }
      if (entity === User) {
        return mockUserRepo;
      }
      return {};
    });

    service = new OrganizationBulkService();
  });

  describe('bulkAddMembers', () => {
    it('should successfully add multiple members', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      const mockUser1 = { id: 'user-1', username: 'testuser1' };
      const mockUser2 = { id: 'user-2', username: 'testuser2' };
      mockUserRepo.findOne.mockResolvedValueOnce(mockUser1).mockResolvedValueOnce(mockUser2);

      const mockMembership = { id: 'membership-1' };
      mockMembershipRepo.create.mockReturnValue(mockMembership);
      mockMembershipRepo.save.mockResolvedValue(mockMembership);
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const members = [
        { userId: 'user-1', role: 'member' },
        { userId: 'user-2', role: 'admin', permissions: ['manage_members'] },
      ];

      const result = await service.bulkAddMembers('org-1', members, 'actor-1');

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockMembershipRepo.save).toHaveBeenCalledTimes(2);
      expect(mockActivityRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should skip existing members', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const existingMembership = { userId: 'user-1', organizationId: 'org-1' };
      mockMembershipRepo.find.mockResolvedValue([existingMembership]);

      const members = [{ userId: 'user-1', role: 'member' }];
      const result = await service.bulkAddMembers('org-1', members, 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('User is already a member');
      expect(mockMembershipRepo.save).not.toHaveBeenCalled();
    });

    it('should handle non-existent users', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);
      mockUserRepo.findOne.mockResolvedValue(null);

      const members = [{ userId: 'nonexistent-user', role: 'member' }];
      const result = await service.bulkAddMembers('org-1', members, 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('User not found');
    });

    it('should throw error if organization not found', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      const members = [{ userId: 'user-1', role: 'member' }];
      await expect(service.bulkAddMembers('nonexistent-org', members, 'actor-1')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should handle mixed success and failure', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      mockUserRepo.findOne
        .mockResolvedValueOnce({ id: 'user-1', username: 'user1' })
        .mockResolvedValueOnce(null);

      mockMembershipRepo.create.mockReturnValue({ id: 'membership-1' });
      mockMembershipRepo.save.mockResolvedValue({ id: 'membership-1' });
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const members = [
        { userId: 'user-1', role: 'member' },
        { userId: 'user-2', role: 'member' },
      ];

      const result = await service.bulkAddMembers('org-1', members, 'actor-1');

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should throw ForbiddenError when actor lacks member management permission', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockCheckPermission.mockResolvedValue({
        allowed: false,
        reason: 'Missing member:manage permission',
      });

      const members = [{ userId: 'user-1', role: 'member' }];
      await expect(service.bulkAddMembers('org-1', members, 'unprivileged-actor')).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should succeed when actor is organization owner (permission check bypassed)', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      // OrganizationPermissionService.isOwnerOrAdmin returns true → allowed
      mockCheckPermission.mockResolvedValue({
        allowed: true,
        reason: 'Organization owner or admin',
      });
      mockMembershipRepo.find.mockResolvedValue([]);
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', username: 'owner' });
      mockMembershipRepo.create.mockReturnValue({ id: 'membership-1' });
      mockMembershipRepo.save.mockResolvedValue({ id: 'membership-1' });
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const result = await service.bulkAddMembers(
        'org-1',
        [{ userId: 'user-1', role: 'member' }],
        'owner-1'
      );

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should call checkPermission with correct resource and action', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      const members = [{ userId: 'user-1', role: 'member' }];
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', username: 'u1' });
      mockMembershipRepo.create.mockReturnValue({ id: 'm-1' });
      mockMembershipRepo.save.mockResolvedValue({ id: 'm-1' });
      mockActivityRepo.create.mockReturnValue({ id: 'a-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'a-1' });

      await service.bulkAddMembers('org-1', members, 'actor-1');

      expect(mockCheckPermission).toHaveBeenCalledWith(
        'actor-1',
        'org-1',
        'member', // ResourceType.MEMBER
        'manage' // PermissionAction.MANAGE
      );
    });
  });

  describe('bulkRemoveMembers — permission', () => {
    it('should throw ForbiddenError when actor lacks permission to remove members', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockCheckPermission.mockResolvedValue({ allowed: false, reason: 'Insufficient role' });

      await expect(
        service.bulkRemoveMembers('org-1', ['user-1'], 'unprivileged-actor')
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('bulkUpdateRoles — permission', () => {
    it('should throw ForbiddenError when actor lacks permission to update roles', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockCheckPermission.mockResolvedValue({ allowed: false, reason: 'Insufficient role' });

      await expect(
        service.bulkUpdateRoles(
          'org-1',
          [{ userId: 'user-1', role: 'admin' }],
          'unprivileged-actor'
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('bulkRemoveMembers', () => {
    it('should successfully remove multiple members', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const memberships = [
        { userId: 'user-1', organizationId: 'org-1' },
        { userId: 'user-2', organizationId: 'org-1' },
      ];
      mockMembershipRepo.find.mockResolvedValue(memberships);
      mockMembershipRepo.delete.mockResolvedValue({ affected: 1 });
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const result = await service.bulkRemoveMembers('org-1', ['user-1', 'user-2'], 'actor-1');

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockMembershipRepo.delete).toHaveBeenCalledTimes(2);
    });

    it('should prevent removing organization owner', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      const result = await service.bulkRemoveMembers('org-1', ['owner-1', 'user-2'], 'actor-1');

      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.error === 'Cannot remove organization owner')).toBe(true);
    });

    it('should handle non-members', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      const result = await service.bulkRemoveMembers('org-1', ['user-1'], 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('User is not a member');
    });

    it('should throw error if organization not found', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      await expect(
        service.bulkRemoveMembers('nonexistent-org', ['user-1'], 'actor-1')
      ).rejects.toThrow('Organization not found');
    });
  });

  describe('bulkUpdateRoles', () => {
    it('should successfully update multiple roles', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const membership1 = { userId: 'user-1', role: 'member', organizationId: 'org-1' };
      const membership2 = { userId: 'user-2', role: 'member', organizationId: 'org-1' };

      mockMembershipRepo.find.mockResolvedValueOnce([membership1, membership2]);
      mockMembershipRepo.save.mockResolvedValue({});
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const updates = [
        { userId: 'user-1', role: 'admin' },
        { userId: 'user-2', role: 'moderator' },
      ];

      const result = await service.bulkUpdateRoles('org-1', updates, 'actor-1');

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockMembershipRepo.save).toHaveBeenCalled();
    });

    it('should prevent changing owner role', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValueOnce([]);

      const updates = [{ userId: 'owner-1', role: 'member' }];
      const result = await service.bulkUpdateRoles('org-1', updates, 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('Cannot change owner role');
    });

    it('should handle non-members', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValueOnce([]);

      const updates = [{ userId: 'user-1', role: 'admin' }];
      const result = await service.bulkUpdateRoles('org-1', updates, 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('User is not a member');
    });

    it('should throw error if organization not found', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      const updates = [{ userId: 'user-1', role: 'admin' }];
      await expect(service.bulkUpdateRoles('nonexistent-org', updates, 'actor-1')).rejects.toThrow(
        'Organization not found'
      );
    });
  });

  describe('bulkGrantPermissions', () => {
    it('should successfully grant permissions to multiple members', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const membership1 = { userId: 'user-1', permissions: ['read'], organizationId: 'org-1' };
      const membership2 = { userId: 'user-2', permissions: [], organizationId: 'org-1' };

      mockMembershipRepo.findOne
        .mockResolvedValueOnce(membership1)
        .mockResolvedValueOnce(membership2);
      mockMembershipRepo.save.mockResolvedValue({});
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const grants = [
        { userId: 'user-1', permissions: ['write', 'delete'] },
        { userId: 'user-2', permissions: ['read'] },
      ];

      const result = await service.bulkGrantPermissions('org-1', grants, 'actor-1');

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(membership1.permissions).toContain('write');
      expect(membership1.permissions).toContain('delete');
    });

    it('should deduplicate permissions', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const membership = { userId: 'user-1', permissions: ['read'], organizationId: 'org-1' };
      mockMembershipRepo.findOne.mockResolvedValue(membership);
      mockMembershipRepo.save.mockResolvedValue({});
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const grants = [{ userId: 'user-1', permissions: ['read', 'write'] }];
      const result = await service.bulkGrantPermissions('org-1', grants, 'actor-1');

      expect(result.successful).toBe(1);
      // Should not have duplicate 'read' permission
      const readCount = membership.permissions.filter(p => p === 'read').length;
      expect(readCount).toBe(1);
    });

    it('should handle non-members', async () => {
      const mockOrg = { id: 'org-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.findOne.mockResolvedValue(null);

      const grants = [{ userId: 'user-1', permissions: ['read'] }];
      const result = await service.bulkGrantPermissions('org-1', grants, 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('User is not a member');
    });

    it('should throw error if organization not found', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      const grants = [{ userId: 'user-1', permissions: ['read'] }];
      await expect(
        service.bulkGrantPermissions('nonexistent-org', grants, 'actor-1')
      ).rejects.toThrow('Organization not found');
    });
  });

  describe('bulkRevokePermissions', () => {
    it('should successfully revoke permissions from multiple members', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const membership1 = {
        userId: 'user-1',
        permissions: ['read', 'write', 'delete'],
        organizationId: 'org-1',
      };
      const membership2 = {
        userId: 'user-2',
        permissions: ['read', 'write'],
        organizationId: 'org-1',
      };

      mockMembershipRepo.findOne
        .mockResolvedValueOnce(membership1)
        .mockResolvedValueOnce(membership2);
      mockMembershipRepo.save.mockResolvedValue({});
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const revocations = [
        { userId: 'user-1', permissions: ['write', 'delete'] },
        { userId: 'user-2', permissions: ['write'] },
      ];

      const result = await service.bulkRevokePermissions('org-1', revocations, 'actor-1');

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(membership1.permissions).toEqual(['read']);
      expect(membership2.permissions).toEqual(['read']);
    });

    it('should prevent revoking owner permissions', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const revocations = [{ userId: 'owner-1', permissions: ['admin'] }];
      const result = await service.bulkRevokePermissions('org-1', revocations, 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('Cannot revoke owner permissions');
    });

    it('should handle non-members', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.findOne.mockResolvedValue(null);

      const revocations = [{ userId: 'user-1', permissions: ['read'] }];
      const result = await service.bulkRevokePermissions('org-1', revocations, 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('User is not a member');
    });

    it('should throw error if organization not found', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      const revocations = [{ userId: 'user-1', permissions: ['read'] }];
      await expect(
        service.bulkRevokePermissions('nonexistent-org', revocations, 'actor-1')
      ).rejects.toThrow('Organization not found');
    });
  });

  describe('importMembersFromCSV', () => {
    it('should successfully import members from CSV', async () => {
      const csvContent = `email,username,role,permissions
user1@test.com,user1,admin,"manage_members,manage_settings"
user2@test.com,user2,member,""`;

      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1' });

      const users = [
        { id: 'user-1', email: 'user1@test.com', username: 'user1' },
        { id: 'user-2', email: 'user2@test.com', username: 'user2' },
      ];
      mockUserRepo.find.mockResolvedValue(users);
      mockMembershipRepo.find.mockResolvedValue([]);
      mockUserRepo.findOne.mockResolvedValueOnce(users[0]).mockResolvedValueOnce(users[1]);

      mockMembershipRepo.create.mockReturnValue({ id: 'membership-1' });
      mockMembershipRepo.save.mockResolvedValue({ id: 'membership-1' });
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const result = await service.importMembersFromCSV('org-1', csvContent, 'actor-1');

      expect(result.successful).toBe(2);
      expect(mockUserRepo.find).toHaveBeenCalled();
    });

    it('should handle users not found by email', async () => {
      const csvContent = `email,username,role
nonexistent@test.com,user1,member`;

      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1' });
      mockUserRepo.find.mockResolvedValue([]);
      mockMembershipRepo.find.mockResolvedValue([]);

      const result = await service.importMembersFromCSV('org-1', csvContent, 'actor-1');

      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.error === 'User not found')).toBe(true);
    });
  });

  describe('exportMembersToCSV', () => {
    it('should export members to CSV format', async () => {
      const memberships = [
        {
          userId: 'user-1',
          user: { username: 'user1', email: 'user1@test.com' },
          role: 'admin',
          permissions: ['manage_members', 'manage_settings'],
          joinedAt: new Date('2024-01-01'),
        },
        {
          userId: 'user-2',
          user: { username: 'user2', email: 'user2@test.com' },
          role: 'member',
          permissions: [],
          joinedAt: new Date('2024-01-02'),
        },
      ];

      mockMembershipRepo.find.mockResolvedValue(memberships);

      const csv = await service.exportMembersToCSV('org-1');

      expect(csv).toContain('user_id,username,email,role,permissions,joined_at');
      expect(csv).toContain('user1@test.com');
      expect(csv).toContain('user2@test.com');
      expect(csv).toContain('admin');
      expect(csv).toContain('member');
    });

    it('should handle empty member list', async () => {
      mockMembershipRepo.find.mockResolvedValue([]);

      const csv = await service.exportMembersToCSV('org-1');

      expect(csv).toContain('user_id,username,email,role,permissions,joined_at');
      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // Only header
    });
  });

  describe('bulkUpdateMetadata', () => {
    it('should successfully update metadata for multiple members', async () => {
      const membership1 = {
        userId: 'user-1',
        organizationId: 'org-1',
        metadata: { notes: 'old note' },
      };
      const membership2 = {
        userId: 'user-2',
        organizationId: 'org-1',
        metadata: {},
      };

      mockMembershipRepo.findOne
        .mockResolvedValueOnce(membership1)
        .mockResolvedValueOnce(membership2);
      mockMembershipRepo.save.mockResolvedValue({});

      const updates = [
        { userId: 'user-1', metadata: { notes: 'updated note', department: 'Engineering' } },
        { userId: 'user-2', metadata: { department: 'Sales' } },
      ];

      const result = await service.bulkUpdateMetadata('org-1', updates, 'actor-1');

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect((membership1.metadata as any).notes).toBe('updated note');
      expect((membership1.metadata as any).department).toBe('Engineering');
      expect((membership2.metadata as any).department).toBe('Sales');
    });

    it('should merge with existing metadata', async () => {
      const membership = {
        userId: 'user-1',
        organizationId: 'org-1',
        metadata: { existingField: 'value1' },
      };

      mockMembershipRepo.findOne.mockResolvedValue(membership);
      mockMembershipRepo.save.mockResolvedValue({});

      const updates = [{ userId: 'user-1', metadata: { newField: 'value2' } }];
      const result = await service.bulkUpdateMetadata('org-1', updates, 'actor-1');

      expect(result.successful).toBe(1);
      expect((membership.metadata as any).existingField).toBe('value1');
      expect((membership.metadata as any).newField).toBe('value2');
    });

    it('should handle non-members', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);

      const updates = [{ userId: 'user-1', metadata: { note: 'test' } }];
      const result = await service.bulkUpdateMetadata('org-1', updates, 'actor-1');

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('User is not a member');
    });
  });

  describe('getBulkOperationStats', () => {
    it('should return operation statistics', async () => {
      const memberships = [
        { userId: 'user-1', role: 'admin' },
        { userId: 'user-2', role: 'member' },
        { userId: 'user-3', role: 'member' },
        { userId: 'user-4', role: 'moderator' },
      ];

      mockMembershipRepo.find.mockResolvedValue(memberships);
      mockActivityRepo.count.mockResolvedValue(5);

      const stats = await service.getBulkOperationStats('org-1');

      expect(stats.totalMembers).toBe(4);
      expect(stats.membersByRole.admin).toBe(1);
      expect(stats.membersByRole.member).toBe(2);
      expect(stats.membersByRole.moderator).toBe(1);
      expect(stats.recentBulkOperations).toBe(5);
    });

    it('should handle empty organization', async () => {
      mockMembershipRepo.find.mockResolvedValue([]);
      mockActivityRepo.count.mockResolvedValue(0);

      const stats = await service.getBulkOperationStats('org-1');

      expect(stats.totalMembers).toBe(0);
      expect(stats.recentBulkOperations).toBe(0);
    });
  });

  describe('bulkCreateOrganizations', () => {
    it('should successfully create multiple organizations', async () => {
      const mockUser = { id: 'creator-1', username: 'creator' };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const orgsData = [
        { name: 'Org 1', type: 'DIVISION', description: 'Test org 1' },
        { name: 'Org 2', type: 'SQUADRON', description: 'Test org 2' },
      ];

      const mockOrg1 = { id: 'org-1', ...orgsData[0], ownerId: 'creator-1' };
      const mockOrg2 = { id: 'org-2', ...orgsData[1], ownerId: 'creator-1' };

      mockOrgRepo.create.mockReturnValueOnce(mockOrg1).mockReturnValueOnce(mockOrg2);
      mockOrgRepo.save.mockResolvedValueOnce(mockOrg1).mockResolvedValueOnce(mockOrg2);
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const result = await service.bulkCreateOrganizations(orgsData, 'creator-1');

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(mockOrgRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should throw error if creator not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const orgsData = [{ name: 'Org 1', type: 'ROOT' }];
      await expect(service.bulkCreateOrganizations(orgsData, 'nonexistent')).rejects.toThrow(
        'Creator not found'
      );
    });

    it('should handle validation errors', async () => {
      const mockUser = { id: 'creator-1', username: 'creator' };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const orgsData = [
        { name: '', type: 'ROOT' }, // Invalid: empty name
        { name: 'Valid Org', type: 'DIVISION' },
      ];

      const mockOrg = { id: 'org-1', name: 'Valid Org', ownerId: 'creator-1' };
      mockOrgRepo.create.mockReturnValue(mockOrg);
      mockOrgRepo.save.mockResolvedValue(mockOrg);
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const result = await service.bulkCreateOrganizations(orgsData, 'creator-1');

      expect(result.success).toBe(false);
      expect(result.created).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Organization name is required');
    });
  });

  describe('bulkUpdateOrganizations', () => {
    it('should successfully update multiple organizations', async () => {
      const org1 = { id: 'org-1', name: 'Old Name 1', status: 'ACTIVE' };
      const org2 = { id: 'org-2', name: 'Old Name 2', status: 'ACTIVE' };

      mockOrgRepo.findOne.mockResolvedValueOnce(org1).mockResolvedValueOnce(org2);
      mockOrgRepo.save.mockResolvedValue({});

      const updates = [
        { id: 'org-1', data: { name: 'New Name 1' } },
        { id: 'org-2', data: { status: 'INACTIVE' } },
      ];

      const result = await service.bulkUpdateOrganizations(updates);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockOrgRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should handle non-existent organizations', async () => {
      mockOrgRepo.findOne
        .mockResolvedValueOnce({ id: 'org-1', name: 'Org 1' })
        .mockResolvedValueOnce(null);

      const updates = [
        { id: 'org-1', data: { name: 'Updated' } },
        { id: 'org-invalid', data: { name: 'Updated' } },
      ];

      const result = await service.bulkUpdateOrganizations(updates);

      expect(result.success).toBe(false);
      expect(result.updated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Organization not found');
    });

    it('should handle partial failures', async () => {
      mockOrgRepo.findOne
        .mockResolvedValueOnce({ id: 'org-1', name: 'Org 1' })
        .mockResolvedValueOnce({ id: 'org-2', name: 'Org 2' });

      mockOrgRepo.save.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Database error'));

      const updates = [
        { id: 'org-1', data: { name: 'Updated 1' } },
        { id: 'org-2', data: { name: 'Updated 2' } },
      ];

      const result = await service.bulkUpdateOrganizations(updates);

      expect(result.success).toBe(false);
      expect(result.updated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Database error');
    });
  });

  describe('bulkDeleteOrganizations', () => {
    it('should successfully delete multiple organizations', async () => {
      const org1 = { id: 'org-1', name: 'Org 1' };
      const org2 = { id: 'org-2', name: 'Org 2' };

      mockOrgRepo.findOne.mockResolvedValueOnce(org1).mockResolvedValueOnce(org2);
      mockMembershipRepo.count.mockResolvedValue(1); // Only owner
      mockMembershipRepo.delete.mockResolvedValue({ affected: 1 });
      mockOrgRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.bulkDeleteOrganizations(['org-1', 'org-2']);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockOrgRepo.delete).toHaveBeenCalledTimes(2);
    });

    it('should prevent deleting organizations with members', async () => {
      const org = { id: 'org-1', name: 'Org 1' };
      mockOrgRepo.findOne.mockResolvedValue(org);
      mockMembershipRepo.count.mockResolvedValue(5); // Has members

      const result = await service.bulkDeleteOrganizations(['org-1']);

      expect(result.success).toBe(false);
      expect(result.deleted).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Cannot delete organization with members');
      expect(mockOrgRepo.delete).not.toHaveBeenCalled();
    });

    it('should handle non-existent organizations', async () => {
      mockOrgRepo.findOne
        .mockResolvedValueOnce({ id: 'org-1', name: 'Org 1' })
        .mockResolvedValueOnce(null);
      mockMembershipRepo.count.mockResolvedValue(1);
      mockMembershipRepo.delete.mockResolvedValue({ affected: 1 });
      mockOrgRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.bulkDeleteOrganizations(['org-1', 'org-invalid']);

      expect(result.success).toBe(false);
      expect(result.deleted).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Organization not found');
    });

    it('should handle mixed success and failure', async () => {
      mockOrgRepo.findOne
        .mockResolvedValueOnce({ id: 'org-1', name: 'Org 1' })
        .mockResolvedValueOnce({ id: 'org-2', name: 'Org 2' });
      mockMembershipRepo.count
        .mockResolvedValueOnce(1) // org-1 has only owner
        .mockResolvedValueOnce(10); // org-2 has many members
      mockMembershipRepo.delete.mockResolvedValue({ affected: 1 });
      mockOrgRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.bulkDeleteOrganizations(['org-1', 'org-2']);

      expect(result.success).toBe(false);
      expect(result.deleted).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe('org-2');
    });
  });

  describe('bulkAddMembersWithProgress', () => {
    it('should add members with progress tracking', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      const mockUser1 = { id: 'user-1', username: 'testuser1' };
      const mockUser2 = { id: 'user-2', username: 'testuser2' };
      mockUserRepo.findOne.mockResolvedValueOnce(mockUser1).mockResolvedValueOnce(mockUser2);

      const mockMembership = { id: 'membership-1' };
      mockMembershipRepo.create.mockReturnValue(mockMembership);
      mockMembershipRepo.save.mockResolvedValue(mockMembership);
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const members = [
        { userId: 'user-1', role: 'member' },
        { userId: 'user-2', role: 'admin' },
      ];

      const progressUpdates: any[] = [];
      const progressCallback = jest.fn(progress => {
        progressUpdates.push(progress);
      });

      const result = await service.bulkAddMembersWithProgress('org-1', members, 'actor-1', {
        progressCallback,
        batchSize: 2,
        delayBetweenBatches: 0,
      });

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(progressCallback).toHaveBeenCalled();
      expect(progressUpdates.length).toBeGreaterThan(0);
      // Progress callbacks are only called after completion or error (optimized to reduce overhead)
      expect(progressUpdates.some(p => p.status === 'completed')).toBe(true);
      expect(progressUpdates.filter(p => p.status === 'completed').length).toBe(2);
    });

    it('should handle errors with progress tracking', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      mockUserRepo.findOne
        .mockResolvedValueOnce({ id: 'user-1', username: 'user1' })
        .mockResolvedValueOnce(null); // User not found

      mockMembershipRepo.create.mockReturnValue({ id: 'membership-1' });
      mockMembershipRepo.save.mockResolvedValue({ id: 'membership-1' });
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const members = [
        { userId: 'user-1', role: 'member' },
        { userId: 'user-2', role: 'member' },
      ];

      const progressUpdates: any[] = [];
      const progressCallback = jest.fn(progress => {
        progressUpdates.push(progress);
      });

      const result = await service.bulkAddMembersWithProgress('org-1', members, 'actor-1', {
        progressCallback,
        batchSize: 2,
        delayBetweenBatches: 0,
      });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(progressUpdates.some(p => p.status === 'error')).toBe(true);
    });
  });

  describe('bulkInviteMembers', () => {
    it('should use progress tracking when options provided', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      const mockUser = { id: 'user-1', username: 'testuser1' };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const mockMembership = { id: 'membership-1' };
      mockMembershipRepo.create.mockReturnValue(mockMembership);
      mockMembershipRepo.save.mockResolvedValue(mockMembership);
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const members = [{ userId: 'user-1', role: 'member' }];
      const progressCallback = jest.fn();

      const result = await service.bulkInviteMembers('org-1', members, 'actor-1', {
        progressCallback,
      });

      expect(result.successful).toBe(1);
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should use standard method when no options provided', async () => {
      const mockOrg = { id: 'org-1', ownerId: 'owner-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockMembershipRepo.find.mockResolvedValue([]);

      const mockUser = { id: 'user-1', username: 'testuser1' };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const mockMembership = { id: 'membership-1' };
      mockMembershipRepo.create.mockReturnValue(mockMembership);
      mockMembershipRepo.save.mockResolvedValue(mockMembership);
      mockActivityRepo.create.mockReturnValue({ id: 'activity-1' });
      mockActivityRepo.save.mockResolvedValue({ id: 'activity-1' });

      const members = [{ userId: 'user-1', role: 'member' }];

      const result = await service.bulkInviteMembers('org-1', members, 'actor-1');

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
