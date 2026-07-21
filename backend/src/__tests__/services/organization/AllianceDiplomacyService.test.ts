import {
  AllianceDiplomacy,
  AllianceType,
  DiplomacyStatus,
} from '../../../models/AllianceDiplomacy';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../utils/apiErrors';

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue(mockRepository),
  },
}));

import { AllianceDiplomacyService } from '../../../services/organization/AllianceDiplomacyService';

describe('AllianceDiplomacyService', () => {
  let service: AllianceDiplomacyService;
  const orgId1 = 'org-1';
  const orgId2 = 'org-2';

  const mockDiplomacy: Partial<AllianceDiplomacy> = {
    id: 'diplomacy-uuid',
    orgId1,
    orgId2,
    allianceType: AllianceType.TRADE,
    proposedBy: 'user-1',
    status: DiplomacyStatus.PROPOSED,
    terms: [{ term: 'No PvP', description: 'Members shall not attack each other' }],
    incidents: [],
    notes: 'Trade agreement',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AllianceDiplomacyService();
  });

  describe('propose', () => {
    it('should create diplomacy with UUID and PROPOSED status', async () => {
      mockRepository.create.mockReturnValue({ ...mockDiplomacy });
      mockRepository.save.mockResolvedValue({ ...mockDiplomacy });

      const result = await service.propose({
        orgId1,
        orgId2,
        allianceType: AllianceType.TRADE,
        proposedBy: 'user-1',
        notes: 'Trade agreement',
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f]{8}-/),
          status: DiplomacyStatus.PROPOSED,
          incidents: [],
        })
      );
      expect(result).toBeDefined();
    });

    it('should reject self-diplomacy proposals', async () => {
      await expect(
        service.propose({
          orgId1: 'org-1',
          orgId2: 'org-1',
          allianceType: AllianceType.TRADE,
          proposedBy: 'user-1',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('findAll', () => {
    it('should return paginated results scoped to the organization', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(orgId1, { page: 1, limit: 10 });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ orgId1 }, { orgId2: orgId1 }],
          skip: 0,
          take: 10,
        })
      );
    });
  });

  describe('findById', () => {
    it('should return diplomacy when found and org is a party', async () => {
      mockRepository.findOne.mockResolvedValue(mockDiplomacy);

      const result = await service.findById('diplomacy-uuid', orgId1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: [
          { id: 'diplomacy-uuid', orgId1 },
          { id: 'diplomacy-uuid', orgId2: orgId1 },
        ],
      });
      expect(result).toEqual(mockDiplomacy);
    });

    it('should throw NotFoundError when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing', orgId1)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when org is not a party', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('diplomacy-uuid', 'org-other')).rejects.toThrow(NotFoundError);
    });
  });

  describe('approve', () => {
    it('should approve when target org and in PROPOSED status', async () => {
      const diplomacy = { ...mockDiplomacy } as AllianceDiplomacy;
      mockRepository.findOne.mockResolvedValue(diplomacy);
      mockRepository.save.mockResolvedValue(diplomacy);

      const result = await service.approve('diplomacy-uuid', orgId2, 'admin-1');

      expect(result.status).toBe(DiplomacyStatus.ACTIVE);
      expect(result.approvedBy).toBe('admin-1');
      expect(result.startDate).toBeDefined();
    });

    it('should throw ForbiddenError when proposing org tries to approve', async () => {
      const diplomacy = { ...mockDiplomacy } as AllianceDiplomacy;
      mockRepository.findOne.mockResolvedValue(diplomacy);

      await expect(service.approve('diplomacy-uuid', orgId1, 'admin-1')).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw ValidationError when not in PROPOSED status', async () => {
      const diplomacy = {
        ...mockDiplomacy,
        status: DiplomacyStatus.ACTIVE,
      } as AllianceDiplomacy;
      mockRepository.findOne.mockResolvedValue(diplomacy);

      await expect(service.approve('diplomacy-uuid', orgId2, 'admin-1')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('suspend', () => {
    it('should suspend diplomacy', async () => {
      const diplomacy = {
        ...mockDiplomacy,
        status: DiplomacyStatus.ACTIVE,
      } as AllianceDiplomacy;
      mockRepository.findOne.mockResolvedValue(diplomacy);
      mockRepository.save.mockResolvedValue(diplomacy);

      const result = await service.suspend('diplomacy-uuid', orgId1);

      expect(result.status).toBe(DiplomacyStatus.SUSPENDED);
    });
  });

  describe('terminate', () => {
    it('should terminate diplomacy and set endDate', async () => {
      const diplomacy = {
        ...mockDiplomacy,
        status: DiplomacyStatus.ACTIVE,
      } as AllianceDiplomacy;
      mockRepository.findOne.mockResolvedValue(diplomacy);
      mockRepository.save.mockResolvedValue(diplomacy);

      const result = await service.terminate('diplomacy-uuid', orgId1);

      expect(result.status).toBe(DiplomacyStatus.TERMINATED);
      expect(result.endDate).toBeDefined();
    });
  });

  describe('reportIncident', () => {
    it('should add incident with UUID incidentId', async () => {
      const diplomacy = { ...mockDiplomacy, incidents: [] } as AllianceDiplomacy;
      mockRepository.findOne.mockResolvedValue(diplomacy);
      mockRepository.save.mockResolvedValue(diplomacy);

      const result = await service.reportIncident('diplomacy-uuid', orgId1, {
        description: 'Border violation',
        severity: 'high',
        reportedBy: 'user-2',
      });

      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0].incidentId).toMatch(/^[0-9a-f]{8}-/);
      expect(result.incidents[0].description).toBe('Border violation');
      expect(result.incidents[0].severity).toBe('high');
      expect(result.incidents[0].resolved).toBe(false);
    });
  });

  describe('resolveIncident', () => {
    it('should resolve incident by incidentId', async () => {
      const diplomacy = {
        ...mockDiplomacy,
        incidents: [
          {
            incidentId: 'incident-1',
            description: 'Test',
            severity: 'low' as const,
            reportedBy: 'user-1',
            timestamp: new Date(),
            resolved: false,
          },
        ],
      } as AllianceDiplomacy;
      mockRepository.findOne.mockResolvedValue(diplomacy);
      mockRepository.save.mockResolvedValue(diplomacy);

      const result = await service.resolveIncident('diplomacy-uuid', orgId1, 'incident-1');

      expect(result.incidents[0].resolved).toBe(true);
    });

    it('should throw NotFoundError for unknown incidentId', async () => {
      const diplomacy = { ...mockDiplomacy, incidents: [] } as AllianceDiplomacy;
      mockRepository.findOne.mockResolvedValue(diplomacy);

      await expect(
        service.resolveIncident('diplomacy-uuid', orgId1, 'nonexistent')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
