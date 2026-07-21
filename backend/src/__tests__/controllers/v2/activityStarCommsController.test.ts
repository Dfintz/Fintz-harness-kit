import { Request, Response } from 'express';

import { ActivityStarCommsController } from '../../../controllers/v2/activityStarCommsController';
import { ActivityStarCommsOrchestrationService } from '../../../services/activity/ActivityStarCommsOrchestrationService';

jest.mock('../../../services/activity/ActivityStarCommsOrchestrationService');

describe('ActivityStarCommsController', () => {
  let controller: ActivityStarCommsController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockService: jest.Mocked<ActivityStarCommsOrchestrationService>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      params: { activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      body: {
        integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        dryRun: true,
      },
      user: {
        id: 'user-1',
        username: 'Commander',
        currentOrganizationId: 'org-1',
      },
    } as unknown as Partial<Request>;

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    controller = new ActivityStarCommsController();
    mockService = (
      controller as unknown as {
        orchestrationService: jest.Mocked<ActivityStarCommsOrchestrationService>;
      }
    ).orchestrationService;

    jest.clearAllMocks();

    mockService.provisionFromActivity.mockResolvedValue({
      activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      dryRun: true,
      operation: {
        success: true,
        operationId: 'op-1',
      },
      assignments: {
        synced: false,
        participantCount: 2,
      },
    });
  });

  it('should execute provisioning and return payload', async () => {
    await controller.provisionFromActivity(mockRequest as Request, mockResponse as Response);

    expect(mockService.provisionFromActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        integrationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        dryRun: true,
        userId: 'user-1',
        organizationId: 'org-1',
      })
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })
    );
  });

  it('should return 400 when activityId is invalid', async () => {
    mockRequest.params = { activityId: 'not-a-uuid' };

    await controller.provisionFromActivity(mockRequest as Request, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(mockService.provisionFromActivity).not.toHaveBeenCalled();
  });
});
