import { Response } from 'express';

import { AppDataSource } from '../../config/database';
import { AllianceDiplomacyController } from '../../controllers/allianceDiplomacyController';
import { AuthRequest } from '../../middleware/auth';
import { AllianceType, DiplomacyStatus } from '../../models/AllianceDiplomacy';
import { extractPaginationOptions } from '../../utils/pagination';

jest.mock('../../config/database');
jest.mock('../../utils/pagination');

describe('AllianceDiplomacyController', () => {
  let controller: AllianceDiplomacyController;
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    controller = new AllianceDiplomacyController();

    req = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-1', currentOrganizationId: 'org-1', username: 'testuser', role: 'admin' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('proposeDiplomacy', () => {
    it('should propose diplomacy', async () => {
      req.body = {
        targetOrgId: 'org-2',
        allianceType: AllianceType.MILITARY,
      };

      const mockDiplomacy = { id: 'dip-1', status: DiplomacyStatus.PROPOSED };
      mockRepo.create.mockReturnValue(mockDiplomacy);
      mockRepo.save.mockResolvedValue(mockDiplomacy);

      await controller.proposeDiplomacy(req as AuthRequest, res as Response);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId1: 'org-1',
          orgId2: 'org-2',
          proposedBy: 'user-1',
          status: DiplomacyStatus.PROPOSED,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 when no organization context', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user = { id: 'user-1', username: 'testuser', role: 'admin' };
      req.body = {
        targetOrgId: 'org-2',
        allianceType: AllianceType.MILITARY,
      };

      await controller.proposeDiplomacy(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      req.body = {
        targetOrgId: 'org-2',
        allianceType: AllianceType.MILITARY,
      };
      mockRepo.create.mockImplementation(() => {
        throw new Error('Error');
      });

      await controller.proposeDiplomacy(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getDiplomacyRelations', () => {
    it('should get relations scoped to current org', async () => {
      (extractPaginationOptions as jest.Mock).mockReturnValue({ page: 1, limit: 10 });
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await controller.getDiplomacyRelations(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ orgId1: 'org-1' }, { orgId2: 'org-1' }],
        })
      );
    });
  });

  describe('getDiplomacyById', () => {
    it('should get diplomacy by ID scoped to org', async () => {
      req.params = { id: 'dip-1' };
      const mockDiplomacy = { id: 'dip-1', orgId1: 'org-1', orgId2: 'org-2' };
      mockRepo.findOne.mockResolvedValue(mockDiplomacy);

      await controller.getDiplomacyById(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: [
          { id: 'dip-1', orgId1: 'org-1' },
          { id: 'dip-1', orgId2: 'org-1' },
        ],
      });
    });

    it('should return 404 when not found or not a party', async () => {
      req.params = { id: 'dip-999' };
      mockRepo.findOne.mockResolvedValue(null);

      await controller.getDiplomacyById(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('approveDiplomacy', () => {
    it('should approve diplomacy when target org', async () => {
      req.params = { id: 'dip-1' };
      // Current org = org-1, diplomacy target = org-1 (user is from orgId2)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user = { id: 'user-1', currentOrganizationId: 'org-2' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDiplomacy: any = {
        id: 'dip-1',
        orgId1: 'org-1',
        orgId2: 'org-2',
        status: DiplomacyStatus.PROPOSED,
      };
      mockRepo.findOne.mockResolvedValue(mockDiplomacy);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRepo.save.mockImplementation((dip: any) => Promise.resolve(dip));

      await controller.approveDiplomacy(req as AuthRequest, res as Response);

      expect(mockDiplomacy.status).toBe(DiplomacyStatus.ACTIVE);
      expect(mockDiplomacy.approvedBy).toBe('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 403 when proposing org tries to approve', async () => {
      req.params = { id: 'dip-1' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDiplomacy: any = {
        id: 'dip-1',
        orgId1: 'org-1',
        orgId2: 'org-2',
        status: DiplomacyStatus.PROPOSED,
      };
      mockRepo.findOne.mockResolvedValue(mockDiplomacy);

      await controller.approveDiplomacy(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('suspendDiplomacy', () => {
    it('should suspend diplomacy', async () => {
      req.params = { id: 'dip-1' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDiplomacy: any = { id: 'dip-1', orgId1: 'org-1', status: DiplomacyStatus.ACTIVE };
      mockRepo.findOne.mockResolvedValue(mockDiplomacy);
      mockRepo.save.mockResolvedValue(mockDiplomacy);

      await controller.suspendDiplomacy(req as AuthRequest, res as Response);

      expect(mockDiplomacy.status).toBe(DiplomacyStatus.SUSPENDED);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('terminateDiplomacy', () => {
    it('should terminate diplomacy', async () => {
      req.params = { id: 'dip-1' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDiplomacy: any = { id: 'dip-1', orgId1: 'org-1', status: DiplomacyStatus.ACTIVE };
      mockRepo.findOne.mockResolvedValue(mockDiplomacy);
      mockRepo.save.mockResolvedValue(mockDiplomacy);

      await controller.terminateDiplomacy(req as AuthRequest, res as Response);

      expect(mockDiplomacy.status).toBe(DiplomacyStatus.TERMINATED);
      expect(mockDiplomacy.endDate).toBeInstanceOf(Date);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('reportIncident', () => {
    it('should report incident', async () => {
      req.params = { id: 'dip-1' };
      req.body = { description: 'Test', severity: 'high', reportedBy: 'user-1' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDiplomacy: any = { id: 'dip-1', orgId1: 'org-1', incidents: [] };
      mockRepo.findOne.mockResolvedValue(mockDiplomacy);
      mockRepo.save.mockResolvedValue(mockDiplomacy);

      await controller.reportIncident(req as AuthRequest, res as Response);

      expect(mockDiplomacy.incidents.length).toBe(1);
      expect(mockDiplomacy.incidents[0]).toMatchObject({
        description: 'Test',
        severity: 'high',
        resolved: false,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('resolveIncident', () => {
    it('should resolve incident', async () => {
      req.params = { id: 'dip-1', incidentId: 'inc-1' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockIncident: any = { incidentId: 'inc-1', resolved: false };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDiplomacy: any = { id: 'dip-1', orgId1: 'org-1', incidents: [mockIncident] };
      mockRepo.findOne.mockResolvedValue(mockDiplomacy);
      mockRepo.save.mockResolvedValue(mockDiplomacy);

      await controller.resolveIncident(req as AuthRequest, res as Response);

      expect(mockIncident.resolved).toBe(true);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when incident not found', async () => {
      req.params = { id: 'dip-1', incidentId: 'inc-999' };
      mockRepo.findOne.mockResolvedValue({ orgId1: 'org-1', incidents: [] });

      await controller.resolveIncident(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
