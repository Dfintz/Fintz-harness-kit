import { Request, Response } from 'express';

import { StarCommsReadController } from '../../../controllers/v2/starCommsReadController';
import {
  StarCommsAccessService,
  StarCommsAdapter,
} from '../../../services/communication/starcomms';
import { ExternalIntegrationService } from '../../../services/external/ExternalIntegrationService';

jest.mock('../../../services/external/ExternalIntegrationService');
jest.mock('../../../services/external', () => ({
  ExternalIntegrationService: jest.requireMock(
    '../../../services/external/ExternalIntegrationService'
  ).ExternalIntegrationService,
}));
jest.mock('../../../services/communication/starcomms', () => ({
  StarCommsAccessService: jest.fn().mockImplementation(() => ({
    ensureIntegrationAccess: jest.fn(async () => undefined),
  })),
  StarCommsAdapter: jest.fn().mockImplementation(() => ({
    buildConnectionConfig: jest.fn(() => ({ baseUrl: 'https://starcomms.example.com' })),
    getShardStatus: jest.fn(async () => ({ service: 'starcomms', status: 'healthy' })),
    getMetricsWindow: jest.fn(async () => ({ raw: {}, window: {} })),
  })),
}));

describe('StarCommsReadController', () => {
  let controller: StarCommsReadController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockIntegrationService: jest.Mocked<ExternalIntegrationService>;
  let mockAccessService: jest.Mocked<StarCommsAccessService>;
  let mockAdapter: jest.Mocked<StarCommsAdapter>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      params: { integrationId: '11111111-1111-4111-8111-111111111111' },
      query: {},
      user: { id: 'user-123', currentOrganizationId: 'org-123' },
    } as unknown as Partial<Request>;

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    controller = new StarCommsReadController();
    mockIntegrationService = (
      controller as unknown as {
        integrationService: jest.Mocked<ExternalIntegrationService>;
      }
    ).integrationService;
    mockAccessService = (
      controller as unknown as {
        accessService: jest.Mocked<StarCommsAccessService>;
      }
    ).accessService;
    mockAdapter = (controller as unknown as { starCommsAdapter: jest.Mocked<StarCommsAdapter> })
      .starCommsAdapter;

    jest.clearAllMocks();

    mockIntegrationService.getIntegrationById.mockResolvedValue({
      id: 'integration-123',
      fleetId: 'fleet-123',
      type: 'starcomms',
      starCommsConfig: { baseUrl: 'https://starcomms.example.com' },
    } as never);
  });

  it('should return status for owned starcomms integration', async () => {
    await controller.getStatus(mockRequest as Request, mockResponse as Response);

    expect(mockAccessService.ensureIntegrationAccess).toHaveBeenCalledWith(
      'user-123',
      'org-123',
      expect.objectContaining({ id: 'integration-123' })
    );
    expect(mockAdapter.buildConnectionConfig).toHaveBeenCalled();
    expect(mockAdapter.getShardStatus).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ service: 'starcomms' }));
  });

  it('should return 404 when integration does not exist', async () => {
    mockIntegrationService.getIntegrationById.mockResolvedValue(null);

    await controller.getStatus(mockRequest as Request, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('should return 400 for non-starcomms integration', async () => {
    mockIntegrationService.getIntegrationById.mockResolvedValue({
      id: 'integration-123',
      fleetId: 'fleet-123',
      type: 'webhook',
    } as never);

    await controller.getStatus(mockRequest as Request, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: 'Integration is not configured as StarComms' }),
      })
    );
  });

  it('should return 403 when access resolver denies integration access', async () => {
    mockAccessService.ensureIntegrationAccess.mockRejectedValue(new Error('access denied'));

    await controller.getStatus(mockRequest as Request, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});
