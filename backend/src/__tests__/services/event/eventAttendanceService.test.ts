/**
 * EventAttendanceService (AttendanceConfirmationService) Tests
 *
 * Tests for post-event attendance confirmation and tracking:
 * - Initialize attendance for activities
 * - Record / confirm attendance
 * - Mark no-shows (excused and unexcused)
 * - Send confirmation requests
 * - Auto-confirm no-shows for old activities
 * - Attendance statistics and user history
 * - Performance ratings
 * - Attendance leaderboard
 * - Report generation
 */

jest.mock('../../../data-source', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { Activity, ActivityType } from '../../../models/Activity';
import { ActivityParticipantEntity } from '../../../models/ActivityParticipant';
import { AttendanceStatus } from '../../../models/EventAttendanceConfirmation';
import { AttendanceConfirmationService } from '../../../services/event/EventAttendanceService';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------
function createMockRepository() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn().mockImplementation((entity: any) => Promise.resolve({ ...entity })),
    create: jest.fn().mockImplementation((data: any) => ({ ...data })),
    createQueryBuilder: jest.fn(),
    metadata: { name: 'EventAttendanceConfirmation' },
  };
}

function createMockActivityRepository() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createMockParticipantRepository() {
  return {
    find: jest.fn().mockResolvedValue([
      { userId: 'pilot-alpha', role: 'Wing Leader' },
      { userId: 'pilot-bravo', role: 'Wingman' },
    ]),
  };
}

function createMockNotificationService() {
  return {
    sendDiscordNotification: jest.fn().mockResolvedValue(undefined),
    createAttendanceConfirmationEmbed: jest.fn().mockReturnValue({ title: 'embed' }),
  };
}

function buildActivity(overrides: Record<string, any> = {}) {
  return {
    id: 'activity-xeno-raid-001',
    title: 'Xenothreat Raid',
    activityType: ActivityType.EVENT,
    organizationId: 'org-uee-navy',
    maxParticipants: 20,
    scheduledEndDate: new Date('2025-12-01T20:00:00Z'),
    participants: [
      { userId: 'pilot-alpha', status: 'accepted', role: 'Wing Leader' },
      { userId: 'pilot-bravo', status: 'accepted', role: 'Wingman' },
      { userId: 'pilot-charlie', status: 'declined', role: 'Support' },
    ],
    ...overrides,
  };
}

function buildConfirmation(overrides: Record<string, any> = {}) {
  return {
    id: 'conf-001',
    eventId: 'activity-xeno-raid-001',
    userId: 'pilot-alpha',
    organizationId: 'org-uee-navy',
    status: AttendanceStatus.PENDING_CONFIRMATION,
    notificationSent: false,
    rsvpStatus: 'accepted',
    rsvpRole: 'Wing Leader',
    excusedAbsence: false,
    absenceReason: undefined,
    performanceRating: undefined,
    getAttendanceScore: jest.fn().mockReturnValue(100),
    ...overrides,
  };
}

