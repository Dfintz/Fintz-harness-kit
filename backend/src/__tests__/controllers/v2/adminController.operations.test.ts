/**
 * AdminControllerV2.getOperationsOverview — Controller-layer unit tests
 *
 * Verifies the controller delegates to AdminOperationsService and
 * handles HTTP concerns (status codes, error responses) correctly.
 */
import { Request, Response } from 'express';

// ── Mock the service ─────────────────────────────────────────────────────────
const mockGetOverview = jest.fn();

jest.mock('../../../services/admin/AdminOperationsService', () => ({
  AdminOperationsService: {
    getOverview: (...args: unknown[]) => mockGetOverview(...args),
  },
}));

// Minimal mocks for other AdminControllerV2 dependencies
jest.mock('../../../services/admin/AdminMetricsService', () => ({
  AdminMetricsService: { getSystemMetrics: jest.fn() },
}));
jest.mock('../../../services/admin/AdminSecurityLogService', () => ({
  AdminSecurityLogService: { getLogSummary: jest.fn().mockReturnValue({}), logEvent: jest.fn() },
  SecurityEventType: { ADMIN_ACTION: 'admin_action' },
  SecuritySeverity: {},
}));
jest.mock('../../../services/admin/AnomalyDetectionService', () => ({
  AnomalyDetectionService: { getInstance: jest.fn() },
}));
jest.mock('../../../services/admin/DataObfuscationService', () => ({
  DataObfuscationService: { partialMask: jest.fn().mockReturnValue('***') },
}));
jest.mock('../../../services/admin/FeatureFlagService', () => ({
  FeatureFlagService: { getStatistics: jest.fn() },
  FeatureFlagScope: {},
  FeatureFlagStatus: {},
}));
jest.mock('../../../services/monitoring', () => ({
  autoScalingTriggerService: {},
  distributedTracingService: {},
  performanceMonitoringService: {},
  queryAnalyzerService: {},
}));
jest.mock('../../../services/user/GdprDataDeletionService', () => ({
  GdprDataDeletionService: jest.fn(),
}));
jest.mock('../../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ── Import after mocks ──────────────────────────────────────────────────────
import { AdminControllerV2 } from '../../../controllers/v2/adminController';

function createMockReqRes(): { req: Request; res: Response } {
  const req = {} as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headersSent: false,
  } as unknown as Response;
  return { req, res };
}

describe('AdminControllerV2.getOperationsOverview', () => {
  let controller: AdminControllerV2;

  beforeEach(() => {
    controller = new AdminControllerV2();
    jest.clearAllMocks();
  });

  it('should return 200 with service data', async () => {
    const overview = {
      botCommands: { totalCommands: 10, totalSuccessful: 9, totalFailed: 1 },
      jobs: { totalJobs: 3 },
      fetchers: { fetchers: [] },
      timestamp: new Date(),
    };
    mockGetOverview.mockResolvedValue(overview);

    const { req, res } = createMockReqRes();
    await controller.getOperationsOverview(req, res);

    expect(mockGetOverview).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: overview });
  });

  it('should return 500 with the standardized error envelope when service throws', async () => {
    mockGetOverview.mockRejectedValue(new Error('Service failure'));

    const { req, res } = createMockReqRes();
    await controller.getOperationsOverview(req, res);

    // After the BaseController migration the 500 path emits the shared envelope
    // ({ success:false, message, error:{ code, message, stack? } }) instead of
    // the legacy ad-hoc { error: '<static message>' } body.
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Service failure',
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Service failure',
        }),
      })
    );
  });

  it('should not send response if headers already sent', async () => {
    mockGetOverview.mockRejectedValue(new Error('fail'));

    const { req } = createMockReqRes();
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: true,
    } as unknown as Response;

    await controller.getOperationsOverview(req, res);

    expect(res.status).not.toHaveBeenCalled();
  });
});
