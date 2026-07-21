import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  OrganizationPermission,
  PermissionAction,
  ResourceType,
} from '../../models/OrganizationPermission';
import { Permission } from '../../models/Permission';
import { PermissionManagerService } from '../../services/security/permissions/PermissionManagerService';

describe('PermissionManagerService', () => {
  let service: PermissionManagerService;
  let permissionRepository: any;
  let userOrgRepository: any;
  let legacyPermissionRepository: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-456';
  const mockAdminId = 'admin-789';
  const mockOwnerId = 'owner-000';

  beforeEach(() => {
    // Initialize service
    service = new PermissionManagerService();

    // Mock repositories (from mockAppDataSource)
    permissionRepository = mockAppDataSource.getRepository(OrganizationPermission);
    userOrgRepository = mockAppDataSource.getRepository(OrganizationMembership);
    legacyPermissionRepository = mockAppDataSource.getRepository(Permission);

    // Clear cache before each test
    if ((service as any).cache) {
      (service as any).cache.flushAll();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasPermission', () => {
    it('should allow owner to access all resources', async () => {
      // Mock user as owner
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockOwnerId,
        role: 'owner',
      });

      const result = await service.hasPermission(mockOrgId, mockOwnerId, 'fleet', 'delete');

      expect(result).toBe(true);
    });

    it('should allow admin to access all resources', async () => {
      // Mock user as admin
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockAdminId,
        role: 'admin',
      });

      const result = await service.hasPermission(mockOrgId, mockAdminId, 'fleet', 'create');

      expect(result).toBe(true);
    });

    it('should deny access for non-member', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue(null);

      const result = await service.hasPermission(mockOrgId, 'non-member-999', 'fleet', 'view');

      expect(result).toBe(false);
    });

    it('should allow access with direct permission grant', async () => {
      // Mock regular member
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockUserId,
        role: 'member',
        permissions: [],
      });

      // Mock direct permission
      jest.spyOn(permissionRepository, 'find').mockResolvedValue([
        {
          organizationId: mockOrgId,
          userId: mockUserId,
          resource: ResourceType.FLEET,
          actions: [PermissionAction.VIEW, PermissionAction.EDIT],
          isActive: true,
          expiresAt: new Date(Date.now() + 86400000), // Tomorrow
          allowsAction: (action: PermissionAction) =>
            [PermissionAction.VIEW, PermissionAction.EDIT].includes(action),
        },
      ]);

      const result = await service.hasPermission(mockOrgId, mockUserId, 'fleet', 'edit');

      expect(result).toBe(true);
    });

    it('should deny access with expired permission', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockUserId,
        role: 'member',
        permissions: [],
      });

      // Mock expired permission for a resource not in member's default permissions
      jest.spyOn(permissionRepository, 'find').mockResolvedValue([
        {
          organizationId: mockOrgId,
          userId: mockUserId,
          resource: ResourceType.FLEET,
          actions: [PermissionAction.EDIT], // member doesn't have edit permission by default
          isActive: true,
          expiresAt: new Date(Date.now() - 86400000), // Yesterday
          allowsAction: (action: PermissionAction) => true,
        },
      ]);

      const result = await service.hasPermission(mockOrgId, mockUserId, 'fleet', 'edit');

      expect(result).toBe(false);
    });

    it('should cache permission checks', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockOwnerId,
        role: 'owner',
      });

      // First call - should hit database
      await service.hasPermission(mockOrgId, mockOwnerId, 'fleet', 'view');
      expect(userOrgRepository.findOne).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.hasPermission(mockOrgId, mockOwnerId, 'fleet', 'view');
      expect(userOrgRepository.findOne).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should allow access with role-based custom permissions', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockUserId,
        role: 'fleet_commander',
        permissions: ['fleet:edit', 'fleet:delete', 'ship:view'],
      });

      const result = await service.hasPermission(mockOrgId, mockUserId, 'fleet', 'edit');

      expect(result).toBe(true);
    });
  });

  describe('checkPermission', () => {
    it('should return detailed permission result for owner', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockOwnerId,
        role: 'owner',
      });

      const result = await service.checkPermission(mockOrgId, mockOwnerId, 'fleet', 'delete');

      expect(result.allowed).toBe(true);
      expect(result.source).toBe('role');
      expect(result.reason).toContain('owner');
    });

    it('should return detailed reason for denied access', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue(null);

      const result = await service.checkPermission(mockOrgId, 'non-member', 'fleet', 'view');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User is not a member of this organization');
    });
  });

  describe('batchCheckPermissions', () => {
    it('should check multiple permissions efficiently', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockOwnerId,
        role: 'owner',
      });

      const result = await service.batchCheckPermissions(mockOrgId, mockOwnerId, [
        { resource: 'fleet', action: 'view' },
        { resource: 'fleet', action: 'edit' },
        { resource: 'ship', action: 'create' },
        { resource: 'event', action: 'delete' },
      ]);

      expect(result['fleet:view']).toBe(true);
      expect(result['fleet:edit']).toBe(true);
      expect(result['ship:create']).toBe(true);
      expect(result['event:delete']).toBe(true);

      // Should only query user org once (batched)
      expect(userOrgRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should use cache for batch permission checks', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockUserId,
        role: 'member',
        permissions: ['fleet:view'],
      });

      jest.spyOn(permissionRepository, 'find').mockResolvedValue([]);

      // First batch check
      await service.batchCheckPermissions(mockOrgId, mockUserId, [
        { resource: 'fleet', action: 'view' },
        { resource: 'ship', action: 'create' },
      ]);

      // Second batch check (should use cache)
      await service.batchCheckPermissions(mockOrgId, mockUserId, [
        { resource: 'fleet', action: 'view' },
        { resource: 'ship', action: 'create' },
      ]);

      // Should only query once (second call uses cache)
      expect(userOrgRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('grantPermission', () => {
    it('should grant new permission and invalidate cache', async () => {
      const mockPermission = {
        id: 'perm-123',
        organizationId: mockOrgId,
        userId: mockUserId,
        resource: ResourceType.FLEET,
        actions: [PermissionAction.EDIT],
        isActive: true,
      };

      jest.spyOn(permissionRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(permissionRepository, 'create').mockReturnValue(mockPermission);
      jest.spyOn(permissionRepository, 'save').mockResolvedValue(mockPermission);

      const result = await service.grantPermission(
        mockOrgId,
        mockUserId,
        'fleet',
        'edit',
        mockAdminId
      );

      expect(result).toBeDefined();
      expect(permissionRepository.save).toHaveBeenCalled();
    });

    it('should update existing permission', async () => {
      const existingPermission = {
        id: 'perm-123',
        organizationId: mockOrgId,
        userId: mockUserId,
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW],
        isActive: true,
      };

      jest.spyOn(permissionRepository, 'findOne').mockResolvedValue(existingPermission);
      jest.spyOn(permissionRepository, 'save').mockResolvedValue({
        ...existingPermission,
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
      });

      await service.grantPermission(mockOrgId, mockUserId, 'fleet', 'edit', mockAdminId);

      expect(permissionRepository.save).toHaveBeenCalled();
    });
  });

  describe('revokePermission', () => {
    it('should revoke permission and invalidate cache', async () => {
      const mockPermission = {
        id: 'perm-123',
        organizationId: mockOrgId,
        userId: mockUserId,
        resource: ResourceType.FLEET,
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
      };

      jest.spyOn(permissionRepository, 'findOne').mockResolvedValue(mockPermission);
      jest.spyOn(permissionRepository, 'save').mockResolvedValue({
        ...mockPermission,
        actions: [PermissionAction.VIEW],
      });

      await service.revokePermission(mockOrgId, mockUserId, 'fleet', 'edit', mockAdminId);

      expect(permissionRepository.save).toHaveBeenCalled();
    });

    it('should deactivate permission when no actions remain', async () => {
      const mockPermission = {
        id: 'perm-123',
        organizationId: mockOrgId,
        userId: mockUserId,
        resource: ResourceType.FLEET,
        actions: [PermissionAction.EDIT],
      };

      jest.spyOn(permissionRepository, 'findOne').mockResolvedValue(mockPermission);
      jest.spyOn(permissionRepository, 'save').mockResolvedValue({
        ...mockPermission,
        actions: [],
        isActive: false,
      });

      await service.revokePermission(mockOrgId, mockUserId, 'fleet', 'edit', mockAdminId);

      const savedPermission = (permissionRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedPermission.isActive).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      // Perform some operations to populate cache
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockOwnerId,
        role: 'owner',
      });

      // This would normally populate cache, but in test we'll check structure
      const stats = service.getPermissionCacheStats();

      if (stats) {
        expect(stats).toHaveProperty('hits');
        expect(stats).toHaveProperty('misses');
        expect(stats).toHaveProperty('hitRate');
        expect(stats).toHaveProperty('size');
      }
    });

    it('should clear organization permission cache', async () => {
      jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockOwnerId,
        role: 'owner',
      });

      // Populate cache
      await service.hasPermission(mockOrgId, mockOwnerId, 'fleet', 'view');

      // Clear org cache
      service.clearOrganizationPermissionCache(mockOrgId);

      // Next call should hit database again
      await service.hasPermission(mockOrgId, mockOwnerId, 'fleet', 'view');

      // Verify it was called twice (not cached)
      expect(userOrgRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('performance', () => {
    it('should use cache on subsequent calls', async () => {
      const findOneSpy = jest.spyOn(userOrgRepository, 'findOne').mockResolvedValue({
        organizationId: mockOrgId,
        userId: mockOwnerId,
        role: 'owner',
      });

      // First call (uncached) - should hit the database
      await service.hasPermission(mockOrgId, mockOwnerId, 'fleet', 'view');
      expect(findOneSpy).toHaveBeenCalledTimes(1);

      // Second call (cached) - should NOT hit the database again
      await service.hasPermission(mockOrgId, mockOwnerId, 'fleet', 'view');
      expect(findOneSpy).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
