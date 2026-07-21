jest.mock('../../services/content');

import { Request, Response } from 'express';

import { BriefingController } from '../../controllers/briefingController';
import { BriefingStatus } from '../../models/Briefing';
import { BriefingService } from '../../services/content';

describe('BriefingController', () => {
  let controller: BriefingController;
  let mockService: jest.Mocked<BriefingService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseObject: any;
  const TEST_ORG_ID = 'org-123';
  const TEST_USER = {
    id: 'user-123',
    username: 'testuser',
    role: 'admin',
    currentOrganizationId: TEST_ORG_ID,
  };

  beforeEach(() => {
    mockService = new BriefingService() as jest.Mocked<BriefingService>;
    controller = new BriefingController();
    (controller as any).briefingService = mockService;

    responseObject = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation(result => {
        responseObject = result;
        return mockResponse;
      }),
      send: jest.fn(),
    };

    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: TEST_USER,
    };

    jest.clearAllMocks();
  });

  describe('createBriefing', () => {
    it('should create a briefing successfully', async () => {
      const briefingData = {
        title: 'Operation Icarus',
        creatorId: 'user-123',
        missionId: 'mission-456',
      };

      const createdBriefing = {
        id: 'briefing-1',
        ...briefingData,
        status: BriefingStatus.DRAFT,
        elements: [],
        participants: [],
      };

      mockRequest.body = briefingData;
      mockService.createBriefing.mockResolvedValue(createdBriefing as any);

      await controller.createBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockService.createBriefing).toHaveBeenCalledWith(TEST_ORG_ID, briefingData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(createdBriefing);
    });

    it('should handle errors when creating briefing', async () => {
      const error = new Error('Database error');
      mockRequest.body = { title: 'Test' };
      mockService.createBriefing.mockRejectedValue(error);

      await controller.createBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
        })
      );
    });
  });

  describe('getBriefing', () => {
    it('should retrieve a briefing by id', async () => {
      const briefing = {
        id: 'briefing-1',
        title: 'Operation Icarus',
        status: BriefingStatus.ACTIVE,
      };

      mockRequest.params = { id: 'briefing-1' };
      mockService.getBriefingById.mockResolvedValue(briefing as any);

      await controller.getBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockService.getBriefingById).toHaveBeenCalledWith('briefing-1', TEST_ORG_ID);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(briefing);
    });

    it('should return 404 if briefing not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockService.getBriefingById.mockResolvedValue(null);

      await controller.getBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Briefing not found',
        })
      );
    });

    it('should handle errors when retrieving briefing', async () => {
      const error = new Error('Database error');
      mockRequest.params = { id: 'briefing-1' };
      mockService.getBriefingById.mockRejectedValue(error);

      await controller.getBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAllBriefings', () => {
    it('should retrieve all briefings with pagination', async () => {
      const paginatedResult = {
        data: [
          { id: 'briefing-1', title: 'Operation Alpha' },
          { id: 'briefing-2', title: 'Operation Beta' },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      };

      mockRequest.query = { page: '1', limit: '10' };
      mockService.getAllBriefings.mockResolvedValue(paginatedResult as any);

      await controller.getAllBriefings(mockRequest as Request, mockResponse as Response);

      expect(mockService.getAllBriefings).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(paginatedResult);
    });

    it('should filter by creatorId', async () => {
      mockRequest.query = { creatorId: 'user-123' };
      mockService.getAllBriefings.mockResolvedValue({ data: [], pagination: {} } as any);

      await controller.getAllBriefings(mockRequest as Request, mockResponse as Response);

      expect(mockService.getAllBriefings).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.any(Object),
        expect.objectContaining({ creatorId: 'user-123' })
      );
    });

    it('should filter by status', async () => {
      mockRequest.query = { status: BriefingStatus.ACTIVE };
      mockService.getAllBriefings.mockResolvedValue({ data: [], pagination: {} } as any);

      await controller.getAllBriefings(mockRequest as Request, mockResponse as Response);

      expect(mockService.getAllBriefings).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.any(Object),
        expect.objectContaining({ status: BriefingStatus.ACTIVE })
      );
    });

    it('should parse tags from comma-separated string', async () => {
      mockRequest.query = { tags: 'combat,stealth,raid' };
      mockService.getAllBriefings.mockResolvedValue({ data: [], pagination: {} } as any);

      await controller.getAllBriefings(mockRequest as Request, mockResponse as Response);

      expect(mockService.getAllBriefings).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.any(Object),
        expect.objectContaining({ tags: ['combat', 'stealth', 'raid'] })
      );
    });
  });

  describe('getBriefingsByMission', () => {
    it('should retrieve briefings for a specific mission', async () => {
      const briefings = [
        { id: 'briefing-1', missionId: 'mission-123', title: 'Pre-mission Brief' },
        { id: 'briefing-2', missionId: 'mission-123', title: 'Post-mission Debrief' },
      ];

      mockRequest.params = { missionId: 'mission-123' };
      mockService.getBriefingsByMission.mockResolvedValue(briefings as any);

      await controller.getBriefingsByMission(mockRequest as Request, mockResponse as Response);

      expect(mockService.getBriefingsByMission).toHaveBeenCalledWith('mission-123', TEST_ORG_ID);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(briefings);
    });

    it('should handle errors when retrieving mission briefings', async () => {
      const error = new Error('Query failed');
      mockRequest.params = { missionId: 'mission-123' };
      mockService.getBriefingsByMission.mockRejectedValue(error);

      await controller.getBriefingsByMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateBriefing', () => {
    it('should update a briefing successfully', async () => {
      const updateData = {
        title: 'Updated Title',
      };

      const updatedBriefing = {
        id: 'briefing-1',
        ...updateData,
        status: BriefingStatus.DRAFT,
      };

      mockRequest.params = { id: 'briefing-1' };
      mockRequest.body = updateData;
      mockService.updateBriefing.mockResolvedValue(updatedBriefing as any);

      await controller.updateBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockService.updateBriefing).toHaveBeenCalledWith(
        'briefing-1',
        TEST_ORG_ID,
        updateData
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(updatedBriefing);
    });

    it('should return 404 if briefing to update not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { title: 'New Title' };
      mockService.updateBriefing.mockResolvedValue(null);

      await controller.updateBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Briefing not found',
        })
      );
    });

    it('should handle errors when updating briefing', async () => {
      const error = new Error('Update failed');
      mockRequest.params = { id: 'briefing-1' };
      mockService.updateBriefing.mockRejectedValue(error);

      await controller.updateBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteBriefing', () => {
    it('should delete a briefing successfully', async () => {
      mockRequest.params = { id: 'briefing-1' };
      mockService.deleteBriefing.mockResolvedValue(true);

      await controller.deleteBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockService.deleteBriefing).toHaveBeenCalledWith('briefing-1', TEST_ORG_ID);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should return 404 if briefing to delete not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockService.deleteBriefing.mockResolvedValue(false);

      await controller.deleteBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when deleting briefing', async () => {
      const error = new Error('Delete failed');
      mockRequest.params = { id: 'briefing-1' };
      mockService.deleteBriefing.mockRejectedValue(error);

      await controller.deleteBriefing(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('addElement', () => {
    it('should add an element to briefing', async () => {
      const elementData = {
        type: 'objective',
        content: 'Secure the mining facility',
        order: 1,
      };

      const updatedBriefing = {
        id: 'briefing-1',
        elements: [{ id: 'elem-1', ...elementData }],
      };

      mockRequest.params = { id: 'briefing-1' };
      mockRequest.body = elementData;
      mockService.addElement.mockResolvedValue(updatedBriefing as any);

      await controller.addElement(mockRequest as Request, mockResponse as Response);

      expect(mockService.addElement).toHaveBeenCalledWith('briefing-1', TEST_ORG_ID, elementData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(updatedBriefing);
    });

    it('should return 404 if briefing not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { type: 'note', content: 'Test' };
      mockService.addElement.mockResolvedValue(null);

      await controller.addElement(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateElement', () => {
    it('should update a briefing element', async () => {
      const updateData = { content: 'Updated objective' };
      const updatedBriefing = {
        id: 'briefing-1',
        elements: [{ id: 'elem-1', content: 'Updated objective' }],
      };

      mockRequest.params = { id: 'briefing-1', elementId: 'elem-1' };
      mockRequest.body = updateData;
      mockService.updateElement.mockResolvedValue(updatedBriefing as any);

      await controller.updateElement(mockRequest as Request, mockResponse as Response);

      expect(mockService.updateElement).toHaveBeenCalledWith(
        'briefing-1',
        TEST_ORG_ID,
        'elem-1',
        updateData
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if briefing or element not found', async () => {
      mockRequest.params = { id: 'briefing-1', elementId: 'nonexistent' };
      mockRequest.body = { content: 'Updated' };
      mockService.updateElement.mockResolvedValue(null);

      await controller.updateElement(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Briefing or element not found',
        })
      );
    });
  });

  describe('deleteElement', () => {
    it('should delete a briefing element', async () => {
      const updatedBriefing = {
        id: 'briefing-1',
        elements: [],
      };

      mockRequest.params = { id: 'briefing-1', elementId: 'elem-1' };
      mockService.deleteElement.mockResolvedValue(updatedBriefing as any);

      await controller.deleteElement(mockRequest as Request, mockResponse as Response);

      expect(mockService.deleteElement).toHaveBeenCalledWith('briefing-1', TEST_ORG_ID, 'elem-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if briefing or element not found', async () => {
      mockRequest.params = { id: 'briefing-1', elementId: 'nonexistent' };
      mockService.deleteElement.mockResolvedValue(null);

      await controller.deleteElement(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to briefing', async () => {
      const updatedBriefing = {
        id: 'briefing-1',
        participants: ['user-456'],
      };

      mockRequest.params = { id: 'briefing-1' };
      mockRequest.body = { userId: 'user-456' };
      mockService.addParticipant.mockResolvedValue(updatedBriefing as any);

      await controller.addParticipant(mockRequest as Request, mockResponse as Response);

      expect(mockService.addParticipant).toHaveBeenCalledWith(
        'briefing-1',
        TEST_ORG_ID,
        'user-456'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if briefing not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { userId: 'user-456' };
      mockService.addParticipant.mockResolvedValue(null);

      await controller.addParticipant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
