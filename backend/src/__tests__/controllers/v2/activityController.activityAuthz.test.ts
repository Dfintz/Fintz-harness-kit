/// <reference types="jest" />

import { Request, Response } from 'express';

import { ActivityControllerV2 } from '../../../controllers/v2/activityController';
import { ApiErrorCode } from '../../../types/api';

type MockAuthUser = {
  id: string;
  username?: string;
  currentOrganizationId?: string;
};

type MockRequest = Partial<Request> & {
  user?: MockAuthUser;
};

const mockCreateActivityWithParticipants = jest.fn();
const mockCompleteActivity = jest.fn();
const mockCompletePersonalActivity = jest.fn();
const mockCancelActivity = jest.fn();
const mockCancelActivityAsSystem = jest.fn();
const mockSubmitCompletionReport = jest.fn();
const mockUpdateParticipant = jest.fn();
const mockGetParticipants = jest.fn();

const mockCanUserAccessOrganization = jest.fn();

jest.mock('../../../services/aggregators/ActivityAggregatorService', () => ({
  ActivityAggregatorService: jest.fn().mockImplementation(() => ({
    createActivityWithParticipants: mockCreateActivityWithParticipants,
    completeActivity: mockCompleteActivity,
    completePersonalActivity: mockCompletePersonalActivity,
  })),
}));

jest.mock('../../../services/organization/OrganizationService', () => ({
  OrganizationService: jest.fn().mockImplementation(() => ({
    canUserAccessOrganization: mockCanUserAccessOrganization,
    getOrganizationById: jest.fn(),
  })),
}));

jest.mock('../../../services/activity/ActivityParticipantService', () => ({
  ActivityParticipantService: jest.fn().mockImplementation(() => ({
    getParticipants: mockGetParticipants,
    updateParticipant: mockUpdateParticipant,
  })),
}));

jest.mock('../../../services/activity/ActivityEventService', () => ({
  ActivityEventService: jest.fn().mockImplementation(() => ({
    cancelActivity: mockCancelActivity,
    cancelActivityAsSystem: mockCancelActivityAsSystem,
    submitCompletionReport: mockSubmitCompletionReport,
  })),
}));

