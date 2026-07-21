jest.mock('../../services/content/MissionService');

import { Request, Response } from 'express';

import { MissionController } from '../../controllers/missionController';
import { MissionStatus } from '../../models/Mission';
import { MissionService } from '../../services/content/MissionService';

describe('MissionController', () => {
  let controller: MissionController;
  let mockService: jest.Mocked<MissionService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const TEST_ORG_ID = 'org-123';
  const TEST_USER = {
    id: 'user-123',
    username: 'testuser',
    role: 'admin',
    currentOrganizationId: TEST_ORG_ID,
  };

  beforeEach(() => {
    mockService = new MissionService() as jest.Mocked<MissionService>;
    controller = new MissionController();
    (controller as any).missionService = mockService;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn(),
      success: jest.fn().mockReturnThis(),
      paginated: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: TEST_USER,
    };

    jest.clearAllMocks();
  });

  // ---- CRUD ----

  describe('createMission', () => {
    it('should create a mission successfully', async () => {
      const missionData = {
        title: 'Vanduul Patrol',
        description: 'Patrol Stanton borders',
        missionType: 'combat_patrol',
      };

      const createdMission = {
        id: 'mission-1',
        ...missionData,
        status: MissionStatus.DRAFT,
        organizationId: TEST_ORG_ID,
        createdBy: TEST_USER.id,
      };

      mockRequest.body = missionData;
      mockService.createMission.mockResolvedValue(createdMission as any);

      await controller.createMission(mockRequest as Request, mockResponse as Response);

      expect(mockService.createMission).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.objectContaining({
          ...missionData,
          createdBy: TEST_USER.id,
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.success).toHaveBeenCalledWith(createdMission);
    });

    it('should handle errors when creating mission', async () => {
      const error = new Error('Database error');
      mockRequest.body = { title: 'Test' };
      mockService.createMission.mockRejectedValue(error);

      await controller.createMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('getMission', () => {
    it('should retrieve a mission by id', async () => {
      const mission = {
        id: 'mission-1',
        title: 'Vanduul Patrol',
        status: MissionStatus.PLANNED,
      };

      mockRequest.params = { missionId: 'mission-1' };
      mockService.getMissionById.mockResolvedValue(mission as any);

      await controller.getMission(mockRequest as Request, mockResponse as Response);

      expect(mockService.getMissionById).toHaveBeenCalledWith('mission-1', TEST_ORG_ID);
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should return 404 if mission not found', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockService.getMissionById.mockResolvedValue(null);

      await controller.getMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when retrieving mission', async () => {
      const error = new Error('Database error');
      mockRequest.params = { missionId: 'mission-1' };
      mockService.getMissionById.mockRejectedValue(error);

      await controller.getMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAllMissions', () => {
    it('should retrieve all missions with pagination', async () => {
      const paginatedResult = {
        data: [
          { id: 'mission-1', title: 'Patrol Alpha' },
          { id: 'mission-2', title: 'Mining Op Beta' },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      };

      mockRequest.query = { page: '1', limit: '10' };
      mockService.getAllMissions.mockResolvedValue(paginatedResult as any);

      await controller.getAllMissions(mockRequest as Request, mockResponse as Response);

      expect(mockService.getAllMissions).toHaveBeenCalled();
      expect(mockResponse.paginated).toHaveBeenCalledWith(
        paginatedResult.data,
        expect.objectContaining({
          total: 2,
          limit: 10,
        })
      );
    });

    it('should filter by status', async () => {
      mockRequest.query = { status: MissionStatus.PLANNED };
      mockService.getAllMissions.mockResolvedValue({ data: [], pagination: {} } as any);

      await controller.getAllMissions(mockRequest as Request, mockResponse as Response);

      expect(mockService.getAllMissions).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.any(Object),
        expect.objectContaining({ status: MissionStatus.PLANNED })
      );
    });

    it('should parse tags from comma-separated string', async () => {
      mockRequest.query = { tags: 'combat,stealth' };
      mockService.getAllMissions.mockResolvedValue({ data: [], pagination: {} } as any);

      await controller.getAllMissions(mockRequest as Request, mockResponse as Response);

      expect(mockService.getAllMissions).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.any(Object),
        expect.objectContaining({ tags: ['combat', 'stealth'] })
      );
    });

    it('should handle tags as array', async () => {
      mockRequest.query = { tags: ['combat', 'stealth'] };
      mockService.getAllMissions.mockResolvedValue({ data: [], pagination: {} } as any);

      await controller.getAllMissions(mockRequest as Request, mockResponse as Response);

      expect(mockService.getAllMissions).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.any(Object),
        expect.objectContaining({ tags: ['combat', 'stealth'] })
      );
    });

    it('should handle errors when retrieving missions', async () => {
      const error = new Error('Query failed');
      mockService.getAllMissions.mockRejectedValue(error);

      await controller.getAllMissions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateMission', () => {
    it('should update a mission successfully', async () => {
      const updateData = { title: 'Updated Patrol', description: 'Updated description' };
      const updatedMission = { id: 'mission-1', ...updateData, status: MissionStatus.DRAFT };

      mockRequest.params = { missionId: 'mission-1' };
      mockRequest.body = updateData;
      mockService.updateMission.mockResolvedValue(updatedMission as any);

      await controller.updateMission(mockRequest as Request, mockResponse as Response);

      expect(mockService.updateMission).toHaveBeenCalledWith('mission-1', TEST_ORG_ID, updateData);
      expect(mockResponse.success).toHaveBeenCalledWith(updatedMission);
    });

    it('should return 404 if mission to update not found', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockRequest.body = { title: 'New Title' };
      mockService.updateMission.mockResolvedValue(null);

      await controller.updateMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when updating mission', async () => {
      const error = new Error('Update failed');
      mockRequest.params = { missionId: 'mission-1' };
      mockService.updateMission.mockRejectedValue(error);

      await controller.updateMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteMission', () => {
    it('should delete a mission successfully', async () => {
      mockRequest.params = { missionId: 'mission-1' };
      mockService.deleteMission.mockResolvedValue(true);

      await controller.deleteMission(mockRequest as Request, mockResponse as Response);

      expect(mockService.deleteMission).toHaveBeenCalledWith(
        'mission-1',
        TEST_ORG_ID,
        TEST_USER.id
      );
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should return 404 if mission to delete not found', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockService.deleteMission.mockResolvedValue(false);

      await controller.deleteMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when deleting mission', async () => {
      const error = new Error('Delete failed');
      mockRequest.params = { missionId: 'mission-1' };
      mockService.deleteMission.mockRejectedValue(error);

      await controller.deleteMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- Status & Lifecycle ----

  describe('updateStatus', () => {
    it('should transition mission status', async () => {
      const mission = { id: 'mission-1', status: MissionStatus.PLANNED };
      mockRequest.params = { missionId: 'mission-1' };
      mockRequest.body = { status: MissionStatus.PLANNED };
      mockService.transitionStatus.mockResolvedValue(mission as any);

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockService.transitionStatus).toHaveBeenCalledWith(
        'mission-1',
        TEST_ORG_ID,
        MissionStatus.PLANNED
      );
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should return 404 if mission not found for status update', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockRequest.body = { status: MissionStatus.PLANNED };
      mockService.transitionStatus.mockResolvedValue(null);

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('completeMission', () => {
    it('should complete a mission with completed status', async () => {
      const mission = { id: 'mission-1', status: MissionStatus.COMPLETED };
      mockRequest.params = { missionId: 'mission-1' };
      mockRequest.body = { status: MissionStatus.COMPLETED, notes: 'Mission success' };
      mockService.completeMission.mockResolvedValue(mission as any);

      await controller.completeMission(mockRequest as Request, mockResponse as Response);

      expect(mockService.completeMission).toHaveBeenCalledWith('mission-1', TEST_ORG_ID, {
        status: MissionStatus.COMPLETED,
        notes: 'Mission success',
      });
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should complete a mission with failed status', async () => {
      const mission = { id: 'mission-1', status: MissionStatus.FAILED };
      mockRequest.params = { missionId: 'mission-1' };
      mockRequest.body = { status: MissionStatus.FAILED, notes: 'Ambush' };
      mockService.completeMission.mockResolvedValue(mission as any);

      await controller.completeMission(mockRequest as Request, mockResponse as Response);

      expect(mockService.completeMission).toHaveBeenCalled();
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should reject invalid status for completion', async () => {
      mockRequest.params = { missionId: 'mission-1' };
      mockRequest.body = { status: MissionStatus.PLANNED };

      await controller.completeMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockService.completeMission).not.toHaveBeenCalled();
    });

    it('should return 404 if mission not found for completion', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockRequest.body = { status: MissionStatus.COMPLETED };
      mockService.completeMission.mockResolvedValue(null);

      await controller.completeMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- Assignment & Participants ----

  describe('assignMission', () => {
    it('should assign a mission to user', async () => {
      const mission = { id: 'mission-1', assignedTo: 'user-456' };
      mockRequest.params = { missionId: 'mission-1' };
      mockRequest.body = { userId: 'user-456', role: 'pilot' };
      mockService.assignMission.mockResolvedValue(mission as any);

      await controller.assignMission(mockRequest as Request, mockResponse as Response);

      expect(mockService.assignMission).toHaveBeenCalledWith(
        'mission-1',
        TEST_ORG_ID,
        'user-456',
        'pilot'
      );
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should return 404 for assignment to nonexistent mission', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockRequest.body = { userId: 'user-456', role: 'pilot' };
      mockService.assignMission.mockResolvedValue(null);

      await controller.assignMission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getParticipants', () => {
    it('should retrieve participants for a mission', async () => {
      const participants = [
        { userId: 'user-1', role: 'pilot' },
        { userId: 'user-2', role: 'gunner' },
      ];

      mockRequest.params = { missionId: 'mission-1' };
      mockService.getParticipants.mockResolvedValue(participants as any);

      await controller.getParticipants(mockRequest as Request, mockResponse as Response);

      expect(mockService.getParticipants).toHaveBeenCalledWith('mission-1', TEST_ORG_ID);
      expect(mockResponse.success).toHaveBeenCalledWith(participants);
    });

    it('should return 404 if mission not found', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockService.getParticipants.mockResolvedValue(null);

      await controller.getParticipants(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to a mission', async () => {
      const mission = { id: 'mission-1', participants: [{ userId: 'user-456', role: 'medic' }] };
      mockRequest.params = { missionId: 'mission-1' };
      mockRequest.body = { userId: 'user-456', role: 'medic' };
      mockService.addParticipant.mockResolvedValue(mission as any);

      await controller.addParticipant(mockRequest as Request, mockResponse as Response);

      expect(mockService.addParticipant).toHaveBeenCalledWith(
        'mission-1',
        TEST_ORG_ID,
        'user-456',
        'medic'
      );
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should return 404 if mission not found', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockRequest.body = { userId: 'user-456', role: 'medic' };
      mockService.addParticipant.mockResolvedValue(null);

      await controller.addParticipant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant from a mission', async () => {
      const mission = { id: 'mission-1', participants: [] };
      mockRequest.params = { missionId: 'mission-1', userId: 'user-456' };
      mockService.removeParticipant.mockResolvedValue(mission as any);

      await controller.removeParticipant(mockRequest as Request, mockResponse as Response);

      expect(mockService.removeParticipant).toHaveBeenCalledWith(
        'mission-1',
        TEST_ORG_ID,
        'user-456'
      );
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should return 404 if mission or participant not found', async () => {
      mockRequest.params = { missionId: 'nonexistent', userId: 'user-456' };
      mockService.removeParticipant.mockResolvedValue(null);

      await controller.removeParticipant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- Objectives ----

  describe('addObjective', () => {
    it('should add an objective to a mission', async () => {
      const objectiveData = { title: 'Secure perimeter', description: 'Establish security zone' };
      const mission = { id: 'mission-1', objectives: [{ id: 'obj-1', ...objectiveData }] };

      mockRequest.params = { missionId: 'mission-1' };
      mockRequest.body = objectiveData;
      mockService.addObjective.mockResolvedValue(mission as any);

      await controller.addObjective(mockRequest as Request, mockResponse as Response);

      expect(mockService.addObjective).toHaveBeenCalledWith(
        'mission-1',
        TEST_ORG_ID,
        objectiveData
      );
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should return 404 if mission not found', async () => {
      mockRequest.params = { missionId: 'nonexistent' };
      mockRequest.body = { title: 'Test' };
      mockService.addObjective.mockResolvedValue(null);

      await controller.addObjective(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateObjective', () => {
    it('should update an objective', async () => {
      const updateData = { title: 'Updated objective', completed: true };
      const mission = { id: 'mission-1', objectives: [{ id: 'obj-1', ...updateData }] };

      mockRequest.params = { missionId: 'mission-1', objectiveId: 'obj-1' };
      mockRequest.body = updateData;
      mockService.updateObjective.mockResolvedValue(mission as any);

      await controller.updateObjective(mockRequest as Request, mockResponse as Response);

      expect(mockService.updateObjective).toHaveBeenCalledWith(
        'mission-1',
        TEST_ORG_ID,
        'obj-1',
        updateData
      );
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should return 404 if mission or objective not found', async () => {
      mockRequest.params = { missionId: 'mission-1', objectiveId: 'nonexistent' };
      mockRequest.body = { title: 'Test' };
      mockService.updateObjective.mockResolvedValue(null);

      await controller.updateObjective(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('removeObjective', () => {
    it('should remove an objective from a mission', async () => {
      const mission = { id: 'mission-1', objectives: [] };
      mockRequest.params = { missionId: 'mission-1', objectiveId: 'obj-1' };
      mockService.removeObjective.mockResolvedValue(mission as any);

      await controller.removeObjective(mockRequest as Request, mockResponse as Response);

      expect(mockService.removeObjective).toHaveBeenCalledWith('mission-1', TEST_ORG_ID, 'obj-1');
      expect(mockResponse.success).toHaveBeenCalledWith(mission);
    });

    it('should return 404 if mission or objective not found', async () => {
      mockRequest.params = { missionId: 'nonexistent', objectiveId: 'obj-1' };
      mockService.removeObjective.mockResolvedValue(null);

      await controller.removeObjective(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- Templates & Queries ----

  describe('getTemplates', () => {
    it('should retrieve mission templates', async () => {
      const templates = [
        { id: 'tmpl-1', title: 'Patrol Template', status: MissionStatus.DRAFT },
        { id: 'tmpl-2', title: 'Mining Template', status: MissionStatus.DRAFT },
      ];

      mockService.getTemplates.mockResolvedValue(templates as any);

      await controller.getTemplates(mockRequest as Request, mockResponse as Response);

      expect(mockService.getTemplates).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(mockResponse.success).toHaveBeenCalledWith(templates);
    });

    it('should handle errors when retrieving templates', async () => {
      const error = new Error('Query failed');
      mockService.getTemplates.mockRejectedValue(error);

      await controller.getTemplates(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMissionsByFleet', () => {
    it('should retrieve missions for a fleet', async () => {
      const missions = [{ id: 'mission-1', title: 'Fleet Patrol', fleetId: 'fleet-1' }];

      mockRequest.params = { fleetId: 'fleet-1' };
      mockService.getMissionsByFleet.mockResolvedValue(missions as any);

      await controller.getMissionsByFleet(mockRequest as Request, mockResponse as Response);

      expect(mockService.getMissionsByFleet).toHaveBeenCalledWith('fleet-1', TEST_ORG_ID);
      expect(mockResponse.success).toHaveBeenCalledWith(missions);
    });

    it('should handle errors when retrieving fleet missions', async () => {
      const error = new Error('Query failed');
      mockRequest.params = { fleetId: 'fleet-1' };
      mockService.getMissionsByFleet.mockRejectedValue(error);

      await controller.getMissionsByFleet(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getActiveMissions', () => {
    it('should retrieve active missions', async () => {
      const missions = [
        { id: 'mission-1', title: 'Active Patrol', status: MissionStatus.IN_PROGRESS },
      ];

      mockService.getActiveMissions.mockResolvedValue(missions as any);

      await controller.getActiveMissions(mockRequest as Request, mockResponse as Response);

      expect(mockService.getActiveMissions).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(mockResponse.success).toHaveBeenCalledWith(missions);
    });

    it('should handle errors when retrieving active missions', async () => {
      const error = new Error('Query failed');
      mockService.getActiveMissions.mockRejectedValue(error);

      await controller.getActiveMissions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('searchScmdbMissionCards', () => {
    it('should return SCMDB mission cards with filters', async () => {
      const cards = [
        { externalId: 'abc', title: 'Card 1', category: 'combat', tags: [], payload: {} },
      ];
      mockRequest.query = { search: 'card', category: 'combat', limit: '20' };
      mockService.searchScmdbMissionCards.mockResolvedValue(cards as any);

      await controller.searchScmdbMissionCards(mockRequest as Request, mockResponse as Response);

      expect(mockService.searchScmdbMissionCards).toHaveBeenCalledWith({
        search: 'card',
        category: 'combat',
        limit: 20,
      });
      expect(mockResponse.success).toHaveBeenCalledWith(cards);
    });
  });

  describe('importScmdbMissions', () => {
    it('should import selected SCMDB mission cards', async () => {
      const result = {
        imported: [{ id: 'm1' }],
        skipped: [],
      };
      mockRequest.body = { items: [{ externalId: 'abc' }] };
      mockService.importScmdbMissions.mockResolvedValue(result as any);

      await controller.importScmdbMissions(mockRequest as Request, mockResponse as Response);

      expect(mockService.importScmdbMissions).toHaveBeenCalledWith(TEST_ORG_ID, TEST_USER.id, [
        { externalId: 'abc' },
      ]);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.success).toHaveBeenCalledWith(result);
    });
  });
});
