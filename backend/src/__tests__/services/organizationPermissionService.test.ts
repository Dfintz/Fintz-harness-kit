import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  OrganizationPermission,
  PermissionAction,
  ResourceType,
} from '../../models/OrganizationPermission';
import { OrganizationPermissionService } from '../../services/organization';

// Mock the database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    isInitialized: true,
  },
}));

describe('OrganizationPermissionService', () => {
  let service: OrganizationPermissionService;
  let mockPermissionRepository: jest.Mocked<Repository<OrganizationPermission>>;
  let mockOrgRepository: jest.Mocked<Repository<Organization>>;
  let mockMembershipRepository: jest.Mocked<Repository<OrganizationMembership>>;

  beforeEach(() => {
    // Create mock repositories
    mockPermissionRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      countBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockOrgRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    } as any;

    mockMembershipRepository = {
      findOne: jest.fn(),
    } as any;

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === OrganizationPermission || entity.name === 'OrganizationPermission') {
        return mockPermissionRepository;
      }
      if (entity === Organization || entity.name === 'Organization') {
        return mockOrgRepository;
      }
      if (entity === OrganizationMembership || entity.name === 'OrganizationMembership') {
        return mockMembershipRepository;
      }
      return mockPermissionRepository;
    });

    service = new OrganizationPermissionService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkPermission', () => {
    it('should allow access when valid permission exists', async () => {
      const permission = {
        id: 'perm-1',
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
        isValid: jest.fn(() => true),
        allowsAction: jest.fn((action: PermissionAction) => action === PermissionAction.VIEW),
        appliesToResource: jest.fn(() => true),
        matchesTimeRestrictions: jest.fn(() => true),
        matchesIPRestrictions: jest.fn(() => true),
        priority: 10,
      } as any;

      mockPermissionRepository.find.mockResolvedValue([permission]);
      mockOrgRepository.findOne.mockResolvedValue({ id: 'org-1', getAncestorIds: () => [] } as any);

      const result = await service.checkPermission(
        'user-1',
        'org-1',
        ResourceType.FLEET,
        PermissionAction.VIEW
      );

      expect(result.allowed).toBe(true);
      expect(result.matchedPermissions).toHaveLength(1);
    });

    it('should deny access when no permissions exist', async () => {
      mockPermissionRepository.find.mockResolvedValue([]);
      mockOrgRepository.findOne.mockResolvedValue({ id: 'org-1', getAncestorIds: () => [] } as any);

      const result = await service.checkPermission(
        'user-1',
        'org-1',
        ResourceType.FLEET,
        PermissionAction.VIEW
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No applicable permissions found');
    });

    it('should deny access when permission is invalid', async () => {
      const permission = {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
        isValid: jest.fn(() => false),
      } as any;

      mockPermissionRepository.find.mockResolvedValue([permission]);
      mockOrgRepository.findOne.mockResolvedValue({ id: 'org-1', getAncestorIds: () => [] } as any);

      const result = await service.checkPermission(
        'user-1',
        'org-1',
        ResourceType.FLEET,
        PermissionAction.VIEW
      );

      expect(result.allowed).toBe(false);
    });

    it('should deny access when action is not allowed', async () => {
      const permission = {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
        isValid: jest.fn(() => true),
        allowsAction: jest.fn(() => false),
        appliesToResource: jest.fn(() => true),
        matchesTimeRestrictions: jest.fn(() => true),
        matchesIPRestrictions: jest.fn(() => true),
      } as any;

      mockPermissionRepository.find.mockResolvedValue([permission]);
      mockOrgRepository.findOne.mockResolvedValue({ id: 'org-1', getAncestorIds: () => [] } as any);

      const result = await service.checkPermission(
        'user-1',
        'org-1',
        ResourceType.FLEET,
        PermissionAction.EDIT
      );

      expect(result.allowed).toBe(false);
    });

    it('should sort permissions by priority', async () => {
      const perm1 = {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
        isValid: jest.fn(() => true),
        allowsAction: jest.fn(() => true),
        appliesToResource: jest.fn(() => true),
        matchesTimeRestrictions: jest.fn(() => true),
        matchesIPRestrictions: jest.fn(() => true),
        priority: 5,
      } as any;

      const perm2 = {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
        isValid: jest.fn(() => true),
        allowsAction: jest.fn(() => true),
        appliesToResource: jest.fn(() => true),
        matchesTimeRestrictions: jest.fn(() => true),
        matchesIPRestrictions: jest.fn(() => true),
        priority: 10,
      } as any;

      mockPermissionRepository.find.mockResolvedValue([perm1, perm2]);
      mockOrgRepository.findOne.mockResolvedValue({ id: 'org-1', getAncestorIds: () => [] } as any);

      const result = await service.checkPermission(
        'user-1',
        'org-1',
        ResourceType.FLEET,
        PermissionAction.VIEW
      );

      expect(result.allowed).toBe(true);
      expect(result.matchedPermissions[0]).toBe(perm2);
    });
  });

  describe('checkMultiplePermissions', () => {
    it('should check multiple permissions at once', async () => {
      const permission = {
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
        isValid: jest.fn(() => true),
        allowsAction: jest.fn(() => true),
        appliesToResource: jest.fn(() => true),
        matchesTimeRestrictions: jest.fn(() => true),
        matchesIPRestrictions: jest.fn(() => true),
        priority: 10,
      } as any;

      mockPermissionRepository.find.mockResolvedValue([permission]);
      mockOrgRepository.findOne.mockResolvedValue({ id: 'org-1', getAncestorIds: () => [] } as any);

      const checks = [
        { resource: ResourceType.FLEET, action: PermissionAction.VIEW },
        { resource: ResourceType.EVENT, action: PermissionAction.EDIT },
      ];

      const results = await service.checkMultiplePermissions('user-1', 'org-1', checks);

      expect(results.size).toBe(2);
      expect(results.has('fleet:view:any')).toBe(true);
      expect(results.has('event:edit:any')).toBe(true);
    });
  });

  describe('isOwnerOrAdmin', () => {
    it('should return true if user is organization owner', async () => {
      const org = {
        id: 'org-1',
        ownerId: 'user-1',
      } as any;

      mockOrgRepository.findOne.mockResolvedValue(org);

      const result = await service.isOwnerOrAdmin('user-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return true if user is in admin list', async () => {
      const org = {
        id: 'org-1',
        ownerId: 'user-2',
      } as any;

      mockOrgRepository.findOne.mockResolvedValue(org);
      mockMembershipRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        isActive: true,
        role: { name: 'admin' },
      } as any);

      const result = await service.isOwnerOrAdmin('user-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return false if user is not owner or admin', async () => {
      const org = {
        id: 'org-1',
        ownerId: 'user-2',
      } as any;

      mockOrgRepository.findOne.mockResolvedValue(org);
      mockMembershipRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        isActive: true,
        role: { name: 'member' },
      } as any);

      const result = await service.isOwnerOrAdmin('user-1', 'org-1');

      expect(result).toBe(false);
    });

    it('should return false if organization not found', async () => {
      mockOrgRepository.findOne.mockResolvedValue(null);

      const result = await service.isOwnerOrAdmin('user-1', 'org-1');

      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return direct and inherited permissions', async () => {
      const directPerm = {
        id: 'perm-1',
        resource: ResourceType.FLEET,
        resourceId: null,
        actions: [PermissionAction.VIEW],
        priority: 10,
      } as any;

      const inheritedPerm = {
        id: 'perm-2',
        resource: ResourceType.EVENT,
        resourceId: null,
        actions: [PermissionAction.EDIT],
        priority: 5,
      } as any;

      const org = {
        id: 'org-1',
        parentOrgId: 'parent-1',
        settings: { inheritPermissions: true },
        getAncestorIds: jest.fn(() => ['parent-1']),
      } as any;

      mockPermissionRepository.find
        .mockResolvedValueOnce([directPerm])
        .mockResolvedValueOnce([inheritedPerm]);
      mockOrgRepository.findOne.mockResolvedValue(org);

      const result = await service.getUserPermissions('user-1', 'org-1');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should deduplicate permissions and keep highest priority', async () => {
      const perm1 = {
        resource: ResourceType.FLEET,
        resourceId: null,
        actions: [PermissionAction.VIEW],
        priority: 5,
      } as any;

      const perm2 = {
        resource: ResourceType.FLEET,
        resourceId: null,
        actions: [PermissionAction.VIEW],
        priority: 10,
      } as any;

      const org = {
        id: 'org-1',
        getAncestorIds: jest.fn(() => []),
      } as any;

      mockPermissionRepository.find.mockResolvedValue([perm1, perm2]);
      mockOrgRepository.findOne.mockResolvedValue(org);

      const result = await service.getUserPermissions('user-1', 'org-1');

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe(10);
    });

    it('should not include inherited permissions when disabled', async () => {
      const directPerm = {
        resource: ResourceType.FLEET,
        resourceId: null,
        actions: [PermissionAction.VIEW],
        priority: 10,
      } as any;

      const org = {
        id: 'org-1',
        parentOrgId: 'parent-1',
        settings: { inheritPermissions: false },
        getAncestorIds: jest.fn(() => ['parent-1']),
      } as any;

      mockPermissionRepository.find.mockResolvedValue([directPerm]);
      mockOrgRepository.findOne.mockResolvedValue(org);

      const result = await service.getUserPermissions('user-1', 'org-1');

      expect(mockPermissionRepository.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOrganizationPermissions', () => {
    it('should get all permissions for organization', async () => {
      const permissions = [
        { id: 'perm-1', priority: 10 },
        { id: 'perm-2', priority: 5 },
      ] as any;

      mockPermissionRepository.find.mockResolvedValue(permissions);

      const result = await service.getOrganizationPermissions('org-1');

      expect(result).toHaveLength(2);
      expect(mockPermissionRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        relations: ['user'],
        order: { priority: 'DESC', createdAt: 'DESC' },
      });
    });
  });

  describe('getRolePermissions', () => {
    it('should get permissions for specific role', async () => {
      const permissions = [{ id: 'perm-1', roleId: 'role-1' }] as any;

      mockPermissionRepository.find.mockResolvedValue(permissions);

      const result = await service.getRolePermissions('org-1', 'role-1');

      expect(result).toHaveLength(1);
      expect(mockPermissionRepository.find).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          roleId: 'role-1',
        },
        order: { priority: 'DESC' },
      });
    });
  });

  describe('grantPermission', () => {
    it('should grant permission to user', async () => {
      const org = { id: 'org-1' } as any;
      const permission = {
        id: 'perm-1',
        organizationId: 'org-1',
        userId: 'user-1',
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
      } as any;

      mockOrgRepository.findOne.mockResolvedValue(org);
      mockPermissionRepository.create.mockReturnValue(permission);
      mockPermissionRepository.save.mockResolvedValue(permission);

      const result = await service.grantPermission(
        'org-1',
        'user-1',
        { resource: ResourceType.FLEET, actions: [PermissionAction.VIEW] },
        'admin-1'
      );

      expect(result.organizationId).toBe('org-1');
      expect(result.userId).toBe('user-1');
      expect(mockPermissionRepository.save).toHaveBeenCalled();
    });

    it('should throw error if organization not found', async () => {
      mockOrgRepository.findOne.mockResolvedValue(null);

      await expect(
        service.grantPermission(
          'non-existent',
          'user-1',
          { resource: ResourceType.FLEET },
          'admin-1'
        )
      ).rejects.toThrow('Organization not found');
    });
  });

  describe('grantMultiplePermissions', () => {
    it('should grant multiple permissions at once', async () => {
      const org = { id: 'org-1' } as any;
      const permission = {
        id: 'perm-1',
        organizationId: 'org-1',
        userId: 'user-1',
      } as any;

      mockOrgRepository.findOne.mockResolvedValue(org);
      mockPermissionRepository.create.mockReturnValue(permission);
      mockPermissionRepository.save.mockResolvedValue(permission);

      const permissions = [
        { resource: ResourceType.FLEET, actions: [PermissionAction.VIEW] },
        { resource: ResourceType.EVENT, actions: [PermissionAction.EDIT] },
      ];

      const result = await service.grantMultiplePermissions(
        'org-1',
        'user-1',
        permissions,
        'admin-1'
      );

      expect(result).toHaveLength(2);
      expect(mockPermissionRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('revokePermission', () => {
    it('should revoke permission by marking as inactive', async () => {
      mockPermissionRepository.findOne.mockResolvedValue({
        id: 'perm-1',
        organizationId: 'org-1',
        userId: 'user-1',
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
      } as any);
      mockPermissionRepository.update.mockResolvedValue({} as any);

      await service.revokePermission('perm-1');

      expect(mockPermissionRepository.update).toHaveBeenCalledWith(
        { id: 'perm-1' },
        { isActive: false }
      );
    });
  });

  describe('revokeAllUserPermissions', () => {
    it('should revoke all permissions for user in organization', async () => {
      mockPermissionRepository.countBy.mockResolvedValue(2 as any);
      mockPermissionRepository.update.mockResolvedValue({} as any);

      await service.revokeAllUserPermissions('user-1', 'org-1');

      expect(mockPermissionRepository.update).toHaveBeenCalledWith(
        {
          organizationId: 'org-1',
          userId: 'user-1',
        },
        { isActive: false }
      );
    });
  });

  describe('updatePermission', () => {
    it('should update existing permission', async () => {
      const permission = {
        id: 'perm-1',
        resource: ResourceType.FLEET,
        priority: 5,
      } as any;

      const updated = {
        ...permission,
        priority: 10,
      };

      mockPermissionRepository.findOne.mockResolvedValue(permission);
      mockPermissionRepository.save.mockResolvedValue(updated);

      const result = await service.updatePermission('perm-1', { priority: 10 });

      expect(result.priority).toBe(10);
      expect(mockPermissionRepository.save).toHaveBeenCalled();
    });

    it('should throw error if permission not found', async () => {
      mockPermissionRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePermission('non-existent', { priority: 10 })).rejects.toThrow(
        'Permission not found'
      );
    });
  });

  describe('applyPermissionTemplate', () => {
    it('should apply permission template to user', async () => {
      const org = { id: 'org-1' } as any;
      const permission = {
        id: 'perm-1',
        organizationId: 'org-1',
        userId: 'user-1',
      } as any;

      mockOrgRepository.findOne.mockResolvedValue(org);
      mockPermissionRepository.countBy.mockResolvedValue(1 as any);
      mockPermissionRepository.update.mockResolvedValue({} as any);
      mockPermissionRepository.create.mockReturnValue(permission);
      mockPermissionRepository.save.mockResolvedValue(permission);

      const result = await service.applyPermissionTemplate('org-1', 'user-1', 'ADMIN', 'owner-1');

      expect(result.length).toBeGreaterThan(0);
      expect(mockPermissionRepository.update).toHaveBeenCalled(); // Revoke existing
      expect(mockPermissionRepository.save).toHaveBeenCalled(); // Grant new
    });

    it('should throw error for unknown template', async () => {
      await expect(
        service.applyPermissionTemplate('org-1', 'user-1', 'UNKNOWN' as any, 'owner-1')
      ).rejects.toThrow('Unknown permission template');
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return list of available templates', () => {
      const templates = service.getAvailableTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');
    });
  });

  describe('propagateToChildren', () => {
    it('should propagate inheritable permission to child organizations', async () => {
      const permission = {
        id: 'perm-1',
        userId: 'user-1',
        resource: ResourceType.FLEET,
        inheritable: true,
      } as any;

      const org = {
        id: 'org-1',
        path: 'org-1',
      } as any;

      const child = {
        id: 'child-1',
        settings: { inheritPermissions: true },
      } as any;

      mockPermissionRepository.findOne
        .mockResolvedValueOnce(permission)
        .mockResolvedValueOnce(null);
      mockOrgRepository.findOne.mockResolvedValue(org);
      mockOrgRepository.find.mockResolvedValue([child]);
      mockPermissionRepository.create.mockReturnValue({} as any);
      mockPermissionRepository.save.mockResolvedValue({} as any);

      await service.propagateToChildren('org-1', 'perm-1');

      expect(mockPermissionRepository.save).toHaveBeenCalled();
    });

    it('should throw error if permission not found', async () => {
      mockPermissionRepository.findOne.mockResolvedValue(null);

      await expect(service.propagateToChildren('org-1', 'non-existent')).rejects.toThrow(
        'Permission not found or not inheritable'
      );
    });

    it('should throw error if permission not inheritable', async () => {
      const permission = {
        id: 'perm-1',
        inheritable: false,
      } as any;

      mockPermissionRepository.findOne.mockResolvedValue(permission);

      await expect(service.propagateToChildren('org-1', 'perm-1')).rejects.toThrow(
        'Permission not found or not inheritable'
      );
    });

    it('should skip children with inheritance disabled', async () => {
      const permission = {
        id: 'perm-1',
        userId: 'user-1',
        resource: ResourceType.FLEET,
        inheritable: true,
      } as any;

      const org = {
        id: 'org-1',
        path: 'org-1',
      } as any;

      const child = {
        id: 'child-1',
        settings: { inheritPermissions: false },
      } as any;

      mockPermissionRepository.findOne.mockResolvedValue(permission);
      mockOrgRepository.findOne.mockResolvedValue(org);
      mockOrgRepository.find.mockResolvedValue([child]);

      await service.propagateToChildren('org-1', 'perm-1');

      expect(mockPermissionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredPermissions', () => {
    it('should deactivate expired permissions', async () => {
      const mockQueryBuilder: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      mockPermissionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.cleanupExpiredPermissions();

      expect(result).toBe(5);
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('cleanupOrphanedPermissions', () => {
    it('should return 0 (relies on CASCADE)', async () => {
      const result = await service.cleanupOrphanedPermissions();

      expect(result).toBe(0);
    });
  });

  describe('getPermissionStats', () => {
    it('should calculate permission statistics', async () => {
      const permissions = [
        { userId: 'user-1', resource: ResourceType.FLEET, isActive: true, inherited: false },
        { userId: 'user-2', resource: ResourceType.FLEET, isActive: true, inherited: true },
        { userId: 'user-1', resource: ResourceType.EVENT, isActive: false, inherited: false },
      ] as any;

      mockPermissionRepository.find.mockResolvedValue(permissions);

      const result = await service.getPermissionStats('org-1');

      expect(result.totalPermissions).toBe(3);
      expect(result.activePermissions).toBe(2);
      expect(result.inheritedPermissions).toBe(1);
      expect(result.directPermissions).toBe(2);
      expect(result.userCount).toBe(2);
      expect(result.permissionsByResource[ResourceType.FLEET]).toBe(2);
      expect(result.permissionsByResource[ResourceType.EVENT]).toBe(1);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
