import { Request, Response } from 'express';

import { IntegrationsV2Controller } from '../../../controllers/v2/integrationsV2Controller';
import { ExternalIntegrationService } from '../../../services/external/ExternalIntegrationService';
import { FleetService } from '../../../services/fleet/FleetService';

jest.mock('../../../services/external/ExternalIntegrationService');
jest.mock('../../../services/external', () => ({
  ExternalIntegrationService: jest.requireMock(
    '../../../services/external/ExternalIntegrationService'
  ).ExternalIntegrationService,
}));
jest.mock('../../../services/fleet/FleetService');

describe('IntegrationsV2Controller', () => {
  let controller: IntegrationsV2Controller;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockService: jest.Mocked<ExternalIntegrationService>;
  let mockFleetService: jest.Mocked<FleetService>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-123', currentOrganizationId: 'org-123' },
    } as unknown as Partial<Request>;

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    controller = new IntegrationsV2Controller();
    mockService = (
      controller as unknown as { integrationService: jest.Mocked<ExternalIntegrationService> }
    ).integrationService;
    mockFleetService = (controller as unknown as { fleetService: jest.Mocked<FleetService> })
      .fleetService;

    jest.clearAllMocks();

    mockFleetService.getFleetById.mockResolvedValue({ id: 'fleet-123' } as never);
    mockService.getIntegrationById.mockResolvedValue({
      id: 'integration-123',
      fleetId: 'fleet-123',
      type: 'starcomms',
      syncHistory: [],
    } as never);
  });

  it('should create integration with createdBy from auth user', async () => {
    mockRequest.body = {
      fleetId: '11111111-1111-4111-8111-111111111111',
      name: 'StarComms',
      type: 'starcomms',
      syncDirection: 'inbound',
      authConfig: { type: 'none' },
      starCommsConfig: { baseUrl: 'https://starcomms.example.com' },
    };

    mockService.createIntegration.mockResolvedValue({ id: 'integration-123' } as never);

    await controller.createIntegration(mockRequest as Request, mockResponse as Response);

    expect(mockService.createIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'user-123' })
    );
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should reject invalid integration id on get', async () => {
    mockRequest.params = { integrationId: 'not-a-uuid' };

    await controller.getIntegration(mockRequest as Request, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: 'Invalid integrationId' }),
      })
    );
  });

  it('should return logs filtered by date', async () => {
    mockRequest.params = { integrationId: '11111111-1111-4111-8111-111111111111' };
    mockRequest.query = {
      startDate: '2026-07-10T00:00:00.000Z',
      endDate: '2026-07-12T23:59:59.000Z',
    };

    mockService.getIntegrationById.mockResolvedValue({
      id: 'integration-123',
      fleetId: 'fleet-123',
      syncHistory: [
        { timestamp: new Date('2026-07-11T00:00:00.000Z'), status: 'success', itemsSynced: 1 },
        { timestamp: new Date('2026-07-01T00:00:00.000Z'), status: 'success', itemsSynced: 1 },
      ],
    } as never);

    await controller.getLogs(mockRequest as Request, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith([
      expect.objectContaining({ status: 'success', itemsSynced: 1 }),
    ]);
  });
});
