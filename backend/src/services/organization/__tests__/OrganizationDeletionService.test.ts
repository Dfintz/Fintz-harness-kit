import { AppDataSource } from '../../../data-source';
import { Organization } from '../../../models/Organization';
import { OrganizationActivity } from '../../../models/OrganizationActivity';
import {
  OrganizationDeletionRequest,
  OrgDeletionRequestStatus,
} from '../../../models/OrganizationDeletionRequest';
import { OrganizationRelationship } from '../../../models/OrganizationRelationship';
import { User } from '../../../models/User';
import { OrganizationDeletionService } from '../OrganizationDeletionService';

jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');
jest.mock('../OrganizationArchiveService');
jest.mock('../OrganizationHierarchyService');
jest.mock('../OrganizationActivityService');

describe('OrganizationDeletionService', () => {
  let service: OrganizationDeletionService;
  let mockDeletionRequestRepo: any;
  let mockOrganizationRepo: any;
  let mockMembershipRepo: any;
  let mockShipRepo: any;
  let mockUserRepo: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock repositories
    mockDeletionRequestRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockOrganizationRepo = {
      findOne: jest.fn(),
    };

    mockMembershipRepo = {
      count: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn(),
      })),
    };

    mockShipRepo = {
      count: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn(),
      })),
    };

    mockUserRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === OrganizationDeletionRequest) return mockDeletionRequestRepo;
      if (entity === Organization) return mockOrganizationRepo;
      if (entity === User) return mockUserRepo;
      if (entity.name === 'OrganizationMembership') return mockMembershipRepo;
      if (entity.name === 'OrganizationShip') return mockShipRepo;
      return {};
    });

    service = new OrganizationDeletionService();
  });

  describe('createDeletionRequest', () => {
    it('should create a deletion request successfully', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Organization',
        isArchived: false,
      };

      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.PENDING,
        gracePeriodDays: 30,
        emailVerificationToken: 'test-token-123',
        organization: mockOrg,
        requester: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      mockOrganizationRepo.findOne.mockResolvedValue(mockOrg);
      // First call checks for existing request (returns null), subsequent calls return the saved request
      mockDeletionRequestRepo.findOne
        .mockResolvedValueOnce(null) // First call - no existing request
        .mockResolvedValue(mockRequest); // Subsequent calls - return saved request
      mockDeletionRequestRepo.create.mockReturnValue(mockRequest);
      mockDeletionRequestRepo.save.mockResolvedValue(mockRequest);

      // Mock user repository for email verification
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });

      // Mock query builders for counting
      const mockMemberQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(10),
      };
      const mockShipQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      };
      mockMembershipRepo.createQueryBuilder.mockReturnValue(mockMemberQueryBuilder);
      mockShipRepo.createQueryBuilder.mockReturnValue(mockShipQueryBuilder);

      const result = await service.createDeletionRequest('org-123', 'user-123', {
        reason: 'Test reason',
        deleteDescendants: false,
      });

      expect(result).toBeDefined();
      expect(result.organizationId).toBe('org-123');
      expect(mockOrganizationRepo.findOne).toHaveBeenCalled();
      expect(mockDeletionRequestRepo.save).toHaveBeenCalled();
    });

    it('should throw error if organization not found', async () => {
      mockOrganizationRepo.findOne.mockResolvedValue(null);

      await expect(service.createDeletionRequest('org-123', 'user-123')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should throw error if organization is already archived', async () => {
      mockOrganizationRepo.findOne.mockResolvedValue({
        id: 'org-123',
        isArchived: true,
      });

      await expect(service.createDeletionRequest('org-123', 'user-123')).rejects.toThrow(
        'Organization is already archived'
      );
    });

    it('should throw error if pending request already exists', async () => {
      mockOrganizationRepo.findOne.mockResolvedValue({
        id: 'org-123',
        isArchived: false,
      });
      mockDeletionRequestRepo.findOne.mockResolvedValue({
        id: 'existing-req',
        status: OrgDeletionRequestStatus.PENDING,
      });

      await expect(service.createDeletionRequest('org-123', 'user-123')).rejects.toThrow(
        'A deletion request for this organization is already pending'
      );
    });

    it('should respect grace period bounds', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Organization',
        isArchived: false,
      };

      mockOrganizationRepo.findOne.mockResolvedValue(mockOrg);
      // First call checks for existing request (returns null), subsequent calls return the saved request
      mockDeletionRequestRepo.findOne.mockResolvedValueOnce(null);
      mockDeletionRequestRepo.create.mockImplementation(data => ({
        ...data,
        id: 'req-123',
        emailVerificationToken: 'test-token-123',
        organization: mockOrg,
        requester: { id: 'user-123', email: 'test@example.com' },
      }));
      mockDeletionRequestRepo.save.mockImplementation(data => {
        // After save, mock findOne to return the saved data
        mockDeletionRequestRepo.findOne.mockResolvedValue(data);
        return Promise.resolve(data);
      });

      // Mock user repository for email verification
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });

      // Mock query builders
      const mockMemberQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      const mockShipQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockMembershipRepo.createQueryBuilder.mockReturnValue(mockMemberQueryBuilder);
      mockShipRepo.createQueryBuilder.mockReturnValue(mockShipQueryBuilder);

      // Test with grace period > MAX
      await service.createDeletionRequest('org-123', 'user-123', {
        gracePeriodDays: 100, // Should be clamped to MAX_GRACE_PERIOD_DAYS
      });

      const createCall = mockDeletionRequestRepo.create.mock.calls[0][0];
      expect(createCall.gracePeriodDays).toBeLessThanOrEqual(30);
    });
  });

  describe('approveDeletionRequest', () => {
    it('should approve a pending deletion request', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        status: OrgDeletionRequestStatus.PENDING,
        gracePeriodDays: 30,
        canBeApproved: () => true,
        organization: { id: 'org-123', name: 'Test Org' },
      };

      mockDeletionRequestRepo.findOne.mockResolvedValue(mockRequest);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      const result = await service.approveDeletionRequest('req-123', 'admin-123', {
        notes: 'Approved',
      });

      expect(result.status).toBe(OrgDeletionRequestStatus.APPROVED);
      expect(result.approvedBy).toBe('admin-123');
      expect(result.approvalNotes).toBe('Approved');
      expect(result.scheduledFor).toBeDefined();
    });

    it('should throw error if request not found', async () => {
      mockDeletionRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.approveDeletionRequest('req-123', 'admin-123')).rejects.toThrow(
        'Deletion request not found'
      );
    });

    it('should throw error if request cannot be approved', async () => {
      mockDeletionRequestRepo.findOne.mockResolvedValue({
        id: 'req-123',
        status: OrgDeletionRequestStatus.COMPLETED,
        canBeApproved: () => false,
      });

      await expect(service.approveDeletionRequest('req-123', 'admin-123')).rejects.toThrow(
        'cannot be approved'
      );
    });
  });

  describe('rejectDeletionRequest', () => {
    it('should reject a pending deletion request', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        status: OrgDeletionRequestStatus.PENDING,
        canBeRejected: () => true,
        organization: { id: 'org-123', name: 'Test Org' },
      };

      mockDeletionRequestRepo.findOne.mockResolvedValue(mockRequest);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      const result = await service.rejectDeletionRequest('req-123', 'admin-123', 'Not approved');

      expect(result.status).toBe(OrgDeletionRequestStatus.REJECTED);
      expect(result.rejectedBy).toBe('admin-123');
      expect(result.rejectionReason).toBe('Not approved');
    });

    it('should throw error if request not found', async () => {
      mockDeletionRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.rejectDeletionRequest('req-123', 'admin-123', 'reason')).rejects.toThrow(
        'Deletion request not found'
      );
    });
  });

  describe('cancelDeletionRequest', () => {
    it('should cancel a request during grace period', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        status: OrgDeletionRequestStatus.APPROVED,
        canBeCancelled: () => true,
        organization: { id: 'org-123', name: 'Test Org' },
      };

      mockDeletionRequestRepo.findOne.mockResolvedValue(mockRequest);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      const result = await service.cancelDeletionRequest('req-123', 'user-123', 'Changed mind');

      expect(result.status).toBe(OrgDeletionRequestStatus.CANCELLED);
      expect(result.cancelledBy).toBe('user-123');
      expect(result.cancellationReason).toBe('Changed mind');
    });

    it('should throw error if request cannot be cancelled', async () => {
      mockDeletionRequestRepo.findOne.mockResolvedValue({
        id: 'req-123',
        status: OrgDeletionRequestStatus.COMPLETED,
        canBeCancelled: () => false,
      });

      await expect(service.cancelDeletionRequest('req-123', 'user-123')).rejects.toThrow(
        'cannot be cancelled'
      );
    });
  });

  describe('generateDeletionPreview', () => {
    it('should generate preview with correct counts', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Organization',
      };

      mockOrganizationRepo.findOne.mockResolvedValue(mockOrg);

      // Mock query builders for counting
      const mockMemberQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(15),
      };
      const mockShipQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(8),
      };
      mockMembershipRepo.createQueryBuilder.mockReturnValue(mockMemberQueryBuilder);
      mockShipRepo.createQueryBuilder.mockReturnValue(mockShipQueryBuilder);

      const preview = await service.generateDeletionPreview('org-123', false);

      expect(preview).toBeDefined();
      expect(preview.organizationId).toBe('org-123');
      expect(preview.organizationName).toBe('Test Organization');
      expect(preview.memberCount).toBe(15);
      expect(preview.shipCount).toBe(8);
      expect(preview.willDeleteDescendants).toBe(false);
    });

    it('should throw error if organization not found', async () => {
      mockOrganizationRepo.findOne.mockResolvedValue(null);

      await expect(service.generateDeletionPreview('org-123', false)).rejects.toThrow(
        'Organization not found'
      );
    });
  });

  describe('getPendingRequests', () => {
    it('should return all pending requests', async () => {
      const mockRequests = [
        { id: 'req-1', status: OrgDeletionRequestStatus.PENDING },
        { id: 'req-2', status: OrgDeletionRequestStatus.PENDING },
      ];

      mockDeletionRequestRepo.find.mockResolvedValue(mockRequests);

      const result = await service.getPendingRequests();

      expect(result).toHaveLength(2);
      expect(mockDeletionRequestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: OrgDeletionRequestStatus.PENDING },
        })
      );
    });
  });

  describe('getRequestsReadyForExecution', () => {
    it('should return approved requests past grace period', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: 'req-1', status: OrgDeletionRequestStatus.APPROVED }]),
      };

      mockDeletionRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getRequestsReadyForExecution();

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('generateDataExport', () => {
    beforeEach(() => {
      // Mock Azure Blob Service
      jest.mock('../../cloud/AzureBlobService');

      // Mock nodemailer
      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
      (service as any).emailTransporter = {
        sendMail: mockSendMail,
      };

      // Mock blob service
      (service as any).blobService = {
        isConfigured: jest.fn().mockReturnValue(true),
        uploadImage: jest.fn().mockResolvedValue('https://example.com/blob-url'),
      };
    });

    it('should generate comprehensive data export', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        deleteDescendants: false,
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          description: 'Test Description',
          type: 'ROOT',
          status: 'ACTIVE',
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const mockMembers = [
        {
          userId: 'user-1',
          organizationId: 'org-123',
          role: 'admin',
          title: 'Administrator',
          joinedAt: new Date(),
          permissions: ['manage_org'],
          isActive: true,
        },
      ];

      const mockShips = [
        {
          id: 'ship-1',
          organizationId: 'org-123',
          shipName: 'Test Ship',
          shipType: 'Corvette',
          status: 'active',
          createdAt: new Date(),
        },
      ];

      const mockFleets = [
        {
          id: 'fleet-1',
          organizationId: 'org-123',
          name: 'Test Fleet',
          description: 'Test fleet',
          status: 'active',
          type: 'combat',
          leaderId: 'user-1',
          members: ['user-1'],
          shipIds: ['ship-1'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockTeamMembers = [
        {
          id: 'tm-1',
          organizationId: 'org-123',
          teamId: 'team-1',
          userId: 'user-1',
          role: 'leader',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockTradingRoutes = [
        {
          id: 'route-1',
          organizationId: 'org-123',
          name: 'Test Route',
          description: 'Test trade route',
          creatorId: 'user-1',
          visibility: 'organization',
          stops: [],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockOrgInventory = [
        {
          id: 'inv-1',
          organizationId: 'org-123',
          itemName: 'Quantum Fuel',
          category: 'commodities',
          quantity: 1000,
          unit: 'liters',
          unitValue: 1.5,
          totalValue: 1500,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockFleetInventory = [
        {
          id: 'fi-1',
          organizationId: 'org-123',
          fleetId: 'fleet-1',
          itemName: 'Medical Supplies',
          category: 'medical',
          quantity: 50,
          unit: 'units',
          thresholds: { criticalLevel: 10, lowLevel: 20, targetLevel: 50, maxLevel: 100 },
          status: 'adequate',
          managerId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockOrganizationRepo.findOne.mockResolvedValue(mockRequest.organization);
      mockMembershipRepo.find.mockResolvedValue(mockMembers);
      mockShipRepo.find.mockResolvedValue(mockShips);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      // Mock User repository for email
      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
        }),
      };

      // Mock additional repositories
      const mockFleetRepo = { find: jest.fn().mockResolvedValue(mockFleets) };
      const mockTeamMemberRepo = { find: jest.fn().mockResolvedValue(mockTeamMembers) };
      const mockTradingRouteRepo = { find: jest.fn().mockResolvedValue(mockTradingRoutes) };
      const mockOrgInventoryRepo = { find: jest.fn().mockResolvedValue(mockOrgInventory) };
      const mockFleetInventoryRepo = { find: jest.fn().mockResolvedValue(mockFleetInventory) };

      (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
        if (entity === User) return mockUserRepo;
        if (entity.name === 'Fleet') return mockFleetRepo;
        if (entity.name === 'TeamMember') return mockTeamMemberRepo;
        if (entity.name === 'TradingRoute') return mockTradingRouteRepo;
        if (entity.name === 'OrganizationInventory') return mockOrgInventoryRepo;
        if (entity.name === 'FleetInventory') return mockFleetInventoryRepo;
        if (entity === OrganizationActivity) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === OrganizationRelationship) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === Organization) return mockOrganizationRepo;
        if (entity === OrganizationDeletionRequest) return mockDeletionRequestRepo;
        return mockMembershipRepo;
      });

      const result = await service.generateDataExport(mockRequest as any);

      expect(result).toBeDefined();
      expect(result).toContain('exports/org-');
      expect(mockDeletionRequestRepo.save).toHaveBeenCalled();
      expect((service as any).blobService.uploadImage).toHaveBeenCalled();

      // Verify that all new data types are being fetched
      expect(mockFleetRepo.find).toHaveBeenCalled();
      expect(mockTeamMemberRepo.find).toHaveBeenCalled();
      expect(mockTradingRouteRepo.find).toHaveBeenCalled();
      expect(mockOrgInventoryRepo.find).toHaveBeenCalled();
      expect(mockFleetInventoryRepo.find).toHaveBeenCalled();
    });

    it('should handle export generation with descendants', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        deleteDescendants: true,
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          description: 'Test Description',
          type: 'ROOT',
          status: 'ACTIVE',
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockOrganizationRepo.findOne.mockResolvedValue(mockRequest.organization);
      mockMembershipRepo.find.mockResolvedValue([]);
      mockShipRepo.find.mockResolvedValue([]);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      // Mock descendants
      (service as any).hierarchyService.getDescendants = jest
        .fn()
        .mockResolvedValue([{ id: 'child-1', name: 'Child Org', type: 'DIVISION' }]);

      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
        }),
      };
      (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
        if (entity === User) return mockUserRepo;
        if (entity === OrganizationActivity) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === OrganizationRelationship) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === Organization) return mockOrganizationRepo;
        if (entity === OrganizationDeletionRequest) return mockDeletionRequestRepo;
        return mockMembershipRepo;
      });

      const result = await service.generateDataExport(mockRequest as any);

      expect(result).toBeDefined();
      expect((service as any).hierarchyService.getDescendants).toHaveBeenCalledWith('org-123');
    });

    it('should throw error if organization not found', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        organization: null,
      };

      mockOrganizationRepo.findOne.mockResolvedValue(null);

      await expect(service.generateDataExport(mockRequest as any)).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should throw error if blob storage not configured', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        organization: {
          id: 'org-123',
          name: 'Test Organization',
        },
      };

      mockOrganizationRepo.findOne.mockResolvedValue(mockRequest.organization);
      mockMembershipRepo.find.mockResolvedValue([]);
      mockShipRepo.find.mockResolvedValue([]);

      // Mock blob service as not configured
      (service as any).blobService = {
        isConfigured: jest.fn().mockReturnValue(false),
        uploadImage: jest.fn(),
      };

      (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
        if (entity === OrganizationActivity) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === OrganizationRelationship) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === Organization) return mockOrganizationRepo;
        if (entity.name === 'Fleet') return { find: jest.fn().mockResolvedValue([]) };
        if (entity.name === 'FleetMember') return { find: jest.fn().mockResolvedValue([]) };
        if (entity.name === 'TradingRoute') return { find: jest.fn().mockResolvedValue([]) };
        if (entity.name === 'OrganizationInventory')
          return { find: jest.fn().mockResolvedValue([]) };
        if (entity.name === 'FleetInventory') return { find: jest.fn().mockResolvedValue([]) };
        if (entity.name === 'OrganizationMembership') return mockMembershipRepo;
        if (entity.name === 'OrganizationShip') return mockShipRepo;
        if (entity === User) return mockUserRepo;
        // Default mock for any other repository
        return { find: jest.fn().mockResolvedValue([]) };
      });

      mockUserRepo.find.mockResolvedValue([]);

      await expect(service.generateDataExport(mockRequest as any)).rejects.toThrow(
        'Azure Blob Storage is not configured'
      );
    }, 15000); // Increase timeout to 15 seconds

    it('should handle email notification failure gracefully', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockOrganizationRepo.findOne.mockResolvedValue(mockRequest.organization);
      mockMembershipRepo.find.mockResolvedValue([]);
      mockShipRepo.find.mockResolvedValue([]);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      // Mock email transporter to fail
      const mockSendMail = jest.fn().mockRejectedValue(new Error('Email send failed'));
      (service as any).emailTransporter = {
        sendMail: mockSendMail,
      };

      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
        }),
      };
      (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
        if (entity === User) return mockUserRepo;
        if (entity === OrganizationActivity) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === OrganizationRelationship) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === Organization) return mockOrganizationRepo;
        if (entity === OrganizationDeletionRequest) return mockDeletionRequestRepo;
        return mockMembershipRepo;
      });

      // Should not throw despite email failure
      const result = await service.generateDataExport(mockRequest as any);
      expect(result).toBeDefined();
    });

    it('should skip email if transporter not configured', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockOrganizationRepo.findOne.mockResolvedValue(mockRequest.organization);
      mockMembershipRepo.find.mockResolvedValue([]);
      mockShipRepo.find.mockResolvedValue([]);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      // No email transporter
      (service as any).emailTransporter = null;

      (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
        if (entity === OrganizationActivity) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === OrganizationRelationship) return { find: jest.fn().mockResolvedValue([]) };
        if (entity === Organization) return mockOrganizationRepo;
        if (entity === OrganizationDeletionRequest) return mockDeletionRequestRepo;
        return mockMembershipRepo;
      });

      const result = await service.generateDataExport(mockRequest as any);
      expect(result).toBeDefined();
    });
  });

  describe('trackExportDownload', () => {
    it('should track export download and increment count', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        dataExportGenerated: true,
        exportFilePath: 'exports/org-123-req-123-1234567890.json.enc',
        exportDownloadCount: 5,
      };

      mockDeletionRequestRepo.findOne.mockResolvedValue(mockRequest);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      await service.trackExportDownload('req-123');

      expect(mockDeletionRequestRepo.save).toHaveBeenCalled();
      const savedRequest = mockDeletionRequestRepo.save.mock.calls[0][0];
      expect(savedRequest.exportDownloadCount).toBe(6);
      expect(savedRequest.exportLastDownloadedAt).toBeDefined();
    });

    it('should throw error if request not found', async () => {
      mockDeletionRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.trackExportDownload('req-123')).rejects.toThrow(
        'Deletion request not found'
      );
    });

    it('should throw error if no export available', async () => {
      const mockRequest = {
        id: 'req-123',
        dataExportGenerated: false,
        exportFilePath: null,
      };

      mockDeletionRequestRepo.findOne.mockResolvedValue(mockRequest);

      await expect(service.trackExportDownload('req-123')).rejects.toThrow(
        'No export available for this request'
      );
    });

    it('should initialize download count if undefined', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        dataExportGenerated: true,
        exportFilePath: 'exports/test.json.enc',
        exportDownloadCount: undefined,
      };

      mockDeletionRequestRepo.findOne.mockResolvedValue(mockRequest);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      await service.trackExportDownload('req-123');

      const savedRequest = mockDeletionRequestRepo.save.mock.calls[0][0];
      expect(savedRequest.exportDownloadCount).toBe(1);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

