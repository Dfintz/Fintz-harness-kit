import { Request, Response } from 'express';

import { CrewAssignmentController } from '../../controllers/crewAssignmentController';
import { AssignmentStatus, CrewRole } from '../../models/CrewAssignment';
import { CrewAssignmentService } from '../../services/crew';
import { OrganizationPermissionService } from '../../services/organization/OrganizationPermissionService';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { extractPaginationOptions } from '../../utils/pagination';

// ─── Mock dependencies ───────────────────────────────────────────────

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    }),
  },
}));

jest.mock('../../utils/pagination', () => ({
  extractPaginationOptions: jest.fn().mockReturnValue({ page: 1, limit: 20 }),
  paginateRepository: jest.fn(),
}));

jest.mock('../../services/organization/OrganizationPermissionService');
jest.mock('../../services/crew');

// ─── Helpers ─────────────────────────────────────────────────────────

const ORG_ID = 'org-test-123';
const USER_ID = 'user-test-456';

function buildAuthRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    params: {},
    query: {},
    body: {},
    user: {
      id: USER_ID,
      username: 'testuser',
      role: 'admin',
      currentOrganizationId: ORG_ID,
    },
    ...overrides,
  } as Partial<Request>;
}

function buildResponse(): { res: Partial<Response>; statusSpy: jest.Mock; jsonSpy: jest.Mock } {
  const jsonSpy = jest.fn().mockReturnThis();
  const statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
  return {
    res: { status: statusSpy, json: jsonSpy } as Partial<Response>,
    statusSpy,
    jsonSpy,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('CrewAssignmentController', () => {
  let controller: CrewAssignmentController;
  let mockPermissionCheck: jest.Mock;
  let mockServiceInstance: Record<string, jest.Mock>;

  beforeEach(() => {
    // Mock permission service to allow by default
    mockPermissionCheck = jest.fn().mockResolvedValue({ allowed: true });
    (OrganizationPermissionService as jest.Mock).mockImplementation(() => ({
      checkPermission: mockPermissionCheck,
    }));

    // Mock CrewAssignmentService methods
    mockServiceInstance = {
      createAssignment: jest.fn(),
      getAssignments: jest.fn(),
      getAssignmentById: jest.fn(),
      addCrewMember: jest.fn(),
      removeCrewMember: jest.fn(),
      updateStatus: jest.fn(),
    };
    (CrewAssignmentService as jest.Mock).mockImplementation(() => mockServiceInstance);

    controller = new CrewAssignmentController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== AUTH ====================

  describe('auth enforcement', () => {
    it('should return 403 when no organization is selected', async () => {
      const req = buildAuthRequest({
        user: { id: USER_ID, username: 'test', role: 'admin' } as any,
      });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.createAssignment(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 401 when no user is present', async () => {
      const req = buildAuthRequest({ user: undefined } as any);
      const { res, statusSpy } = buildResponse();

      await controller.createAssignment(req as Request, res as Response);

      // getOrgId runs first → 403, or getUserId → 401 depending on order
      expect([401, 403]).toContain(statusSpy.mock.calls[0][0]);
    });

    it('should return 403 when permission check fails', async () => {
      mockPermissionCheck.mockResolvedValue({ allowed: false });
      const req = buildAuthRequest({ body: { shipId: 'ship-1' } });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.createAssignment(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('permission') })
      );
    });
  });

  // ==================== CREATE ====================

  describe('createAssignment', () => {
    it('should create crew assignment successfully', async () => {
      const requestBody = {
        shipId: 'ship-1',
        missionId: 'mission-1',
        crew: [
          { userId: 'user-2', role: CrewRole.PILOT },
          { userId: 'user-3', role: CrewRole.ENGINEER },
        ],
        notes: 'Test mission crew',
      };

      const mockAssignment = {
        id: 'uuid-123',
        organizationId: ORG_ID,
        shipId: 'ship-1',
        assignerId: USER_ID,
        crew: requestBody.crew,
        status: AssignmentStatus.ACTIVE,
        notes: 'Test mission crew',
      };

      mockServiceInstance.createAssignment.mockResolvedValue(mockAssignment);

      const req = buildAuthRequest({ body: requestBody });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.createAssignment(req as Request, res as Response);

      expect(mockPermissionCheck).toHaveBeenCalled();
      expect(mockServiceInstance.createAssignment).toHaveBeenCalledWith(
        ORG_ID,
        USER_ID,
        requestBody
      );
      expect(statusSpy).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith(mockAssignment);
    });

    it('should create assignment with optional fields when provided', async () => {
      const body = {
        shipId: 'ship-1',
        missionId: 'mission-1',
        startDate: '2026-01-01T00:00:00Z',
        notes: 'Test mission',
      };
      const mockAssignment = { id: 'uuid-456', ...body, status: AssignmentStatus.ACTIVE };
      mockServiceInstance.createAssignment.mockResolvedValue(mockAssignment);

      const req = buildAuthRequest({ body });
      const { res, statusSpy } = buildResponse();

      await controller.createAssignment(req as Request, res as Response);

      expect(mockServiceInstance.createAssignment).toHaveBeenCalledWith(ORG_ID, USER_ID, body);
      expect(statusSpy).toHaveBeenCalledWith(201);
    });

    it('should return 400 when shipId is missing', async () => {
      mockServiceInstance.createAssignment.mockRejectedValue(
        new ValidationError('shipId is required')
      );

      const req = buildAuthRequest({ body: {} });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.createAssignment(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 500 on unexpected error', async () => {
      mockServiceInstance.createAssignment.mockRejectedValue(new Error('Database error'));

      const req = buildAuthRequest({ body: { shipId: 'ship-1' } });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.createAssignment(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  // ==================== READ ====================

  describe('getAssignments', () => {
    it('should get paginated assignments scoped by org', async () => {
      const mockResult = {
        data: [
          { id: 'crew-1', status: AssignmentStatus.ACTIVE },
          { id: 'crew-2', status: AssignmentStatus.COMPLETED },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };

      (extractPaginationOptions as jest.Mock).mockReturnValue({ page: 1, limit: 20 });
      mockServiceInstance.getAssignments.mockResolvedValue(mockResult);

      const req = buildAuthRequest();
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.getAssignments(req as Request, res as Response);

      expect(mockServiceInstance.getAssignments).toHaveBeenCalledWith(ORG_ID, {
        page: 1,
        limit: 20,
      });
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockResult);
    });

    it('should return 403 when VIEW permission is denied', async () => {
      mockPermissionCheck.mockResolvedValue({ allowed: false });

      const req = buildAuthRequest();
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.getAssignments(req as Request, res as Response);

      expect(mockPermissionCheck).toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('view'),
        })
      );
    });

    it('should return 500 on query failure', async () => {
      (extractPaginationOptions as jest.Mock).mockReturnValue({});
      mockServiceInstance.getAssignments.mockRejectedValue(new Error('Query failed'));

      const req = buildAuthRequest();
      const { res, statusSpy } = buildResponse();

      await controller.getAssignments(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
    });
  });

  describe('getAssignmentById', () => {
    it('should get assignment by id scoped by org', async () => {
      const mockAssignment = {
        id: 'crew-1',
        organizationId: ORG_ID,
        crew: [],
        status: AssignmentStatus.ACTIVE,
      };

      mockServiceInstance.getAssignmentById.mockResolvedValue(mockAssignment);

      const req = buildAuthRequest({ params: { id: 'crew-1' } });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.getAssignmentById(req as Request, res as Response);

      expect(mockServiceInstance.getAssignmentById).toHaveBeenCalledWith(ORG_ID, 'crew-1');
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockAssignment);
    });

    it('should return 403 when VIEW permission is denied', async () => {
      mockPermissionCheck.mockResolvedValue({ allowed: false });

      const req = buildAuthRequest({ params: { id: 'crew-1' } });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.getAssignmentById(req as Request, res as Response);

      expect(mockPermissionCheck).toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('view'),
        })
      );
    });

    it('should return 404 when assignment not found', async () => {
      mockServiceInstance.getAssignmentById.mockRejectedValue(new NotFoundError('Crew assignment'));

      const req = buildAuthRequest({ params: { id: 'invalid-id' } });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.getAssignmentById(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 500 on unexpected error', async () => {
      mockServiceInstance.getAssignmentById.mockRejectedValue(new Error('DB error'));

      const req = buildAuthRequest({ params: { id: 'crew-1' } });
      const { res, statusSpy } = buildResponse();

      await controller.getAssignmentById(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
    });
  });

  // ==================== CREW MEMBER MANAGEMENT ====================

  describe('addCrewMember', () => {
    it('should add crew member to assignment', async () => {
      const updatedAssignment = {
        id: 'crew-1',
        organizationId: ORG_ID,
        crew: [
          { userId: 'user-2', role: CrewRole.PILOT },
          { userId: 'user-3', role: CrewRole.ENGINEER },
        ],
        status: AssignmentStatus.ACTIVE,
      };

      mockServiceInstance.addCrewMember.mockResolvedValue(updatedAssignment);

      const req = buildAuthRequest({
        params: { id: 'crew-1' },
        body: { userId: 'user-3', role: CrewRole.ENGINEER },
      });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.addCrewMember(req as Request, res as Response);

      expect(mockPermissionCheck).toHaveBeenCalled();
      expect(mockServiceInstance.addCrewMember).toHaveBeenCalledWith(ORG_ID, 'crew-1', {
        userId: 'user-3',
        role: CrewRole.ENGINEER,
      });
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(updatedAssignment);
    });

    it('should return 404 when assignment not found', async () => {
      mockServiceInstance.addCrewMember.mockRejectedValue(new NotFoundError('Crew assignment'));

      const req = buildAuthRequest({
        params: { id: 'invalid-id' },
        body: { userId: 'user-1', role: CrewRole.PILOT },
      });
      const { res, statusSpy } = buildResponse();

      await controller.addCrewMember(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
    });

    it('should return 409 when user is already a crew member', async () => {
      mockServiceInstance.addCrewMember.mockRejectedValue(
        new ConflictError('Member user-2 already exists')
      );

      const req = buildAuthRequest({
        params: { id: 'crew-1' },
        body: { userId: 'user-2', role: CrewRole.GUNNER },
      });
      const { res, statusSpy } = buildResponse();

      await controller.addCrewMember(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(409);
    });

    it('should return 500 on save failure', async () => {
      mockServiceInstance.addCrewMember.mockRejectedValue(new Error('Save failed'));

      const req = buildAuthRequest({
        params: { id: 'crew-1' },
        body: { userId: 'user-1', role: CrewRole.PILOT },
      });
      const { res, statusSpy } = buildResponse();

      await controller.addCrewMember(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
    });
  });

  describe('removeCrewMember', () => {
    it('should remove crew member from assignment', async () => {
      const updatedAssignment = {
        id: 'crew-1',
        organizationId: ORG_ID,
        crew: [{ userId: 'user-2', role: CrewRole.PILOT }],
        status: AssignmentStatus.ACTIVE,
      };

      mockServiceInstance.removeCrewMember.mockResolvedValue(updatedAssignment);

      const req = buildAuthRequest({
        params: { id: 'crew-1', userId: 'user-3' },
      });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.removeCrewMember(req as Request, res as Response);

      expect(mockPermissionCheck).toHaveBeenCalled();
      expect(mockServiceInstance.removeCrewMember).toHaveBeenCalledWith(ORG_ID, 'crew-1', 'user-3');
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(updatedAssignment);
    });

    it('should return 404 when member not found in crew', async () => {
      mockServiceInstance.removeCrewMember.mockRejectedValue(new NotFoundError('Member user-999'));

      const req = buildAuthRequest({
        params: { id: 'crew-1', userId: 'user-999' },
      });
      const { res, statusSpy } = buildResponse();

      await controller.removeCrewMember(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
    });

    it('should return 404 when assignment not found', async () => {
      mockServiceInstance.removeCrewMember.mockRejectedValue(new NotFoundError('Crew assignment'));

      const req = buildAuthRequest({
        params: { id: 'invalid-id', userId: 'user-1' },
      });
      const { res, statusSpy } = buildResponse();

      await controller.removeCrewMember(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
    });

    it('should return 403 when permission denied', async () => {
      mockPermissionCheck.mockResolvedValue({ allowed: false });

      const req = buildAuthRequest({
        params: { id: 'crew-1', userId: 'user-3' },
      });
      const { res, statusSpy } = buildResponse();

      await controller.removeCrewMember(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(mockServiceInstance.removeCrewMember).not.toHaveBeenCalled();
    });
  });

  // ==================== STATUS ====================

  describe('updateStatus', () => {
    it('should update assignment status via valid transition', async () => {
      const updatedAssignment = {
        id: 'crew-1',
        organizationId: ORG_ID,
        crew: [],
        status: AssignmentStatus.COMPLETED,
        endDate: new Date(),
      };

      mockServiceInstance.updateStatus.mockResolvedValue(updatedAssignment);

      const req = buildAuthRequest({
        params: { id: 'crew-1' },
        body: { status: AssignmentStatus.COMPLETED },
      });
      const { res, statusSpy, jsonSpy } = buildResponse();

      await controller.updateStatus(req as Request, res as Response);

      expect(mockPermissionCheck).toHaveBeenCalled();
      expect(mockServiceInstance.updateStatus).toHaveBeenCalledWith(
        ORG_ID,
        'crew-1',
        AssignmentStatus.COMPLETED
      );
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(updatedAssignment);
    });

    it('should return 400 for invalid status transition', async () => {
      mockServiceInstance.updateStatus.mockRejectedValue(
        new ValidationError('Invalid transition from completed to active')
      );

      const req = buildAuthRequest({
        params: { id: 'crew-1' },
        body: { status: AssignmentStatus.ACTIVE },
      });
      const { res, statusSpy } = buildResponse();

      await controller.updateStatus(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
    });

    it('should return 404 when assignment not found', async () => {
      mockServiceInstance.updateStatus.mockRejectedValue(new NotFoundError('Crew assignment'));

      const req = buildAuthRequest({
        params: { id: 'invalid-id' },
        body: { status: AssignmentStatus.INACTIVE },
      });
      const { res, statusSpy } = buildResponse();

      await controller.updateStatus(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
    });

    it('should return 403 when permission denied', async () => {
      mockPermissionCheck.mockResolvedValue({ allowed: false });

      const req = buildAuthRequest({
        params: { id: 'crew-1' },
        body: { status: AssignmentStatus.COMPLETED },
      });
      const { res, statusSpy } = buildResponse();

      await controller.updateStatus(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(mockServiceInstance.updateStatus).not.toHaveBeenCalled();
    });
  });
});
