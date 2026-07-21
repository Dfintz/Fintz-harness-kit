import {
  ContactRequest,
  ContactRequestStatus,
  ContactTargetType,
  MessageVisibility,
} from '../../models/ContactRequest';
import { ActivityLevel, OrgPrimaryFocus, PublicOrgProfile } from '../../models/PublicOrgProfile';
import {
  ContactRequestFilterOptions,
  ContactRequestService,
  CreateContactRequestInput,
} from '../../services/organization/ContactRequestService';
import { ApiError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';

// Mock the database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

// Mock the OrganizationFederationService
jest.mock('../../services/organization/OrganizationFederationService', () => ({
  OrganizationFederationService: {
    getInstance: jest.fn().mockReturnValue({
      getPublicFederation: jest.fn(),
    }),
  },
}));

import { AppDataSource } from '../../config/database';
import { OrganizationFederationService } from '../../services/organization/OrganizationFederationService';

describe('ContactRequestService', () => {
  let service: ContactRequestService;
  let mockContactRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    find: jest.Mock;
  };
  let mockProfileRepository: {
    findOne: jest.Mock;
  };
  let mockFederationService: {
    getPublicFederation: jest.Mock;
  };

  const mockPublicProfile = {
    id: 'profile-123',
    organizationId: 'org-123',
    isPublic: true,
    primaryFocus: OrgPrimaryFocus.COMBAT,
    activityLevel: ActivityLevel.HIGH,
    memberCount: 50,
    isVerified: true,
    isRecruiting: true,
  } as PublicOrgProfile;

  const mockContactRequest = {
    id: 'contact-123',
    targetType: ContactTargetType.ORGANIZATION,
    organizationId: 'org-123',
    allianceId: null,
    senderName: 'John Doe',
    senderEmail: 'john@example.com',
    rsiHandle: 'JohnDoe',
    discordUsername: 'johndoe#1234',
    subject: 'Interested in joining',
    message: 'Hello, I am interested in joining your organization.',
    contactType: 'recruitment',
    status: ContactRequestStatus.PENDING,
    internalNotes: null,
    handledBy: null,
    handledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ContactRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContactRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      find: jest.fn(),
    };

    mockProfileRepository = {
      findOne: jest.fn(),
    };

    mockFederationService = {
      getPublicFederation: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === ContactRequest) {
        return mockContactRepository;
      }
      if (entity === PublicOrgProfile) {
        return mockProfileRepository;
      }
      return {};
    });

    (OrganizationFederationService.getInstance as jest.Mock).mockReturnValue(mockFederationService);

    service = new ContactRequestService();
  });

  describe('submitContactRequest', () => {
    it('should create a contact request for an organization', async () => {
      mockProfileRepository.findOne.mockResolvedValue(mockPublicProfile);
      mockContactRepository.create.mockReturnValue(mockContactRequest);
      mockContactRepository.save.mockResolvedValue(mockContactRequest);

      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ORGANIZATION,
        organizationId: 'org-123',
        senderName: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Interested in joining',
        message: 'Hello, I am interested in joining your organization.',
        contactType: 'recruitment',
      };

      const result = await service.submitContactRequest(input);

      expect(result).toEqual(mockContactRequest);
      expect(mockProfileRepository.findOne).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', isPublic: true },
      });
      expect(mockContactRepository.create).toHaveBeenCalled();
      expect(mockContactRepository.save).toHaveBeenCalled();
    });

    it('should create a contact request for an alliance', async () => {
      mockFederationService.getPublicFederation.mockResolvedValue({
        id: 'alliance-123',
        name: 'Test Alliance',
      });
      mockContactRepository.create.mockReturnValue({
        ...mockContactRequest,
        targetType: ContactTargetType.ALLIANCE,
        organizationId: null,
        allianceId: 'alliance-123',
      });
      mockContactRepository.save.mockResolvedValue({
        ...mockContactRequest,
        targetType: ContactTargetType.ALLIANCE,
        organizationId: null,
        allianceId: 'alliance-123',
      });

      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ALLIANCE,
        allianceId: 'alliance-123',
        senderName: 'Jane Doe',
        senderEmail: 'jane@example.com',
        subject: 'Partnership inquiry',
        message: 'We would like to discuss a partnership with your alliance.',
      };

      const result = await service.submitContactRequest(input);

      expect(result.targetType).toBe(ContactTargetType.ALLIANCE);
      expect(mockFederationService.getPublicFederation).toHaveBeenCalledWith('alliance-123');
    });

    it('should throw error when organization not found', async () => {
      mockProfileRepository.findOne.mockResolvedValue(null);

      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ORGANIZATION,
        organizationId: 'nonexistent',
        senderName: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test',
        message: 'Test message',
      };

      await expect(service.submitContactRequest(input)).rejects.toThrow(
        'Organization not found or not accepting public contact requests'
      );

      const error = await service.submitContactRequest(input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(404);
    });

    it('should throw error when alliance not found', async () => {
      mockFederationService.getPublicFederation.mockResolvedValue(null);

      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ALLIANCE,
        allianceId: 'nonexistent',
        senderName: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test',
        message: 'Test message',
      };

      await expect(service.submitContactRequest(input)).rejects.toThrow(
        'Alliance not found or not accepting public contact requests'
      );

      const error = await service.submitContactRequest(input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(404);
    });

    it('should throw error when organization ID missing for org type', async () => {
      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ORGANIZATION,
        senderName: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test',
        message: 'Test message',
      };

      await expect(service.submitContactRequest(input)).rejects.toThrow(
        'Organization ID is required'
      );

      const error = await service.submitContactRequest(input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('should throw error when alliance ID missing for alliance type', async () => {
      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ALLIANCE,
        senderName: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test',
        message: 'Test message',
      };

      await expect(service.submitContactRequest(input)).rejects.toThrow('Alliance ID is required');

      const error = await service.submitContactRequest(input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('should default visibility to MessageVisibility.ALL when not provided', async () => {
      mockProfileRepository.findOne.mockResolvedValue(mockPublicProfile);
      const createdRequest = { ...mockContactRequest, visibility: MessageVisibility.ALL };
      mockContactRepository.create.mockReturnValue(createdRequest);
      mockContactRepository.save.mockResolvedValue(createdRequest);

      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ORGANIZATION,
        organizationId: 'org-123',
        senderName: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Test',
        message: 'Test message',
      };

      await service.submitContactRequest(input);

      expect(mockContactRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: MessageVisibility.ALL,
        })
      );
    });

    it('should persist custom visibility when provided', async () => {
      mockProfileRepository.findOne.mockResolvedValue(mockPublicProfile);
      const createdRequest = {
        ...mockContactRequest,
        visibility: MessageVisibility.LEADERSHIP,
      };
      mockContactRepository.create.mockReturnValue(createdRequest);
      mockContactRepository.save.mockResolvedValue(createdRequest);

      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ORGANIZATION,
        organizationId: 'org-123',
        senderName: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Confidential inquiry',
        message: 'This is a leadership-only message.',
        visibility: MessageVisibility.LEADERSHIP,
      };

      await service.submitContactRequest(input);

      expect(mockContactRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: MessageVisibility.LEADERSHIP,
        })
      );
    });

    it('should persist visibleToRoles when visibility is custom', async () => {
      mockProfileRepository.findOne.mockResolvedValue(mockPublicProfile);
      const customRoles = ['hr_lead', 'recruiter'];
      const createdRequest = {
        ...mockContactRequest,
        visibility: MessageVisibility.CUSTOM,
        visibleToRoles: customRoles,
      };
      mockContactRepository.create.mockReturnValue(createdRequest);
      mockContactRepository.save.mockResolvedValue(createdRequest);

      const input: CreateContactRequestInput = {
        targetType: ContactTargetType.ORGANIZATION,
        organizationId: 'org-123',
        senderName: 'Jane Doe',
        senderEmail: 'jane@example.com',
        subject: 'Custom visibility test',
        message: 'This message is for specific roles only.',
        visibility: MessageVisibility.CUSTOM,
        visibleToRoles: customRoles,
      };

      await service.submitContactRequest(input);

      expect(mockContactRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: MessageVisibility.CUSTOM,
          visibleToRoles: customRoles,
        })
      );
    });
  });

  describe('getOrganizationContactRequests', () => {
    it('should return paginated contact requests', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockContactRequest], 1]),
      };

      mockContactRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getOrganizationContactRequests('org-123');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].senderName).toBe('John Doe');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should apply status filter correctly', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockContactRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: ContactRequestFilterOptions = {
        status: ContactRequestStatus.PENDING,
      };

      await service.getOrganizationContactRequests('org-123', filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('request.status = :status', {
        status: ContactRequestStatus.PENDING,
      });
    });

    it('should apply search term filter correctly', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockContactRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: ContactRequestFilterOptions = {
        searchTerm: 'john',
      };

      await service.getOrganizationContactRequests('org-123', filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(request.senderName ILIKE :search OR request.senderEmail ILIKE :search)',
        { search: '%john%' }
      );
    });

    it('should validate sortBy field for security', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockContactRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Try invalid sortBy (potential SQL injection)
      await service.getOrganizationContactRequests(
        'org-123',
        {},
        {
          page: 1,
          limit: 10,
          sortBy: 'id; DROP TABLE contact_requests;--',
          sortOrder: 'ASC',
        }
      );

      // Should fallback to createdAt
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('request.createdAt', 'ASC');
    });
  });

  describe('updateOrganizationContactRequest', () => {
    it('should update contact request status', async () => {
      const existingRequest = { ...mockContactRequest };
      mockContactRepository.findOne.mockResolvedValue(existingRequest);
      mockContactRepository.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.updateOrganizationContactRequest(
        'contact-123',
        'org-123',
        { status: ContactRequestStatus.READ },
        'user-123'
      );

      expect(result?.status).toBe(ContactRequestStatus.READ);
      expect(result?.handledBy).toBe('user-123');
      expect(result?.handledAt).toBeInstanceOf(Date);
    });

    it('should update internal notes', async () => {
      const existingRequest = { ...mockContactRequest };
      mockContactRepository.findOne.mockResolvedValue(existingRequest);
      mockContactRepository.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.updateOrganizationContactRequest(
        'contact-123',
        'org-123',
        { internalNotes: 'Responded via email' },
        'user-123'
      );

      expect(result?.internalNotes).toBe('Responded via email');
    });

    it('should return null when request not found', async () => {
      mockContactRepository.findOne.mockResolvedValue(null);

      const result = await service.updateOrganizationContactRequest(
        'nonexistent',
        'org-123',
        { status: ContactRequestStatus.READ },
        'user-123'
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteOrganizationContactRequest', () => {
    it('should delete contact request and return true', async () => {
      mockContactRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteOrganizationContactRequest('contact-123', 'org-123');

      expect(result).toBe(true);
      expect(mockContactRepository.delete).toHaveBeenCalledWith({
        id: 'contact-123',
        organizationId: 'org-123',
      });
    });

    it('should return false when request not found', async () => {
      mockContactRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteOrganizationContactRequest('nonexistent', 'org-123');

      expect(result).toBe(false);
    });
  });

  describe('archiveUserMessage', () => {
    it('archives a sender-owned message and returns true', async () => {
      mockContactRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.archiveUserMessage('contact-123', 'user-1');

      expect(result).toBe(true);
      expect(mockContactRepository.update).toHaveBeenCalledWith(
        { id: 'contact-123', senderUserId: 'user-1' },
        { status: ContactRequestStatus.ARCHIVED }
      );
    });

    it('returns false when no message matches the sender', async () => {
      mockContactRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.archiveUserMessage('nope', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('deleteUserMessage', () => {
    it('deletes a sender-owned message (scoped by senderUserId) and returns true', async () => {
      mockContactRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteUserMessage('contact-123', 'user-1');

      expect(result).toBe(true);
      expect(mockContactRepository.delete).toHaveBeenCalledWith({
        id: 'contact-123',
        senderUserId: 'user-1',
      });
    });

    it('returns false when no message matches the sender', async () => {
      mockContactRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteUserMessage('nope', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('getOrganizationContactRequestStats', () => {
    it('should return contact request statistics', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      };

      mockContactRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30) // pending
        .mockResolvedValueOnce(20) // read
        .mockResolvedValueOnce(40) // replied
        .mockResolvedValueOnce(8) // archived
        .mockResolvedValueOnce(2); // spam

      mockContactRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getOrganizationContactRequestStats('org-123');

      expect(result.total).toBe(100);
      expect(result.pending).toBe(30);
      expect(result.read).toBe(20);
      expect(result.replied).toBe(40);
      expect(result.archived).toBe(8);
      expect(result.spam).toBe(2);
      expect(result.lastWeek).toBe(5);
    });
  });

  describe('getOrganizationPendingCount', () => {
    it('should return count of pending requests', async () => {
      mockContactRepository.count.mockResolvedValue(15);

      const result = await service.getOrganizationPendingCount('org-123');

      expect(result).toBe(15);
      expect(mockContactRepository.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', status: ContactRequestStatus.PENDING },
      });
    });
  });

  describe('getContactTypeOptions', () => {
    it('should return all contact type options', () => {
      const options = service.getContactTypeOptions();

      expect(options).toContain('general');
      expect(options).toContain('recruitment');
      expect(options).toContain('partnership');
      expect(options).toContain('question');
      expect(options).toContain('feedback');
      expect(options).toContain('other');
      expect(options.length).toBe(6);
    });
  });

  describe('getStatusOptions', () => {
    it('should return all status options', () => {
      const options = service.getStatusOptions();

      expect(options).toContain(ContactRequestStatus.PENDING);
      expect(options).toContain(ContactRequestStatus.READ);
      expect(options).toContain(ContactRequestStatus.REPLIED);
      expect(options).toContain(ContactRequestStatus.ARCHIVED);
      expect(options).toContain(ContactRequestStatus.SPAM);
      expect(options.length).toBe(5);
    });
  });

  describe('getTargetTypeOptions', () => {
    it('should return all target type options', () => {
      const options = service.getTargetTypeOptions();

      expect(options).toContain(ContactTargetType.ORGANIZATION);
      expect(options).toContain(ContactTargetType.ALLIANCE);
      expect(options.length).toBe(2);
    });
  });

  describe('addReply — typed error contract', () => {
    it('throws NotFoundError (404) when the contact request does not exist', async () => {
      mockContactRepository.findOne.mockResolvedValue(null);

      const error = await service
        .addReply({
          contactRequestId: 'missing',
          senderUserId: 'user-1',
          message: 'hi',
          isOrgReply: false,
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('throws ForbiddenError (403) when a non-owner replies to a personal request', async () => {
      mockContactRepository.findOne.mockResolvedValue({
        id: 'cr-1',
        senderUserId: 'owner-1',
      });

      const error = await service
        .addReply({
          contactRequestId: 'cr-1',
          senderUserId: 'intruder-1',
          message: 'hi',
          isOrgReply: false,
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
