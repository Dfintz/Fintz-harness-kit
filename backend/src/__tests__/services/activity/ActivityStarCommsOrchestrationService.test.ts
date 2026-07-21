import { ActivityStatus, ActivityType } from '../../../models/Activity';
import { IntegrationType } from '../../../models/ExternalIntegration';
import { ActivityParticipantService } from '../../../services/activity/ActivityParticipantService';
import { ActivityService } from '../../../services/activity/ActivityService';
import { ActivityStarCommsOrchestrationService } from '../../../services/activity/ActivityStarCommsOrchestrationService';
import { StarCommsAdapter } from '../../../services/communication/starcomms';
import { ExternalIntegrationService } from '../../../services/external/ExternalIntegrationService';
import { FleetService } from '../../../services/fleet/FleetService';

jest.mock('../../../services/activity/ActivityService');
jest.mock('../../../services/activity/ActivityParticipantService');
jest.mock('../../../services/external/ExternalIntegrationService');
jest.mock('../../../services/fleet/FleetService');
jest.mock('../../../services/communication/starcomms', () => ({
  StarCommsAdapter: jest.fn().mockImplementation(() => ({
    buildConnectionConfig: jest.fn(() => ({ baseUrl: 'https://starcomms.example.com' })),
    ensureOperationFromActivity: jest.fn(async () => ({ success: true, operationId: 'op-123' })),
    syncAssignments: jest.fn(async () => ({ success: true, message: 'ok' })),
  })),
}));

describe('ActivityStarCommsOrchestrationService', () => {
  let service: ActivityStarCommsOrchestrationService;
  let mockActivityService: jest.Mocked<ActivityService>;
  let mockParticipantService: jest.Mocked<ActivityParticipantService>;
  let mockIntegrationService: jest.Mocked<ExternalIntegrationService>;
  let mockFleetService: jest.Mocked<FleetService>;
  let mockAdapter: jest.Mocked<StarCommsAdapter>;

  beforeEach(() => {
    service = new ActivityStarCommsOrchestrationService();

    mockActivityService = (service as unknown as { activityService: jest.Mocked<ActivityService> })
      .activityService;
    mockParticipantService = (
      service as unknown as { participantService: jest.Mocked<ActivityParticipantService> }
    ).participantService;
    mockIntegrationService = (
      service as unknown as { integrationService: jest.Mocked<ExternalIntegrationService> }
    ).integrationService;
    mockFleetService = (service as unknown as { fleetService: jest.Mocked<FleetService> })
      .fleetService;
    mockAdapter = (service as unknown as { starCommsAdapter: jest.Mocked<StarCommsAdapter> })
      .starCommsAdapter;

    jest.clearAllMocks();

    mockActivityService.getActivityById.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Operation Nightfall',
      description: 'Test activity',
      activityType: ActivityType.COMBAT,
      status: ActivityStatus.SCHEDULED,
      creatorId: 'creator-1',
      organizationId: 'org-1',
    } as never);

    mockParticipantService.canManageActivity.mockResolvedValue(true);
    mockParticipantService.getParticipantCount.mockResolvedValue(3);
    mockParticipantService.getParticipants.mockResolvedValue([
      {
        userId: 'user-1',
        userName: 'Alpha',
        role: 'leader',
      },
    ] as never);

    mockIntegrationService.getIntegrationById.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      fleetId: 'fleet-1',
      type: IntegrationType.STARCOMMS,
      enabled: true,
      starCommsConfig: { baseUrl: 'https://starcomms.example.com' },
    } as never);

    mockFleetService.getFleetById.mockResolvedValue({ id: 'fleet-1' } as never);
  });

  it('should return dry run result without write calls', async () => {
    const result = await service.provisionFromActivity({
      activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId: 'user-99',
      userName: 'Commander',
      organizationId: 'org-1',
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.operation.success).toBe(true);
    expect(mockAdapter.ensureOperationFromActivity).not.toHaveBeenCalled();
    expect(mockAdapter.syncAssignments).not.toHaveBeenCalled();
  });

  it('should provision operation and sync assignments when not dry run', async () => {
    const result = await service.provisionFromActivity({
      activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId: 'user-99',
      userName: 'Commander',
      organizationId: 'org-1',
      dryRun: false,
    });

    expect(result.dryRun).toBe(false);
    expect(result.operation.success).toBe(true);
    expect(result.assignments.synced).toBe(true);
    expect(mockAdapter.ensureOperationFromActivity).toHaveBeenCalled();
    expect(mockAdapter.syncAssignments).toHaveBeenCalled();
  });

  it('should reject when requester is not creator and cannot manage activity', async () => {
    mockParticipantService.canManageActivity.mockResolvedValue(false);

    await expect(
      service.provisionFromActivity({
        activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: 'user-99',
        userName: 'Commander',
        organizationId: 'org-1',
      })
    ).rejects.toThrow('Only activity leaders can provision StarComms operations');
  });

  it('should reject when activity belongs to a different organization', async () => {
    mockActivityService.getActivityById.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Operation Nightfall',
      description: 'Test activity',
      activityType: ActivityType.COMBAT,
      status: ActivityStatus.SCHEDULED,
      creatorId: 'creator-1',
      organizationId: 'org-2',
    } as never);

    await expect(
      service.provisionFromActivity({
        activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: 'creator-1',
        userName: 'Commander',
        organizationId: 'org-1',
      })
    ).rejects.toThrow('Activity');
  });

  it('should reject when integration is disabled', async () => {
    mockIntegrationService.getIntegrationById.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      fleetId: 'fleet-1',
      type: IntegrationType.STARCOMMS,
      enabled: false,
      starCommsConfig: { baseUrl: 'https://starcomms.example.com' },
    } as never);

    await expect(
      service.provisionFromActivity({
        activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: 'creator-1',
        userName: 'Commander',
        organizationId: 'org-1',
      })
    ).rejects.toThrow('Integration is disabled');
  });

  it('should reject when integration is not starcomms', async () => {
    mockIntegrationService.getIntegrationById.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      fleetId: 'fleet-1',
      type: IntegrationType.WEBHOOK,
      enabled: true,
      apiConfig: { baseUrl: 'https://example.com', endpoints: {} },
    } as never);

    await expect(
      service.provisionFromActivity({
        activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: 'creator-1',
        userName: 'Commander',
        organizationId: 'org-1',
      })
    ).rejects.toThrow('Integration is not configured as StarComms');
  });
});
