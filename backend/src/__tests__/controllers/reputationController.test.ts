import { Request, Response } from 'express';

import { ReputationCategory } from '../../models/Reputation';

const mockReputationService = {
  getOrCreateReputation: jest.fn(),
  updateScore: jest.fn(),
  getLeaderboard: jest.fn(),
  getUnifiedReputation: jest.fn(),
};

const mockFleetReputationService = {
  getFleetReputation: jest.fn(),
};

jest.mock('../../services/social/ReputationService', () => ({
  ReputationService: jest.fn().mockImplementation(() => mockReputationService),
}));
jest.mock('../../services/fleet/FleetReputationService', () => ({
  FleetReputationService: {
    getInstance: jest.fn().mockReturnValue(mockFleetReputationService),
  },
}));

import { ReputationController } from '../../controllers/reputationController';

describe('ReputationController', () => {
  let controller: ReputationController;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReputationController();
    req = { params: {}, query: {}, body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  });

  describe('getUserReputation', () => {
    it('should get reputation via service', async () => {
      req.params = { userId: 'user-1' };
      const mockRep = { id: 'rep-1', userId: 'user-1', overallScore: 75 };
      mockReputationService.getOrCreateReputation.mockResolvedValue(mockRep);

      await controller.getUserReputation(req as Request, res as Response);

      expect(mockReputationService.getOrCreateReputation).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockRep);
    });
  });

  describe('updateReputation', () => {
    it('should update score via service', async () => {
      req.params = { userId: 'user-1' };
      req.body = {
        category: ReputationCategory.COMBAT,
        amount: 10,
        reason: 'Mission success',
        modifiedBy: 'admin',
      };
      const updatedRep = { userId: 'user-1', overallScore: 60 };
      mockReputationService.updateScore.mockResolvedValue(updatedRep);

      await controller.updateReputation(req as Request, res as Response);

      expect(mockReputationService.updateScore).toHaveBeenCalledWith(
        'user-1', ReputationCategory.COMBAT, 10, 'Mission success', 'admin'
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getTopReputation', () => {
    it('should get leaderboard via service', async () => {
      const mockLeaderboard = { data: [{ userId: 'user-1', overallScore: 100 }], total: 1 };
      mockReputationService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      await controller.getTopReputation(req as Request, res as Response);

      expect(mockReputationService.getLeaderboard).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
