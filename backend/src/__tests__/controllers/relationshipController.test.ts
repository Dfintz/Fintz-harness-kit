import { Request, Response } from 'express';

import { RelationshipStatus, RelationshipType } from '../../models/OrganizationRelationship';
import { InteractionSentiment } from '../../models/RelationshipHistory';

// Mock the consolidated RelationshipService
const mockRelService = {
  // Relationship CRUD
  createRelationship: jest.fn(),
  getRelationshipById: jest.fn(),
  getOrganizationRelationships: jest.fn(),
  updateRelationship: jest.fn(),
  recordInteraction: jest.fn(),
  getRelationshipHealthSummary: jest.fn(),
  getRelationshipsNeedingReview: jest.fn(),
  establishMutualRelationship: jest.fn(),
  terminateRelationship: jest.fn(),
  // History methods (consolidated from RelationshipHistoryService)
  getRelationshipHistory: jest.fn(),
  getRelationshipTimeline: jest.fn(),
  analyzeRelationshipHistory: jest.fn(),
  getSentimentTrend: jest.fn(),
  // Trust methods (consolidated from TrustScoreService)
  updateTrustScore: jest.fn(),
  getTrustTrend: jest.fn(),
  getTrustRecommendations: jest.fn(),
  getOrganizationRelationshipsEnriched: jest.fn(),
};

jest.mock('../../services/social', () => ({
  RelationshipService: jest.fn().mockImplementation(() => mockRelService),
}));

// Import controller after mocking
import { RelationshipController } from '../../controllers/relationshipController';

describe('relationshipController', () => {
  let controller: RelationshipController;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    controller = new RelationshipController();
    req = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-1', username: 'test' },
      tenantContext: { organizationId: 'org-1', userId: 'user-1' },
    } as any;
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createRelationship', () => {
    it('should create relationship', async () => {
      req.body = {
        organizationId: 'org-1',
        targetOrganizationId: 'org-2',
        type: RelationshipType.ALLIED,
      };
      mockRelService.createRelationship.mockResolvedValue({ id: 'rel-1' });

      await controller.createRelationship(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      req.body = { organizationId: 'org-1', targetOrganizationId: 'org-2' };
      mockRelService.createRelationship.mockRejectedValue(new Error('Error'));

      await controller.createRelationship(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('getRelationship', () => {
    it('should get relationship by ID', async () => {
      req.params = { id: 'rel-1' };
      mockRelService.getRelationshipById.mockResolvedValue({ id: 'rel-1', organizationId: 'org-1' });

      await controller.getRelationship(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'rel-1' }),
        })
      );
    });

    it('should return 404 when not found', async () => {
      req.params = { id: 'rel-999' };
      mockRelService.getRelationshipById.mockResolvedValue(null);

      await controller.getRelationship(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      req.params = { id: 'rel-1' };
      mockRelService.getRelationshipById.mockRejectedValue(new Error('Error'));

      await controller.getRelationship(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('getOrganizationRelationships', () => {
    it('should get relationships for organization', async () => {
      req.params = { orgId: 'org-1' };
      const mockRelationships = [{ id: 'rel-1' }] as any;
      mockRelationships.length = 1;
      mockRelService.getOrganizationRelationshipsEnriched.mockResolvedValue(mockRelationships);

      await controller.getOrganizationRelationships(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          count: 1,
        })
      );
    });
  });

  describe('updateRelationship', () => {
    it('should update relationship', async () => {
      req.params = { id: 'rel-1' };
      req.body = { status: RelationshipStatus.SUSPENDED };
      mockRelService.getRelationshipById.mockResolvedValue({ id: 'rel-1', organizationId: 'org-1' });
      mockRelService.updateRelationship.mockResolvedValue({ id: 'rel-1' });

      await controller.updateRelationship(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getRelationshipHistory', () => {
    it('should get history', async () => {
      req.params = { id: 'rel-1' };
      const mockHistory = [{ getDetailedSummary: () => ({ type: 'test' }) }] as any;
      mockHistory.map = Array.prototype.map.bind(mockHistory);
      mockRelService.getRelationshipHistory.mockResolvedValue(mockHistory);

      await controller.getRelationshipHistory(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('recordInteraction', () => {
    it('should record interaction', async () => {
      req.params = { id: 'rel-1' };
      req.body = { sentiment: InteractionSentiment.POSITIVE, description: 'Test' };
      mockRelService.getRelationshipById.mockResolvedValue({ id: 'rel-1', organizationId: 'org-1' });
      mockRelService.recordInteraction.mockResolvedValue({ id: 'rel-1' });

      await controller.recordInteraction(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('updateTrustScore', () => {
    it('should update trust score', async () => {
      req.params = { id: 'rel-1' };
      req.body = { delta: 10, reason: 'Test' };
      const mockRelationship = {
        id: 'rel-1',
        organizationId: 'org-1',
        targetOrganizationId: 'org-2',
      } as any;
      mockRelService.getRelationshipById.mockResolvedValue(mockRelationship);
      mockRelService.updateTrustScore.mockResolvedValue(80);

      await controller.updateTrustScore(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 when not found', async () => {
      req.params = { id: 'rel-999' };
      req.body = { delta: 10, reason: 'Test' };
      mockRelService.getRelationshipById.mockResolvedValue(null);

      await controller.updateTrustScore(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getTrustRecommendations', () => {
    it('should get recommendations', async () => {
      req.params = { id: 'rel-1' };
      const mockRelationship = {
        id: 'rel-1',
        organizationId: 'org-1',
        targetOrganizationId: 'org-2',
      } as any;
      mockRelService.getRelationshipById.mockResolvedValue(mockRelationship);
      mockRelService.getTrustRecommendations.mockResolvedValue(['Test']);

      await controller.getTrustRecommendations(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 when not found', async () => {
      req.params = { id: 'rel-999' };
      mockRelService.getRelationshipById.mockResolvedValue(null);

      await controller.getTrustRecommendations(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('establishMutualRelationship', () => {
    it('should establish mutual relationship', async () => {
      req.params = { id: 'rel-1' };
      mockRelService.getRelationshipById.mockResolvedValue({ id: 'rel-1', organizationId: 'org-1' });
      mockRelService.establishMutualRelationship.mockResolvedValue(undefined);

      await controller.establishMutualRelationship(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('terminateRelationship', () => {
    it('should terminate relationship', async () => {
      req.params = { id: 'rel-1' };
      req.body = { reason: 'Test' };
      mockRelService.getRelationshipById.mockResolvedValue({ id: 'rel-1', organizationId: 'org-1' });
      mockRelService.terminateRelationship.mockResolvedValue(undefined);

      await controller.terminateRelationship(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('enum endpoints', () => {
    it('should return relationship types', async () => {
      await controller.getRelationshipTypes(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([RelationshipType.ALLIED]),
        })
      );
    });

    it('should return change types', async () => {
      await controller.getChangeTypes(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return interaction sentiments', async () => {
      await controller.getInteractionSentiments(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