jest.mock('../../../services/communication/notifications/NotificationRouter', () => ({
  NotificationContext: {
    ACTIVITY_COMPLETED: 'activity_completed',
    ACTIVITY_CANCELLED: 'activity_cancelled',
  },
  NotificationRouter: jest.fn().mockImplementation(() => ({
    notifyOrganization: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../websocket/controllers/activityWebSocketController', () => ({
  emitActivityCreated: jest.fn(),
  emitActivityDeleted: jest.fn(),
  emitActivityUpdated: jest.fn(),
}));

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ActivityControllerV2 authorization guards', () => {
  let controller: ActivityControllerV2;
  let mockRequest: MockRequest;
  let mockResponse: Partial<Response>;
  let mockActivityRepository: { save: ReturnType<typeof jest.fn> };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCanUserAccessOrganization.mockResolvedValue({
      canAccess: true,
      accessLevel: 'member',
    });

    mockGetParticipants.mockResolvedValue([]);
    mockUpdateParticipant.mockResolvedValue(1);
    mockSubmitCompletionReport.mockResolvedValue({
      id: 'activity-1',
      status: 'completed',
    });
    mockCompletePersonalActivity.mockResolvedValue({
      activity: { id: 'activity-1', status: 'completed' },
      updatedParticipants: [],
      notifications: [],
      warnings: [],
    });

    mockActivityRepository = {
      save: jest.fn(),
    };

    const { AppDataSource } = require('../../../config/database');
    AppDataSource.getRepository.mockReturnValue(mockActivityRepository);

    controller = new ActivityControllerV2();

    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: {
        id: 'user-1',
        username: 'user-one',
      },
    };

    mockResponse = {
      success: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('rejects createActivityFull when requester only has viewer access', async () => {
    mockCanUserAccessOrganization.mockResolvedValue({
      canAccess: true,
      accessLevel: 'viewer',
      reason: 'Viewer access only',
    });

    mockRequest.params = { orgId: 'org-1' };
    mockRequest.body = {
      activityData: {
        title: 'Test Activity',
        activityType: 'mission',
        scheduledStartDate: new Date().toISOString(),
      },
    };

    await expect(
      controller.createActivityFull(mockRequest as Request, mockResponse as Response)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: ApiErrorCode.FORBIDDEN,
    });

    expect(mockCreateActivityWithParticipants).not.toHaveBeenCalled();
  });

  it('allows createActivityFull for members and delegates to aggregator', async () => {
    mockCanUserAccessOrganization.mockResolvedValue({
      canAccess: true,
      accessLevel: 'member',
    });

    mockCreateActivityWithParticipants.mockResolvedValue({
      activity: { id: 'activity-1' },
      participants: [],
      notifications: [],
      warnings: [],
    });

    mockRequest.params = { orgId: 'org-1' };
    mockRequest.body = {
      activityData: {
        title: 'Test Activity',
        activityType: 'mission',
        scheduledStartDate: new Date().toISOString(),
      },
      participantIds: ['user-2'],
      notifyParticipants: true,
    };

    await controller.createActivityFull(mockRequest as Request, mockResponse as Response);

    expect(mockCreateActivityWithParticipants).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        activityData: expect.objectContaining({
          creatorId: 'user-1',
        }),
      })
    );
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.success).toHaveBeenCalled();
  });

  it('rejects completeActivity when requester is not creator', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-1',
      title: 'Unauthorized completion test',
      organizationId: 'org-1',
      creatorId: 'creator-1',
      status: 'open',
    });

    mockRequest.params = { id: 'activity-1' };
    mockRequest.body = { report: 'Done' };
    mockRequest.user = { id: 'user-1', username: 'user-one' };

    await expect(
      controller.completeActivity(mockRequest as Request, mockResponse as Response)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: ApiErrorCode.FORBIDDEN,
    });

    expect(mockActivityRepository.save).not.toHaveBeenCalled();
  });

  it('allows completeActivity when requester is creator and has organization access', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-1',
      title: 'Creator completion test',
      organizationId: 'org-1',
      creatorId: 'user-1',
      status: 'open',
    });

    mockRequest.params = { id: 'activity-1' };
    mockRequest.body = { report: 'Completed successfully', attendanceCount: 2 };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: 'org-1',
    };

    await controller.completeActivity(mockRequest as Request, mockResponse as Response);

    expect(mockCanUserAccessOrganization).toHaveBeenCalledWith('user-1', 'org-1');
    expect(mockActivityRepository.save).toHaveBeenCalledTimes(1);
    expect(mockResponse.success).toHaveBeenCalled();
  });

  it('allows completeActivity for creator-owned personal activities without org access checks', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-personal-1',
      title: 'Personal completion test',
      organizationId: undefined,
      creatorId: 'user-1',
      status: 'open',
    });

    mockRequest.params = { id: 'activity-personal-1' };
    mockRequest.body = { report: 'Completed as personal activity' };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: undefined,
    };

    await controller.completeActivity(mockRequest as Request, mockResponse as Response);

    expect(mockCanUserAccessOrganization).not.toHaveBeenCalled();
    expect(mockActivityRepository.save).toHaveBeenCalledTimes(1);
    expect(mockResponse.success).toHaveBeenCalled();
  });

  it('allows completeActivity for creator-owned personal activities when active org context is present', async () => {
    const findActivityByIdSpy = jest
      .spyOn(controller as any, 'findActivityById')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'activity-personal-active-org',
        title: 'Personal completion with active org',
        organizationId: undefined,
        creatorId: 'user-1',
        status: 'open',
      });

    mockRequest.params = { id: 'activity-personal-active-org' };
    mockRequest.body = { report: 'Completed as personal activity with active org' };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: 'org-1',
    };

    await controller.completeActivity(mockRequest as Request, mockResponse as Response);

    expect(findActivityByIdSpy).toHaveBeenNthCalledWith(1, 'activity-personal-active-org', {
      organizationId: 'org-1',
    });
    expect(findActivityByIdSpy).toHaveBeenNthCalledWith(2, 'activity-personal-active-org');
    expect(mockCanUserAccessOrganization).not.toHaveBeenCalled();
    expect(mockActivityRepository.save).toHaveBeenCalledTimes(1);
    expect(mockResponse.success).toHaveBeenCalled();
  });

  it('returns not found when completion requester cannot access activity organization', async () => {
    mockCanUserAccessOrganization.mockResolvedValue({
      canAccess: false,
      accessLevel: 'none',
      reason: 'No organization membership',
    });

    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-1',
      title: 'Visibility test',
      organizationId: 'org-hidden',
      creatorId: 'user-1',
      status: 'open',
    });

    mockRequest.params = { id: 'activity-1' };
    mockRequest.body = { report: 'Done' };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: 'org-1',
    };

    await expect(
      controller.completeActivity(mockRequest as Request, mockResponse as Response)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: ApiErrorCode.ACTIVITY_NOT_FOUND,
    });

    expect(mockActivityRepository.save).not.toHaveBeenCalled();
  });

  it('rejects completeActivityFull when requester is not creator', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-1',
      title: 'Unauthorized completion full test',
      organizationId: 'org-1',
      creatorId: 'creator-1',
      status: 'open',
    });

    mockRequest.params = { id: 'activity-1' };
    mockRequest.body = {
      outcome: 'success',
      participantReports: [],
    };
    mockRequest.user = { id: 'user-1', username: 'user-one' };

    await expect(
      controller.completeActivityFull(mockRequest as Request, mockResponse as Response)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: ApiErrorCode.FORBIDDEN,
    });

    expect(mockCompleteActivity).not.toHaveBeenCalled();
  });

  it('allows completeActivityFull when requester is creator and has organization access', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-1',
      title: 'Creator completion full test',
      organizationId: 'org-1',
      creatorId: 'user-1',
      status: 'open',
    });

    mockCompleteActivity.mockResolvedValue({
      activity: { id: 'activity-1', status: 'completed' },
      updatedParticipants: [],
      notifications: [],
      warnings: [],
    });

    mockRequest.params = { id: 'activity-1' };
    mockRequest.body = {
      outcome: 'success',
      summary: 'Mission success',
      participantReports: [],
      notifyParticipants: true,
    };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: 'org-1',
    };

    await controller.completeActivityFull(mockRequest as Request, mockResponse as Response);

    expect(mockCanUserAccessOrganization).toHaveBeenCalledWith('user-1', 'org-1');
    expect(mockCompleteActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        activityId: 'activity-1',
        completedById: 'user-1',
      })
    );
    expect(mockSubmitCompletionReport).not.toHaveBeenCalled();
    expect(mockResponse.success).toHaveBeenCalled();
  });

  it('allows completeActivityFull for creator-owned personal activities via service-layer fallback path', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-personal-3',
      title: 'Personal completion full fallback test',
      organizationId: undefined,
      creatorId: 'user-1',
      status: 'open',
      currentParticipants: 2,
    });

    mockCompletePersonalActivity.mockResolvedValue({
      id: 'activity-personal-3',
      status: 'completed',
      notifications: [],
    });

    mockRequest.params = { id: 'activity-personal-3' };
    mockRequest.body = {
      outcome: 'success',
      summary: 'Personal mission success',
      participantReports: [
        { userId: 'user-1', attended: true, contribution: 'Good lead' },
        { userId: 'user-2', attended: false },
      ],
      notifyParticipants: true,
    };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: undefined,
    };

    await controller.completeActivityFull(mockRequest as Request, mockResponse as Response);

    expect(mockCanUserAccessOrganization).not.toHaveBeenCalled();
    expect(mockCompleteActivity).not.toHaveBeenCalled();
    expect(mockCompletePersonalActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        completedById: 'user-1',
        outcome: 'success',
        summary: 'Personal mission success',
        notifyParticipants: true,
      })
    );
    expect(mockResponse.success).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: [],
      })
    );
  });

  it('allows completeActivityFull for creator-owned personal activities when active org context is present', async () => {
    const findActivityByIdSpy = jest
      .spyOn(controller as any, 'findActivityById')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'activity-personal-4',
        title: 'Personal complete-full with active org',
        organizationId: undefined,
        creatorId: 'user-1',
        status: 'open',
        currentParticipants: 1,
      });

    mockCompletePersonalActivity.mockResolvedValue({
      activity: { id: 'activity-personal-4', status: 'completed' },
      updatedParticipants: [],
      notifications: [],
      warnings: [],
    });

    mockRequest.params = { id: 'activity-personal-4' };
    mockRequest.body = {
      outcome: 'success',
      summary: 'Completed with active org context',
      participantReports: [],
      notifyParticipants: false,
    };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: 'org-1',
    };

    await controller.completeActivityFull(mockRequest as Request, mockResponse as Response);

    expect(findActivityByIdSpy).toHaveBeenNthCalledWith(1, 'activity-personal-4', {
      organizationId: 'org-1',
    });
    expect(findActivityByIdSpy).toHaveBeenNthCalledWith(2, 'activity-personal-4');
    expect(mockCompletePersonalActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        completedById: 'user-1',
        notifyParticipants: false,
      })
    );
    expect(mockCompleteActivity).not.toHaveBeenCalled();
    expect(mockResponse.success).toHaveBeenCalled();
  });

  it('returns not found for cancelActivity when requester is not creator', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-1',
      title: 'Unauthorized cancellation test',
      organizationId: 'org-1',
      creatorId: 'creator-1',
      status: 'open',
    });

    mockRequest.params = { id: 'activity-1' };
    mockRequest.body = { notes: 'Cancel request' };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: 'org-1',
    };

    await expect(
      controller.cancelActivity(mockRequest as Request, mockResponse as Response)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: ApiErrorCode.ACTIVITY_NOT_FOUND,
    });

    expect(mockCancelActivityAsSystem).not.toHaveBeenCalled();
  });

  it('allows cancelActivity when requester is creator and has organization access', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-1',
      title: 'Creator cancellation test',
      organizationId: 'org-1',
      creatorId: 'user-1',
      status: 'open',
    });

    mockCancelActivityAsSystem.mockResolvedValue({
      id: 'activity-1',
      title: 'Creator cancellation test',
      organizationId: 'org-1',
      status: 'cancelled',
    });

    mockRequest.params = { id: 'activity-1' };
    mockRequest.body = { notes: 'Weather conditions' };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: 'org-1',
    };

    await controller.cancelActivity(mockRequest as Request, mockResponse as Response);

    expect(mockCanUserAccessOrganization).toHaveBeenCalledWith('user-1', 'org-1');
    expect(mockCancelActivityAsSystem).toHaveBeenCalledWith(
      'org-1',
      'activity-1',
      'user-1',
      'Weather conditions'
    );
    expect(mockResponse.success).toHaveBeenCalled();
  });

  it('allows cancelActivity for creator-owned personal activities', async () => {
    jest.spyOn(controller as any, 'findActivityById').mockResolvedValue({
      id: 'activity-personal-2',
      title: 'Personal cancellation test',
      organizationId: undefined,
      creatorId: 'user-1',
      status: 'open',
    });

    mockCancelActivity.mockResolvedValue({
      id: 'activity-personal-2',
      title: 'Personal cancellation test',
      organizationId: undefined,
      status: 'cancelled',
    });

    mockRequest.params = { id: 'activity-personal-2' };
    mockRequest.body = { notes: 'Personal schedule conflict' };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: undefined,
    };

    await controller.cancelActivity(mockRequest as Request, mockResponse as Response);

    expect(mockCanUserAccessOrganization).not.toHaveBeenCalled();
    expect(mockCancelActivityAsSystem).not.toHaveBeenCalled();
    expect(mockCancelActivity).toHaveBeenCalledWith(
      'activity-personal-2',
      'user-1',
      'Personal schedule conflict'
    );
    expect(mockResponse.success).toHaveBeenCalled();
  });

  it('allows cancelActivity for creator-owned personal activities when active org context is present', async () => {
    const findActivityByIdSpy = jest
      .spyOn(controller as any, 'findActivityById')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'activity-personal-active-org-cancel',
        title: 'Personal cancellation with active org',
        organizationId: undefined,
        creatorId: 'user-1',
        status: 'open',
      });

    mockCancelActivity.mockResolvedValue({
      id: 'activity-personal-active-org-cancel',
      title: 'Personal cancellation with active org',
      organizationId: undefined,
      status: 'cancelled',
    });

    mockRequest.params = { id: 'activity-personal-active-org-cancel' };
    mockRequest.body = { notes: 'Conflict with org event' };
    mockRequest.user = {
      id: 'user-1',
      username: 'user-one',
      currentOrganizationId: 'org-1',
    };

    await controller.cancelActivity(mockRequest as Request, mockResponse as Response);

    expect(findActivityByIdSpy).toHaveBeenNthCalledWith(1, 'activity-personal-active-org-cancel', {
      organizationId: 'org-1',
    });
    expect(findActivityByIdSpy).toHaveBeenNthCalledWith(2, 'activity-personal-active-org-cancel');
    expect(mockCancelActivityAsSystem).not.toHaveBeenCalled();
    expect(mockCancelActivity).toHaveBeenCalledWith(
      'activity-personal-active-org-cancel',
      'user-1',
      'Conflict with org event'
    );
    expect(mockResponse.success).toHaveBeenCalled();
  });
});
