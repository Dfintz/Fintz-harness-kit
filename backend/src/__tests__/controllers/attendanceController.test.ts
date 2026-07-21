/**
 * AttendanceController Unit Tests
 *
 * Tests attendance management operations
 * Covers initialization, confirmation, no-show tracking, stats and reporting
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { AttendanceController } from '../../controllers/attendanceController';
import { ActivityAttendanceService as EventAttendanceService } from '../../services/activity';
import { MockRequest, MockResponse } from '../helpers/testHelpers.helper';

// Mock dependencies
jest.mock('../../services/activity');
jest.mock('../../services/communication');
describe('AttendanceController', () => {
  let controller: AttendanceController;
  let mockAttendanceService: jest.Mocked<EventAttendanceService>;

  // Helper to create request with user context
  const createRequest = (overrides: any = {}) =>
    MockRequest.create({
      user: {
        id: 'test-user-id',
        username: 'testuser',
        role: 'user',
        currentOrganizationId: 'test-org-id',
      },
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked service instance
    mockAttendanceService = {
      initializeActivityAttendance: jest.fn(),
      confirmAttendance: jest.fn(),
      recordAttendance: jest.fn(),
      markNoShow: jest.fn(),
      sendConfirmationRequests: jest.fn(),
      getActivityAttendanceStats: jest.fn(),
      getUserAttendanceHistory: jest.fn(),
      generateAttendanceReport: jest.fn(),
      getAttendanceLeaderboard: jest.fn(),
      addPerformanceRating: jest.fn(),
    } as any;

    controller = new AttendanceController();
    (controller as any).attendanceService = mockAttendanceService;
  });

  describe('initializeAttendance', () => {
    it('should initialize attendance tracking successfully', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
      });
      const res = MockResponse.create();
      const mockConfirmations = [
        { id: '1', userId: 'user-1', activityId: 'activity-123' },
        { id: '2', userId: 'user-2', activityId: 'activity-123' },
      ];
      mockAttendanceService.initializeActivityAttendance.mockResolvedValue(
        mockConfirmations as any
      );

      await controller.initializeAttendance(req, res);

      expect(mockAttendanceService.initializeActivityAttendance).toHaveBeenCalledWith(
        'activity-123'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('2 participants'),
          data: mockConfirmations,
        })
      );
    });

    it('should handle errors', async () => {
      const req = createRequest({ params: { activityId: 'activity-123' } });
      const res = MockResponse.create();
      mockAttendanceService.initializeActivityAttendance.mockRejectedValue(
        new Error('Database error')
      );

      await controller.initializeAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('confirmAttendance', () => {
    it('should confirm attendance successfully', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
        body: { userId: 'user-1', actualRole: 'Pilot', confirmedBy: 'confirmer-id' },
      });
      const res = MockResponse.create();
      const mockConfirmation = { id: '1', userId: 'user-1', status: 'confirmed' };
      mockAttendanceService.confirmAttendance.mockResolvedValue(mockConfirmation as any);

      await controller.confirmAttendance(req, res);

      expect(mockAttendanceService.confirmAttendance).toHaveBeenCalledWith(
        'activity-123',
        'user-1',
        'Pilot',
        'confirmer-id'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Attendance confirmed',
          data: mockConfirmation,
        })
      );
    });

    it('should use requester ID if confirmedBy not provided', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
        body: { userId: 'user-1', actualRole: 'Pilot' },
      });
      const res = MockResponse.create();
      mockAttendanceService.confirmAttendance.mockResolvedValue({} as any);

      await controller.confirmAttendance(req, res);

      expect(mockAttendanceService.confirmAttendance).toHaveBeenCalledWith(
        'activity-123',
        'user-1',
        'Pilot',
        'test-user-id' // requester's ID
      );
    });

    it('should return error if userId is missing', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
        body: { actualRole: 'Pilot' },
      });
      const res = MockResponse.create();

      await controller.confirmAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('recordAttendance', () => {
    it('should record attendance with full details', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
        body: { userId: 'user-1', role: 'Pilot', shipUsed: 'Aurora' },
      });
      const res = MockResponse.create();
      const mockConfirmation = { id: '1', userId: 'user-1' };
      mockAttendanceService.recordAttendance.mockResolvedValue(mockConfirmation as any);

      await controller.recordAttendance(req, res);

      expect(mockAttendanceService.recordAttendance).toHaveBeenCalledWith(
        'test-org-id',
        'activity-123',
        expect.objectContaining({
          userId: 'user-1',
          role: 'Pilot',
          shipUsed: 'Aurora',
          confirmedBy: 'test-user-id',
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Attendance recorded',
        })
      );
    });

    it('should handle errors', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
        body: { userId: 'user-1' },
      });
      const res = MockResponse.create();
      mockAttendanceService.recordAttendance.mockRejectedValue(new Error('Record error'));

      await controller.recordAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markNoShow', () => {
    it('should mark user as no-show successfully', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
        body: { userId: 'user-1', excused: true, reason: 'Emergency' },
      });
      const res = MockResponse.create();
      const mockConfirmation = { id: '1', userId: 'user-1', status: 'no-show' };
      mockAttendanceService.markNoShow.mockResolvedValue(mockConfirmation as any);

      await controller.markNoShow(req, res);

      expect(mockAttendanceService.markNoShow).toHaveBeenCalledWith(
        'activity-123',
        'user-1',
        true,
        'Emergency',
        'test-user-id'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Marked as no-show',
          data: mockConfirmation,
        })
      );
    });

    it('should default excused to false if not provided', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
        body: { userId: 'user-1' },
      });
      const res = MockResponse.create();
      mockAttendanceService.markNoShow.mockResolvedValue({} as any);

      await controller.markNoShow(req, res);

      expect(mockAttendanceService.markNoShow).toHaveBeenCalledWith(
        'activity-123',
        'user-1',
        false,
        undefined,
        'test-user-id'
      );
    });

    it('should return error if userId is missing', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
        body: { excused: true },
      });
      const res = MockResponse.create();

      await controller.markNoShow(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('sendConfirmationRequests', () => {
    it('should send confirmation requests successfully', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
      });
      const res = MockResponse.create();
      mockAttendanceService.sendConfirmationRequests.mockResolvedValue(5);

      await controller.sendConfirmationRequests(req, res);

      expect(mockAttendanceService.sendConfirmationRequests).toHaveBeenCalledWith('activity-123');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Sent 5 confirmation requests',
          data: { sentCount: 5 },
        })
      );
    });
  });

  describe('getAttendanceStats', () => {
    it('should retrieve attendance stats successfully', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
      });
      const res = MockResponse.create();
      const mockStats = {
        total: 10,
        confirmed: 8,
        noShow: 1,
        pending: 1,
      };
      mockAttendanceService.getActivityAttendanceStats.mockResolvedValue(mockStats);

      await controller.getAttendanceStats(req, res);

      expect(mockAttendanceService.getActivityAttendanceStats).toHaveBeenCalledWith('activity-123');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockStats,
        })
      );
    });
  });

  describe('getUserHistory', () => {
    it('should retrieve user attendance history with default monthsBack', async () => {
      const req = createRequest({
        params: { userId: 'user-123' },
        query: {},
      });
      const res = MockResponse.create();
      const mockHistory = {
        attendedCount: 15,
        noShowCount: 2,
        rate: 0.88,
      };
      mockAttendanceService.getUserAttendanceHistory.mockResolvedValue(mockHistory as any);

      await controller.getUserHistory(req, res);

      expect(mockAttendanceService.getUserAttendanceHistory).toHaveBeenCalledWith('user-123', 6);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockHistory,
        })
      );
    });

    it('should use custom monthsBack if provided', async () => {
      const req = createRequest({
        params: { userId: 'user-123' },
        query: { monthsBack: '12' },
      });
      const res = MockResponse.create();
      mockAttendanceService.getUserAttendanceHistory.mockResolvedValue({} as any);

      await controller.getUserHistory(req, res);

      expect(mockAttendanceService.getUserAttendanceHistory).toHaveBeenCalledWith('user-123', 12);
    });
  });

  describe('getAttendanceReport', () => {
    it('should generate attendance report successfully', async () => {
      const req = createRequest({
        params: { activityId: 'activity-123' },
      });
      const res = MockResponse.create();
      const mockReport = {
        activityId: 'activity-123',
        totalParticipants: 20,
        attendanceRate: 0.95,
        breakdown: { confirmed: 19, noShow: 1 },
      };
      mockAttendanceService.generateAttendanceReport.mockResolvedValue(mockReport);

      await controller.getAttendanceReport(req, res);

      expect(mockAttendanceService.generateAttendanceReport).toHaveBeenCalledWith('activity-123');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockReport,
        })
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should retrieve leaderboard with default parameters', async () => {
      const req = createRequest({
        params: { organizationId: 'org-123' },
        query: {},
      });
      const res = MockResponse.create();
      const mockLeaderboard = [
        { userId: 'user-1', score: 100, rank: 1 },
        { userId: 'user-2', score: 95, rank: 2 },
      ];
      mockAttendanceService.getAttendanceLeaderboard.mockResolvedValue(mockLeaderboard);

      await controller.getLeaderboard(req, res);

      expect(mockAttendanceService.getAttendanceLeaderboard).toHaveBeenCalledWith('org-123', 3, 10);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockLeaderboard,
        })
      );
    });

    it('should use custom monthsBack and limit if provided', async () => {
      const req = createRequest({
        params: { organizationId: 'org-123' },
        query: { monthsBack: '6', limit: '20' },
      });
      const res = MockResponse.create();
      mockAttendanceService.getAttendanceLeaderboard.mockResolvedValue([]);

      await controller.getLeaderboard(req, res);

      expect(mockAttendanceService.getAttendanceLeaderboard).toHaveBeenCalledWith('org-123', 6, 20);
    });
  });

  describe('addRating', () => {
    it('should add performance rating successfully', async () => {
      const req = createRequest({
        params: { confirmationId: 'confirm-123' },
        body: { rating: 5, comment: 'Excellent performance' },
      });
      const res = MockResponse.create();
      const mockConfirmation = { id: 'confirm-123', rating: 5 };
      mockAttendanceService.addPerformanceRating.mockResolvedValue(mockConfirmation as any);

      await controller.addRating(req, res);

      expect(mockAttendanceService.addPerformanceRating).toHaveBeenCalledWith(
        'confirm-123',
        { rating: 5, comment: 'Excellent performance' },
        'test-user-id'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Performance rating added',
          data: mockConfirmation,
        })
      );
    });

    it('should return 401 if user not authenticated', async () => {
      const req = MockRequest.create({
        params: { confirmationId: 'confirm-123' },
        body: { rating: 5 },
      });
      const res = MockResponse.create();

      await controller.addRating(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle service errors', async () => {
      const req = createRequest({
        params: { confirmationId: 'confirm-123' },
        body: { rating: 5 },
      });
      const res = MockResponse.create();
      mockAttendanceService.addPerformanceRating.mockRejectedValue(new Error('Rating error'));

      await controller.addRating(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
