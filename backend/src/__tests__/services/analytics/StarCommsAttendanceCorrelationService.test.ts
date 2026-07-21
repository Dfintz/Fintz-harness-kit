import { AppDataSource } from '../../../data-source';
import { AttendanceStatus } from '../../../models/EventAttendanceConfirmation';
import { StarCommsAttendanceCorrelationService } from '../../../services/analytics/StarCommsAttendanceCorrelationService';
import { StarCommsAdapter } from '../../../services/communication/starcomms/StarCommsAdapter';
import { ExternalIntegrationService } from '../../../services/external/ExternalIntegrationService';
import { FleetService } from '../../../services/fleet/FleetService';

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('StarCommsAttendanceCorrelationService', () => {
  let service: StarCommsAttendanceCorrelationService;
  let mockFleetService: jest.Mocked<FleetService>;
  let mockIntegrationService: jest.Mocked<ExternalIntegrationService>;
  let mockAdapter: jest.Mocked<StarCommsAdapter>;
  let activityQueryBuilder: Record<string, jest.Mock>;
  let confirmationQueryBuilder: Record<string, jest.Mock>;
  let participantQueryBuilder: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();

    activityQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'activity-1',
          title: 'Fleet Op',
          activityType: 'event',
          status: 'completed',
          scheduledStartDate: new Date('2026-07-01T10:00:00.000Z'),
          scheduledEndDate: new Date('2026-07-01T12:00:00.000Z'),
          createdAt: new Date('2026-07-01T09:00:00.000Z'),
        },
      ]),
    };

    confirmationQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { eventId: 'activity-1', status: AttendanceStatus.ATTENDED, userId: 'user-1' },
        { eventId: 'activity-1', status: AttendanceStatus.LATE, userId: 'user-2' },
      ]),
    };

    participantQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { activityId: 'activity-1', role: 'leader', status: 'accepted' },
        { activityId: 'activity-1', role: 'pilot', status: 'accepted' },
      ]),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity?.name === 'Activity') {
        return { createQueryBuilder: jest.fn(() => activityQueryBuilder) };
      }

      if (entity?.name === 'EventAttendanceConfirmation') {
        return { createQueryBuilder: jest.fn(() => confirmationQueryBuilder) };
      }

      if (entity?.name === 'ActivityParticipantEntity') {
        return { createQueryBuilder: jest.fn(() => participantQueryBuilder) };
      }

      return null;
    });

    mockFleetService = {
      getAllFleets: jest.fn().mockResolvedValue([{ id: 'fleet-1', name: 'Fleet One' }]),
    } as unknown as jest.Mocked<FleetService>;

    mockIntegrationService = {
      getIntegrations: jest.fn().mockResolvedValue([
        {
          id: 'integration-1',
          fleetId: 'fleet-1',
          name: 'StarComms',
          enabled: true,
          type: 'starcomms',
          starCommsConfig: { baseUrl: 'https://starcomms.example.com' },
        },
      ]),
    } as unknown as jest.Mocked<ExternalIntegrationService>;

    mockAdapter = {
      buildConnectionConfig: jest
        .fn()
        .mockReturnValue({ baseUrl: 'https://starcomms.example.com' }),
      getMetricsWindow: jest.fn().mockResolvedValue({
        attendanceRate: 88,
        activeParticipants: 2,
        avgSessionMinutes: 45,
        window: {
          startDate: '2026-07-01T10:00:00.000Z',
          endDate: '2026-07-01T12:00:00.000Z',
          windowMinutes: 120,
        },
        raw: {},
      }),
    } as unknown as jest.Mocked<StarCommsAdapter>;

    service = new StarCommsAttendanceCorrelationService(
      mockFleetService,
      mockIntegrationService,
      mockAdapter
    );
  });

  it('should build a correlated report with StarComms metrics when integration exists', async () => {
    const report = await service.getReport('org-1', {
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-02T00:00:00.000Z'),
    });

    expect(mockFleetService.getAllFleets).toHaveBeenCalledWith('org-1');
    expect(mockIntegrationService.getIntegrations).toHaveBeenCalledWith('fleet-1');
    expect(mockAdapter.getMetricsWindow).toHaveBeenCalled();
    expect(report.totalActivities).toBe(1);
    expect(report.totalConfirmations).toBe(2);
    expect(report.attendanceRate).toBe(100);
    expect(report.starComms.available).toBe(true);
    expect(report.activities[0]).toEqual(
      expect.objectContaining({
        activityId: 'activity-1',
        participantCount: 2,
        attended: 1,
        late: 1,
        attendanceRate: 100,
      })
    );
  });

  it('should fall back to attendance-only reporting when no integration exists', async () => {
    mockIntegrationService.getIntegrations.mockResolvedValue([]);

    const report = await service.getActivityReport('org-1', 'activity-1');

    expect(report.starComms.available).toBe(false);
    expect(report.activities).toHaveLength(1);
    expect(report.activities[0].activityId).toBe('activity-1');
  });

  it('should serialize the report to csv', async () => {
    const report = await service.getActivityReport('org-1', 'activity-1');
    const csv = service.toCsv(report);

    expect(csv).toContain('activityId,activityTitle,activityType');
    expect(csv).toContain('activity-1');
    expect(csv).toContain('starCommsAvailable');
  });
});
