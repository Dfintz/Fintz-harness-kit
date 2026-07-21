// Import entities first to use them in mock setup
import { AccountPermission } from '../../models/AccountPermission';
import { OrganizationMembership } from '../../models/OrganizationMembership';

// Mock AppDataSource before any imports that use it
const mockPermissionRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUserOrgRepository = {
  findOne: jest.fn(),
};

// Use a Map for more robust entity-to-repository mapping
const repositoryMap = new Map<Function, any>([
  [AccountPermission, mockPermissionRepository],
  [OrganizationMembership, mockUserOrgRepository],
]);

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: any) => {
      // Check the entity constructor directly using the Map
      const repository = repositoryMap.get(entity);
      if (repository) {
        return repository;
      }
      // Return a default mock repository for unmapped entities
      return {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        delete: jest.fn(),
        createQueryBuilder: jest.fn(),
      };
    }),
  },
}));

// Import after mocks are set up
import { AccountPermissionService } from '../../services/security';

describe('AccountPermissionService', () => {
  let service: AccountPermissionService;

  beforeEach(() => {
    // Clear mock call history
    jest.clearAllMocks();

    // Reset mock implementations
    mockPermissionRepository.create.mockImplementation(data => data);
    mockPermissionRepository.save.mockImplementation(data => Promise.resolve(data));
    mockPermissionRepository.find.mockResolvedValue([]);
    mockPermissionRepository.findOne.mockResolvedValue(null);
    mockPermissionRepository.delete.mockResolvedValue({ affected: 0 });
    mockPermissionRepository.createQueryBuilder.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });

    mockUserOrgRepository.findOne.mockResolvedValue(null);

    service = new AccountPermissionService();
  });

  describe('hasPermission', () => {
    it('should return false if user is not in organization', async () => {
      mockUserOrgRepository.findOne.mockResolvedValue(null);

      const result = await service.hasPermission('user-1', 'org-1', 'read');

      expect(result).toBe(false);
    });

    it('should return true if user is admin', async () => {
      mockUserOrgRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'admin',
      });

      const result = await service.hasPermission('user-1', 'org-1', 'read');

      expect(result).toBe(true);
    });

    it('should return true if user is owner', async () => {
      mockUserOrgRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'owner',
      });

      const result = await service.hasPermission('user-1', 'org-1', 'delete');

      expect(result).toBe(true);
    });

    it('should check specific permission for regular member', async () => {
      mockUserOrgRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
      });

      mockPermissionRepository.findOne.mockResolvedValue({
        id: 'perm-1',
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'read',
        granted: true,
        expiresAt: null,
      });

      const result = await service.hasPermission('user-1', 'org-1', 'read');

      expect(result).toBe(true);
    });

    it('should return false for expired permission', async () => {
      mockUserOrgRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockPermissionRepository.findOne.mockResolvedValue({
        id: 'perm-1',
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'read',
        granted: true,
        expiresAt: yesterday,
      });

      const result = await service.hasPermission('user-1', 'org-1', 'read');

      expect(result).toBe(false);
    });
  });

  describe('grantPermission', () => {
    it('should create and save a new permission', async () => {
      const mockPermission = {
        id: 'perm-1',
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'read',
        granted: true,
        grantedBy: 'admin-1',
      };

      mockPermissionRepository.create.mockReturnValue(mockPermission);
      mockPermissionRepository.save.mockResolvedValue(mockPermission);

      const result = await service.grantPermission('user-1', 'org-1', 'read', 'admin-1');

      expect(mockPermissionRepository.create).toHaveBeenCalled();
      expect(mockPermissionRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockPermission);
    });

    it('should handle permission with expiration', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mockPermission = {
        id: 'perm-1',
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'read',
        granted: true,
        grantedBy: 'admin-1',
        expiresAt: tomorrow,
      };

      mockPermissionRepository.create.mockReturnValue(mockPermission);
      mockPermissionRepository.save.mockResolvedValue(mockPermission);

      const result = await service.grantPermission(
        'user-1',
        'org-1',
        'read',
        'admin-1',
        undefined,
        tomorrow
      );

      expect(result?.expiresAt).toEqual(tomorrow);
    });
  });

  describe('revokePermission', () => {
    it('should delete permission by id', async () => {
      mockPermissionRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.revokePermission('perm-1');

      expect(mockPermissionRepository.delete).toHaveBeenCalledWith('perm-1');
      expect(result).toBe(true);
    });

    it('should return false if permission not found', async () => {
      mockPermissionRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.revokePermission('perm-1');

      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all granted permissions for user in org', async () => {
      const mockPermissions = [
        { id: 'perm-1', action: 'read', granted: true },
        { id: 'perm-2', action: 'update', granted: true },
      ];

      mockPermissionRepository.find.mockResolvedValue(mockPermissions);

      const result = await service.getUserPermissions('user-1', 'org-1');

      expect(mockPermissionRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', organizationId: 'org-1', granted: true },
      });
      expect(result).toEqual(mockPermissions);
    });
  });

  describe('cleanupExpiredPermissions', () => {
    it('should delete expired permissions', async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      mockPermissionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.cleanupExpiredPermissions();

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
