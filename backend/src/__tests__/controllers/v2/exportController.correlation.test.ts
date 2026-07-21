import { Request, Response } from 'express';

import { ExportController } from '../../../controllers/v2/exportController';
import { CrossSystemAnalyticsService } from '../../../services/analytics/CrossSystemAnalyticsService';

jest.mock('../../../services/analytics/CrossSystemAnalyticsService');

describe('ExportController correlation export', () => {
  let controller: ExportController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockService: jest.Mocked<CrossSystemAnalyticsService>;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new ExportController();
    mockService = (
      controller as unknown as { analyticsService: jest.Mocked<CrossSystemAnalyticsService> }
    ).analyticsService;

    mockRequest = {
      user: { id: 'user-1' },
      tenantContext: { organizationId: 'org-1' },
      query: {
        format: 'csv',
        activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    } as unknown as Partial<Request>;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as Partial<Response>;

    mockService.getAttendanceCorrelationReport.mockResolvedValue({
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

    mockService.formatAttendanceCorrelationCsv.mockReturnValue('organizationId,org-1\n');
  });

  it('should return csv when requested', async () => {
    await controller.exportAttendanceCorrelation(mockRequest as Request, mockResponse as Response);

    expect(mockService.getAttendanceCorrelationReport).toHaveBeenCalledWith('org-1', {
      activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      startDate: undefined,
      endDate: undefined,
    });
    expect(mockService.formatAttendanceCorrelationCsv).toHaveBeenCalled();
    expect(mockResponse.type).toHaveBeenCalledWith('text/csv; charset=utf-8');
    expect(mockResponse.send).toHaveBeenCalledWith('organizationId,org-1\n');
  });

  it('should return json by default', async () => {
    mockRequest.query = {};

    await controller.exportAttendanceCorrelation(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          organizationId: 'org-1',
        }),
      })
    );
  });
});