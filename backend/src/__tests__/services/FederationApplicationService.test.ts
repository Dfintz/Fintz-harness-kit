jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/federation/FederationAmbassadorService');

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';
import { FederationApplicationService } from '../../services/federation/FederationApplicationService';

describe('FederationApplicationService', () => {
  let service: FederationApplicationService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAppRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockFedRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMemberRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorService: any;

  const FEDERATION_ID = 'fed-111';
  const USER_ID = 'user-abc';
  const ORG_ID = 'org-xyz';

  beforeEach(() => {
    jest.clearAllMocks();

    mockAppRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockFedRepo = {
      findOne: jest.fn(),
    };

    mockMemberRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'OrgApplication') return mockAppRepo;
      if (name === 'Federation') return mockFedRepo;
      if (name === 'FederationMember') return mockMemberRepo;
      return {};
    });

    mockAmbassadorService = { hasPermission: jest.fn() };
    (FederationAmbassadorService.getInstance as jest.Mock).mockReturnValue(mockAmbassadorService);

    service = new FederationApplicationService();
  });

  describe('getApplicationMode', () => {
    it('should return disabled for non-public federation', async () => {
      mockFedRepo.findOne.mockResolvedValue({ id: FEDERATION_ID, isPublic: false, settings: {} });

      const result = await service.getApplicationMode(FEDERATION_ID);

      expect(result.mode).toBe('disabled');
    });

    it('should return simple for public federation without questions', async () => {
      mockFedRepo.findOne.mockResolvedValue({ id: FEDERATION_ID, isPublic: true, settings: {} });

      const result = await service.getApplicationMode(FEDERATION_ID);

      expect(result.mode).toBe('simple');
    });

    it('should return custom for federation with questions', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        isPublic: true,
        settings: {
          applicationQuestions: [
            { id: 'q1', label: 'Why?', type: 'short', required: true, order: 0 },
          ],
        },
      });

      const result = await service.getApplicationMode(FEDERATION_ID);

      expect(result.mode).toBe('custom');
      expect(result.questions).toHaveLength(1);
    });

    it('should return disabled when allowSelfApplication is false', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        isPublic: true,
        settings: { allowSelfApplication: false },
      });

      const result = await service.getApplicationMode(FEDERATION_ID);

      expect(result.mode).toBe('disabled');
    });
  });

  describe('applyToFederation', () => {
    it('should create a federation application', async () => {
      mockFedRepo.findOne.mockResolvedValue({ id: FEDERATION_ID, isPublic: true, settings: {} });
      mockMemberRepo.findOne.mockResolvedValue(null); // No existing membership
      mockAppRepo.findOne.mockResolvedValue(null); // No duplicate

      const saved = {
        id: 'app-1',
        organizationId: FEDERATION_ID,
        applicantUserId: USER_ID,
        applicantOrgId: ORG_ID,
        applicantOrgName: 'Test Org',
        targetType: 'federation',
        applicantType: 'organization',
        message: 'We want to join',
        status: 'pending',
        createdAt: new Date(),
      };
      mockAppRepo.create.mockReturnValue(saved);
      mockAppRepo.save.mockResolvedValue(saved);

      const result = await service.applyToFederation(FEDERATION_ID, USER_ID, ORG_ID, 'Test Org', {
        message: 'We want to join',
      });

      expect(result.id).toBe('app-1');
      expect(result.status).toBe('pending');
      expect(mockAppRepo.save).toHaveBeenCalled();
    });

    it('should reject if federation is invitation-only', async () => {
      mockFedRepo.findOne.mockResolvedValue({ id: FEDERATION_ID, isPublic: false, settings: {} });

      await expect(
        service.applyToFederation(FEDERATION_ID, USER_ID, ORG_ID, 'Test Org', {})
      ).rejects.toThrow('does not accept applications');
    });

    it('should reject if already a member', async () => {
      mockFedRepo.findOne.mockResolvedValue({ id: FEDERATION_ID, isPublic: true, settings: {} });
      mockMemberRepo.findOne.mockResolvedValue({ id: 'member-1' });

      await expect(
        service.applyToFederation(FEDERATION_ID, USER_ID, ORG_ID, 'Test Org', {})
      ).rejects.toThrow('already a member');
    });

    it('should reject duplicate pending application', async () => {
      mockFedRepo.findOne.mockResolvedValue({ id: FEDERATION_ID, isPublic: true, settings: {} });
      mockMemberRepo.findOne.mockResolvedValue(null);
      mockAppRepo.findOne.mockResolvedValue({ id: 'existing-app' });

      await expect(
        service.applyToFederation(FEDERATION_ID, USER_ID, ORG_ID, 'Test Org', {})
      ).rejects.toThrow('pending application');
    });
  });

  describe('reviewApplication', () => {
    it('should approve and create member', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const app = {
        id: 'app-1',
        organizationId: FEDERATION_ID,
        applicantOrgId: ORG_ID,
        applicantOrgName: 'Test Org',
        applicantUserId: USER_ID,
        targetType: 'federation',
        status: 'pending',
      };
      mockAppRepo.findOne.mockResolvedValue({ ...app });
      mockAppRepo.save.mockImplementation(async (e: Record<string, unknown>) => e);
      mockMemberRepo.create.mockReturnValue({});
      mockMemberRepo.save.mockResolvedValue({});

      const result = await service.reviewApplication(FEDERATION_ID, 'app-1', USER_ID, 'approved');

      expect(result.status).toBe('approved');
      expect(mockMemberRepo.save).toHaveBeenCalled();
    });

    it('should reject without creating member', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const app = {
        id: 'app-1',
        organizationId: FEDERATION_ID,
        targetType: 'federation',
        status: 'pending',
      };
      mockAppRepo.findOne.mockResolvedValue({ ...app });
      mockAppRepo.save.mockImplementation(async (e: Record<string, unknown>) => e);

      const result = await service.reviewApplication(
        FEDERATION_ID,
        'app-1',
        USER_ID,
        'rejected',
        'Not suitable'
      );

      expect(result.status).toBe('rejected');
      expect(mockMemberRepo.save).not.toHaveBeenCalled();
    });

    it('should reject reviewing non-pending application', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockAppRepo.findOne.mockResolvedValue({
        id: 'app-1',
        organizationId: FEDERATION_ID,
        targetType: 'federation',
        status: 'approved',
      });

      await expect(
        service.reviewApplication(FEDERATION_ID, 'app-1', USER_ID, 'approved')
      ).rejects.toThrow('Only pending');
    });
  });

  describe('withdrawApplication', () => {
    it('should withdraw a pending application', async () => {
      mockAppRepo.findOne.mockResolvedValue({
        id: 'app-1',
        organizationId: FEDERATION_ID,
        targetType: 'federation',
        applicantUserId: USER_ID,
        status: 'pending',
      });
      mockAppRepo.save.mockImplementation(async (e: Record<string, unknown>) => e);

      await service.withdrawApplication(FEDERATION_ID, 'app-1', USER_ID);

      expect(mockAppRepo.save).toHaveBeenCalled();
    });

    it('should reject withdrawing non-pending application', async () => {
      mockAppRepo.findOne.mockResolvedValue({
        id: 'app-1',
        organizationId: FEDERATION_ID,
        targetType: 'federation',
        applicantUserId: USER_ID,
        status: 'approved',
      });

      await expect(service.withdrawApplication(FEDERATION_ID, 'app-1', USER_ID)).rejects.toThrow(
        'Only pending'
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
