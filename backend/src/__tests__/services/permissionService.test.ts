import { AppDataSource } from '../../config/database';
import { PermissionService } from '../../services/security';

// Mock the database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

// Mock audit logger
jest.mock('../../utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEventType: {
    SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS',
  },
}));

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let mockPermissionRepo: any;
  let mockUserOrgRepo: any;
  let mockSecurityLevelRepo: any;

  beforeEach(() => {
    mockPermissionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockUserOrgRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    mockSecurityLevelRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity.name === 'Permission') {
        return mockPermissionRepo;
      }
      if (entity.name === 'OrganizationMembership') {
        return mockUserOrgRepo;
      }
      if (entity.name === 'SecurityLevel') {
        return mockSecurityLevelRepo;
      }
      return {};
    });

    permissionService = new PermissionService();
  });

  describe('hasPermission', () => {
    it('should return true when explicit permission exists', async () => {
      mockPermissionRepo.findOne.mockResolvedValue({
        granted: true,
        expiresAt: null,
      });

      const result = await permissionService.hasPermission('user1', 'org1', 'events', 'read');

      expect(result).toBe(true);
    });

    it('should return false when permission has expired', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockPermissionRepo.findOne.mockResolvedValue({
        granted: true,
        expiresAt: yesterday,
      });

      const result = await permissionService.hasPermission('user1', 'org1', 'events', 'read');

      expect(result).toBe(false);
    });

    it('should return true for owners', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);
      mockUserOrgRepo.findOne.mockResolvedValue({
        role: 'owner',
        securityLevel: 5,
      });

      const result = await permissionService.hasPermission('user1', 'org1', 'events', 'read');

      expect(result).toBe(true);
    });

    it('should return true for admins', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);
      mockUserOrgRepo.findOne.mockResolvedValue({
        role: 'admin',
        securityLevel: 4,
      });

      const result = await permissionService.hasPermission('user1', 'org1', 'events', 'read');

      expect(result).toBe(true);
    });

    it('should check custom permissions for regular members', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);
      mockUserOrgRepo.findOne.mockResolvedValue({
        role: 'member',
        securityLevel: 1,
        permissions: ['events:read', 'ships:view'],
      });

      const result = await permissionService.hasPermission('user1', 'org1', 'events', 'read');

      expect(result).toBe(true);
    });

    it('should return false when no permission found', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);
      mockUserOrgRepo.findOne.mockResolvedValue({
        role: 'member',
        securityLevel: 1,
        permissions: [],
      });

      const result = await permissionService.hasPermission('user1', 'org1', 'events', 'delete');

      expect(result).toBe(false);
    });
  });

  describe('grantPermission', () => {
    it('should create new permission when none exists', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);
      const newPermission = {
        userId: 'user1',
        organizationId: 'org1',
        resource: 'events',
        action: 'create',
        granted: true,
        grantedBy: 'admin1',
      };
      mockPermissionRepo.create.mockReturnValue(newPermission);
      mockPermissionRepo.save.mockResolvedValue({ ...newPermission, id: 'perm1' });

      const result = await permissionService.grantPermission(
        'user1',
        'org1',
        'events',
        'create',
        'admin1'
      );

      expect(mockPermissionRepo.create).toHaveBeenCalled();
      expect(mockPermissionRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('perm1');
    });

    it('should update existing permission', async () => {
      const existingPermission = {
        userId: 'user1',
        organizationId: 'org1',
        resource: 'events',
        action: 'create',
        granted: false,
      };
      mockPermissionRepo.findOne.mockResolvedValue(existingPermission);
      mockPermissionRepo.save.mockResolvedValue({ ...existingPermission, granted: true });

      await permissionService.grantPermission('user1', 'org1', 'events', 'create', 'admin1');

      expect(mockPermissionRepo.save).toHaveBeenCalled();
      expect(existingPermission.granted).toBe(true);
    });
  });

  describe('updateSecurityLevel', () => {
    it('should update security level for user', async () => {
      const userOrg = {
        userId: 'user1',
        organizationId: 'org1',
        securityLevel: 1,
      };
      mockUserOrgRepo.findOne.mockResolvedValue(userOrg);
      mockUserOrgRepo.save.mockResolvedValue({ ...userOrg, securityLevel: 3 });

      const result = await permissionService.updateSecurityLevel('user1', 'org1', 3, 'admin1');

      expect(result.securityLevel).toBe(3);
      expect(mockUserOrgRepo.save).toHaveBeenCalled();
    });

    it('should throw error for invalid security level', async () => {
      mockUserOrgRepo.findOne.mockResolvedValue({
        userId: 'user1',
        organizationId: 'org1',
        securityLevel: 1,
      });

      await expect(
        permissionService.updateSecurityLevel('user1', 'org1', 6, 'admin1')
      ).rejects.toThrow('Security level must be between 1 and 5');
    });

    it('should throw error when user not in organization', async () => {
      mockUserOrgRepo.findOne.mockResolvedValue(null);

      await expect(
        permissionService.updateSecurityLevel('user1', 'org1', 3, 'admin1')
      ).rejects.toThrow('User is not a member of this organization');
    });
  });

  describe('hasInterOrgAccess', () => {
    it('should return true when access level is sufficient', async () => {
      mockSecurityLevelRepo.findOne.mockResolvedValue({
        fromOrganizationId: 'org1',
        toOrganizationId: 'org2',
        resourceType: 'events',
        accessLevel: 'write',
        level: 3,
        grantsAccess: jest.fn().mockReturnValue(true),
      });

      const result = await permissionService.hasInterOrgAccess('org1', 'org2', 'events', 'read');

      expect(result).toBe(true);
    });

    it('should return false when access level is insufficient', async () => {
      mockSecurityLevelRepo.findOne.mockResolvedValue({
        fromOrganizationId: 'org1',
        toOrganizationId: 'org2',
        resourceType: 'events',
        accessLevel: 'read',
        level: 2,
        grantsAccess: jest.fn().mockReturnValue(false),
      });

      const result = await permissionService.hasInterOrgAccess('org1', 'org2', 'events', 'write');

      expect(result).toBe(false);
    });

    it('should return false when no security level exists', async () => {
      mockSecurityLevelRepo.findOne.mockResolvedValue(null);

      const result = await permissionService.hasInterOrgAccess('org1', 'org2', 'events', 'read');

      expect(result).toBe(false);
    });
  });

  describe('setInterOrgSecurityLevel', () => {
    it('should create new security level when none exists', async () => {
      mockSecurityLevelRepo.findOne.mockResolvedValue(null);
      const newLevel = {
        fromOrganizationId: 'org1',
        toOrganizationId: 'org2',
        level: 3,
        resourceType: 'events',
        accessLevel: 'read',
        approvedBy: 'admin1',
      };
      mockSecurityLevelRepo.create.mockReturnValue(newLevel);
      mockSecurityLevelRepo.save.mockResolvedValue({ ...newLevel, id: 'level1' });

      const result = await permissionService.setInterOrgSecurityLevel(
        'org1',
        'org2',
        3,
        'events',
        'read',
        'admin1'
      );

      expect(mockSecurityLevelRepo.create).toHaveBeenCalled();
      expect(result.id).toBe('level1');
    });

    it('should update existing security level', async () => {
      const existingLevel = {
        fromOrganizationId: 'org1',
        toOrganizationId: 'org2',
        level: 2,
        resourceType: 'events',
        accessLevel: 'read',
      };
      mockSecurityLevelRepo.findOne.mockResolvedValue(existingLevel);
      mockSecurityLevelRepo.save.mockResolvedValue({
        ...existingLevel,
        level: 4,
        accessLevel: 'write',
      });

      await permissionService.setInterOrgSecurityLevel(
        'org1',
        'org2',
        4,
        'events',
        'write',
        'admin1'
      );

      expect(mockSecurityLevelRepo.save).toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