describe('AttendanceConfirmationService', () => {
  let service: AttendanceConfirmationService;
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockActivityRepo: ReturnType<typeof createMockActivityRepository>;
  let mockParticipantRepo: ReturnType<typeof createMockParticipantRepository>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepo = createMockRepository();
    mockActivityRepo = createMockActivityRepository();
    mockParticipantRepo = createMockParticipantRepository();
    mockNotificationService = createMockNotificationService();

    const { AppDataSource } = require('../../../data-source');
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === ActivityParticipantEntity) return mockParticipantRepo;
      if (entity === Activity) return mockActivityRepo;
      return mockRepo; // EventAttendanceConfirmation
    });

    service = new AttendanceConfirmationService(mockNotificationService as any);
  });

  // ------------------------------------------------------------------
  // initializeActivityAttendance
  // ------------------------------------------------------------------
  describe('initializeActivityAttendance', () => {
    it('should create confirmation records for accepted participants only', async () => {
      const activity = buildActivity();
      mockActivityRepo.findOne.mockResolvedValue(activity);
      mockRepo.create.mockImplementation((data: any) => ({ ...data }));
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve({ id: `conf-${Math.random()}`, ...entity }));

      const results = await service.initializeActivityAttendance('activity-xeno-raid-001');

      // Only 2 accepted participants (pilot-alpha + pilot-bravo)
      expect(results).toHaveLength(2);
      expect(mockRepo.create).toHaveBeenCalledTimes(2);
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should throw if activity not found', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      await expect(
        service.initializeActivityAttendance('missing-activity')
      ).rejects.toThrow('Activity not found');
    });

    it('should throw if activity is not EVENT type', async () => {
      mockActivityRepo.findOne.mockResolvedValue(
        buildActivity({ activityType: ActivityType.MISSION })
      );

      await expect(
        service.initializeActivityAttendance('activity-xeno-raid-001')
      ).rejects.toThrow('Attendance tracking is only available for EVENT type activities');
    });

    it('should handle activity with no participants', async () => {
      mockActivityRepo.findOne.mockResolvedValue(buildActivity());
      mockParticipantRepo.find.mockResolvedValue([]);

      const results = await service.initializeActivityAttendance('activity-xeno-raid-001');
      expect(results).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------
  // recordAttendance
  // ------------------------------------------------------------------
  describe('recordAttendance', () => {
    it('should update existing confirmation record', async () => {
      const existing = buildConfirmation();
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const result = await service.recordAttendance('activity-xeno-raid-001', {
        userId: 'pilot-alpha',
        organizationId: 'org-uee-navy',
        status: AttendanceStatus.ATTENDED,
        actualRole: 'Squadron Leader',
        confirmedBy: 'admin-01',
        checkInTime: new Date('2025-12-01T18:00:00Z'),
      });

      expect(result.status).toBe(AttendanceStatus.ATTENDED);
      expect(result.actualRole).toBe('Squadron Leader');
      expect(result.confirmedBy).toBe('admin-01');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should create new confirmation if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((data: any) => ({ ...data }));
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const result = await service.recordAttendance('activity-xeno-raid-001', {
        userId: 'pilot-delta',
        organizationId: 'org-uee-navy',
        status: AttendanceStatus.ATTENDED,
      });

      expect(mockRepo.create).toHaveBeenCalled();
      expect(result.userId).toBe('pilot-delta');
    });

    it('should calculate duration when check-in and check-out are provided', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((data: any) => ({ ...data }));
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const checkIn = new Date('2025-12-01T18:00:00Z');
      const checkOut = new Date('2025-12-01T20:30:00Z');

      const result = await service.recordAttendance('activity-xeno-raid-001', {
        userId: 'pilot-alpha',
        organizationId: 'org-uee-navy',
        status: AttendanceStatus.ATTENDED,
        checkInTime: checkIn,
        checkOutTime: checkOut,
      });

      expect(result.durationMinutes).toBe(150); // 2.5 hours
    });
  });

  // ------------------------------------------------------------------
  // confirmAttendance
  // ------------------------------------------------------------------
  describe('confirmAttendance', () => {
    it('should record attendance with ATTENDED status', async () => {
      mockRepo.findOne.mockResolvedValue(buildConfirmation());
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const result = await service.confirmAttendance(
        'activity-xeno-raid-001',
        'pilot-alpha',
        'org-uee-navy',
        'Wing Leader',
        'admin-01'
      );

      expect(result.status).toBe(AttendanceStatus.ATTENDED);
      expect(result.confirmedBy).toBe('admin-01');
    });

    it('should default confirmedBy to userId when not provided', async () => {
      mockRepo.findOne.mockResolvedValue(buildConfirmation());
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const result = await service.confirmAttendance(
        'activity-xeno-raid-001',
        'pilot-alpha',
        'org-uee-navy'
      );

      expect(result.confirmedBy).toBe('pilot-alpha');
    });
  });

  // ------------------------------------------------------------------
  // markNoShow
  // ------------------------------------------------------------------
  describe('markNoShow', () => {
    it('should mark as no-show with reason', async () => {
      mockRepo.findOne.mockResolvedValue(buildConfirmation());
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const result = await service.markNoShow(
        'activity-xeno-raid-001',
        'pilot-bravo',
        'org-uee-navy',
        false,
        'Did not respond to comms',
        'admin-01'
      );

      expect(result.status).toBe(AttendanceStatus.NO_SHOW);
      expect(result.excusedAbsence).toBe(false);
      expect(result.absenceReason).toBe('Did not respond to comms');
    });

    it('should mark as excused no-show', async () => {
      mockRepo.findOne.mockResolvedValue(buildConfirmation());
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const result = await service.markNoShow(
        'activity-xeno-raid-001',
        'pilot-bravo',
        'org-uee-navy',
        true,
        'Emergency IRL'
      );

      expect(result.excusedAbsence).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // sendConfirmationRequests
  // ------------------------------------------------------------------
  describe('sendConfirmationRequests', () => {
    it('should throw if activity not found', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      await expect(
        service.sendConfirmationRequests('missing')
      ).rejects.toThrow('Activity not found');
    });

    it('should throw if event has not ended yet', async () => {
      mockActivityRepo.findOne.mockResolvedValue(
        buildActivity({ scheduledEndDate: new Date(Date.now() + 86400000) })
      );

      await expect(
        service.sendConfirmationRequests('activity-xeno-raid-001')
      ).rejects.toThrow('Cannot request confirmation for future or ongoing activities');
    });

    it('should send notifications to pending confirmations', async () => {
      const pastDate = new Date('2025-11-01T20:00:00Z');
      mockActivityRepo.findOne.mockResolvedValue(buildActivity({ scheduledEndDate: pastDate }));
      mockRepo.find.mockResolvedValue([
        buildConfirmation({ notificationSent: false }),
        buildConfirmation({ id: 'conf-002', userId: 'pilot-bravo', notificationSent: false }),
      ]);
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const count = await service.sendConfirmationRequests('activity-xeno-raid-001');

      expect(count).toBe(2);
      expect(mockNotificationService.sendDiscordNotification).toHaveBeenCalledTimes(2);
    });

    it('should skip already-notified confirmations', async () => {
      const pastDate = new Date('2025-11-01T20:00:00Z');
      mockActivityRepo.findOne.mockResolvedValue(buildActivity({ scheduledEndDate: pastDate }));
      mockRepo.find.mockResolvedValue([
        buildConfirmation({ notificationSent: true }),
      ]);

      const count = await service.sendConfirmationRequests('activity-xeno-raid-001');

      expect(count).toBe(0);
      expect(mockNotificationService.sendDiscordNotification).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // autoConfirmNoShows
  // ------------------------------------------------------------------
  describe('autoConfirmNoShows', () => {
    it('should auto-confirm pending confirmations for old activities', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          buildActivity({ id: 'old-event-1' }),
        ]),
      };
      mockActivityRepo.createQueryBuilder.mockReturnValue(qb);
      mockRepo.find.mockResolvedValue([
        buildConfirmation({ eventId: 'old-event-1' }),
      ]);
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const count = await service.autoConfirmNoShows(7);

      expect(count).toBe(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AttendanceStatus.NO_SHOW,
          autoConfirmed: true,
          confirmedBy: 'system',
        })
      );
    });

    it('should return 0 when no old activities exist', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockActivityRepo.createQueryBuilder.mockReturnValue(qb);

      const count = await service.autoConfirmNoShows(7);
      expect(count).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // getActivityAttendanceStats
  // ------------------------------------------------------------------
  describe('getActivityAttendanceStats', () => {
    it('should calculate correct attendance stats', async () => {
      mockRepo.find.mockResolvedValue([
        buildConfirmation({ status: AttendanceStatus.ATTENDED }),
        buildConfirmation({ status: AttendanceStatus.ATTENDED }),
        buildConfirmation({ status: AttendanceStatus.NO_SHOW }),
        buildConfirmation({ status: AttendanceStatus.LATE }),
        buildConfirmation({ status: AttendanceStatus.EARLY_DEPARTURE }),
        buildConfirmation({ status: AttendanceStatus.PENDING_CONFIRMATION }),
      ]);

      const stats = await service.getActivityAttendanceStats('activity-xeno-raid-001');

      expect(stats.total).toBe(6);
      expect(stats.attended).toBe(2);
      expect(stats.noShow).toBe(1);
      expect(stats.late).toBe(1);
      expect(stats.earlyDeparture).toBe(1);
      expect(stats.pending).toBe(1);
      // attendanceRate = (2 + 1 + 1) / 6 * 100 = 67
      expect(stats.attendanceRate).toBe(67);
    });

    it('should return zero stats for empty event', async () => {
      mockRepo.find.mockResolvedValue([]);

      const stats = await service.getActivityAttendanceStats('empty-event');

      expect(stats.total).toBe(0);
      expect(stats.attendanceRate).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // getUserAttendanceHistory
  // ------------------------------------------------------------------
  describe('getUserAttendanceHistory', () => {
    it('should compute reliability score based on attendance', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          buildConfirmation({ status: AttendanceStatus.ATTENDED }),
          buildConfirmation({ status: AttendanceStatus.ATTENDED }),
          buildConfirmation({ status: AttendanceStatus.LATE }),
          buildConfirmation({ status: AttendanceStatus.NO_SHOW, excusedAbsence: false }),
        ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const history = await service.getUserAttendanceHistory('pilot-alpha', 6, 'org-uee-navy');

      expect(history.totalEvents).toBe(4);
      expect(history.attended).toBe(2);
      expect(history.late).toBe(1);
      expect(history.noShows).toBe(1);
      // reliabilityScore = (2 + 1) / 4 * 100 = 75
      expect(history.reliabilityScore).toBe(75);
    });

    it('should count excused absences separately', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          buildConfirmation({ status: AttendanceStatus.NO_SHOW, excusedAbsence: true }),
        ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const history = await service.getUserAttendanceHistory('pilot-alpha', 6, 'org-uee-navy');

      expect(history.excusedAbsences).toBe(1);
      expect(history.noShows).toBe(0);
    });

    it('should calculate average performance rating', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          buildConfirmation({
            status: AttendanceStatus.ATTENDED,
            performanceRating: { reliability: 90 },
          }),
          buildConfirmation({
            status: AttendanceStatus.ATTENDED,
            performanceRating: { reliability: 80 },
          }),
        ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const history = await service.getUserAttendanceHistory('pilot-alpha', 6, 'org-uee-navy');

      expect(history.averageRating).toBe(85);
    });
  });

  // ------------------------------------------------------------------
  // addPerformanceRating
  // ------------------------------------------------------------------
  describe('addPerformanceRating', () => {
    it('should add performance rating to confirmation', async () => {
      mockRepo.findOne.mockResolvedValue(buildConfirmation());
      mockRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const result = await service.addPerformanceRating(
        'conf-001',
        { reliability: 95, teamwork: 88, comments: 'Great pilot' },
        'admin-01'
      );

      expect(result.performanceRating).toEqual({ reliability: 95, teamwork: 88, comments: 'Great pilot' });
      expect(result.feedbackFromOrganizer).toBe('Great pilot');
    });

    it('should throw if confirmation not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addPerformanceRating('missing-conf', { reliability: 50 }, 'admin-01')
      ).rejects.toThrow('Confirmation record not found');
    });
  });

  // ------------------------------------------------------------------
  // getAttendanceLeaderboard
  // ------------------------------------------------------------------
  describe('getAttendanceLeaderboard', () => {
    it('should return empty array when no activities exist', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockActivityRepo.createQueryBuilder.mockReturnValue(qb);

      const leaderboard = await service.getAttendanceLeaderboard('org-uee-navy', 3, 10);
      expect(leaderboard).toEqual([]);
    });

    it('should rank users by reliability score', async () => {
      const actQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'evt-1' },
          { id: 'evt-2' },
        ]),
      };
      mockActivityRepo.createQueryBuilder.mockReturnValue(actQb);

      const confQb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          // pilot-alpha attended both
          buildConfirmation({ userId: 'pilot-alpha', status: AttendanceStatus.ATTENDED }),
          buildConfirmation({ userId: 'pilot-alpha', eventId: 'evt-2', status: AttendanceStatus.ATTENDED }),
          // pilot-bravo attended 1, no-show 1
          buildConfirmation({ userId: 'pilot-bravo', status: AttendanceStatus.ATTENDED }),
          buildConfirmation({ userId: 'pilot-bravo', eventId: 'evt-2', status: AttendanceStatus.NO_SHOW }),
        ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(confQb);

      const leaderboard = await service.getAttendanceLeaderboard('org-uee-navy', 3, 10);

      expect(leaderboard.length).toBe(2);
      // pilot-alpha (100%) should be above pilot-bravo (50%)
      expect(leaderboard[0].userId).toBe('pilot-alpha');
      expect(leaderboard[0].reliabilityScore).toBe(100);
      expect(leaderboard[1].userId).toBe('pilot-bravo');
      expect(leaderboard[1].reliabilityScore).toBe(50);
    });
  });

  // ------------------------------------------------------------------
  // generateAttendanceReport
  // ------------------------------------------------------------------
  describe('generateAttendanceReport', () => {
    it('should throw if activity not found', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateAttendanceReport('missing')
      ).rejects.toThrow('Activity not found');
    });

    it('should generate a report with stats and attendees', async () => {
      mockActivityRepo.findOne.mockResolvedValue(buildActivity());
      mockRepo.find
        .mockResolvedValueOnce([
          buildConfirmation({ status: AttendanceStatus.ATTENDED }),
          buildConfirmation({ status: AttendanceStatus.NO_SHOW }),
        ])
        .mockResolvedValueOnce([
          buildConfirmation({ status: AttendanceStatus.ATTENDED }),
          buildConfirmation({ status: AttendanceStatus.NO_SHOW }),
        ]);

      const report = await service.generateAttendanceReport('activity-xeno-raid-001');

      expect(report.activity).toBeDefined();
      expect(report.stats).toBeDefined();
      expect(report.attendees).toHaveLength(2);
      expect(report.attendees[0]).toHaveProperty('attendanceScore');
    });
  });

  // ------------------------------------------------------------------
  // getAttendanceRecordsForActivity
  // ------------------------------------------------------------------
  describe('getAttendanceRecordsForActivity', () => {
    it('should return records scoped to organization', async () => {
      const records = [buildConfirmation(), buildConfirmation({ id: 'conf-002' })];
      mockRepo.find.mockResolvedValue(records);

      const result = await service.getAttendanceRecordsForActivity(
        'activity-xeno-raid-001',
        'org-uee-navy'
      );

      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { eventId: 'activity-xeno-raid-001', organizationId: 'org-uee-navy' },
      });
    });
  });
});
