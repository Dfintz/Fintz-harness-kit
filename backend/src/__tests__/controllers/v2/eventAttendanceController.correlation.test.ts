import { Request, Response } from 'express';

import { EventAttendanceControllerV2 } from '../../../controllers/v2/eventAttendanceController';
import { CrossSystemAnalyticsService } from '../../../services/analytics/CrossSystemAnalyticsService';

jest.mock('../../../services/analytics/CrossSystemAnalyticsService');

describe('EventAttendanceControllerV2 correlation endpoint', () => {
  let controller: EventAttendanceControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockService: jest.Mocked<CrossSystemAnalyticsService>;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new EventAttendanceControllerV2();
    mockService = (
      controller as unknown as { analyticsService: jest.Mocked<CrossSystemAnalyticsService> }
    ).analyticsService;

    mockRequest = {
      params: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      tenantContext: { organizationId: 'org-1' },
    } as unknown as Partial<Request>;

    mockResponse = {
      success: jest.fn(),
    } as unknown as Partial<Response>;

    mockService.getActivityAttendanceCorrelationReport.mockResolvedValue({
      organizationId: 'org-1',
      generatedAt: '2026-07-12T00:00:00.000Z',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-02T00:00:00.000Z',
      totalActivities: 1,
      totalConfirmations: 2,
      attended: 1,
      late: 1,
      earlyDeparture: 0,
      noShow: 0,
      pending: 0,
      attendanceRate: 100,
      starComms: { available: false },
      activities: [],
    });
  });

  it('should return a correlated attendance summary', async () => {
    await controller.getAttendanceCorrelationSummary(mockRequest as Request, mockResponse as Response);

    expect(mockService.getActivityAttendanceCorrelationReport).toHaveBeenCalledWith(
      'org-1',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    );
    expect((mockResponse.success as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        attendanceRate: 100,
      })
    );
  });

  it('should reject missing organization context', async () => {
    mockRequest.tenantContext = undefined;

    await expect(
      controller.getAttendanceCorrelationSummary(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow();
  });
});