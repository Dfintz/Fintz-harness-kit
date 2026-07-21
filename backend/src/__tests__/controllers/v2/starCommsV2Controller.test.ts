import { Request, Response } from 'express';

import { AppDataSource } from '../../../data-source';
import { StarCommsV2Controller } from '../../../controllers/v2/starCommsV2Controller';
import {
  StarCommsAccessService,
  StarCommsFederationService,
} from '../../../services/communication/starcomms';

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../services/communication/starcomms', () => ({
  StarCommsAccessService: jest.fn().mockImplementation(() => ({
    listAccessibleIntegrations: jest.fn(async () => []),
  })),
  StarCommsFederationService: jest.fn().mockImplementation(() => ({
    getFederationConfig: jest.fn(async () => null),
    updateFederationConfig: jest.fn(async () => ({ id: 'integration-1' })),
    getFederationWhitelistSuggestions: jest.fn(async () => []),
  })),
}));

describe('StarCommsV2Controller', () => {
  let controller: StarCommsV2Controller;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockAccessService: jest.Mocked<StarCommsAccessService>;
  let mockFederationService: jest.Mocked<StarCommsFederationService>;

  const federationMemberRepo = {
    createQueryBuilder: jest.fn(),
  };

  const membershipRepo = {
    createQueryBuilder: jest.fn(),
  };

  const membershipQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const federationMemberQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (AppDataSource.getRepository as jest.Mock)
      .mockReturnValueOnce(federationMemberRepo)
      .mockReturnValueOnce(membershipRepo);

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      params: { federationId: '11111111-1111-4111-8111-111111111111' },
      body: {
        starCommsConfig: {
          baseUrl: 'https://starcomms.example.test',
          sharing: { enabled: true, whitelist: [] },
        },
      },
      user: {
        id: 'user-1',
        currentOrganizationId: 'org-1',
      },
    } as unknown as Partial<Request>;

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    membershipRepo.createQueryBuilder.mockReturnValue(membershipQb);
    federationMemberRepo.createQueryBuilder.mockReturnValue(federationMemberQb);
    membershipQb.getMany.mockResolvedValue([{ organizationId: 'org-1' }]);
    federationMemberQb.getOne.mockResolvedValue({ id: 'member-1' });

    controller = new StarCommsV2Controller();
    mockAccessService = (
      controller as unknown as { accessService: jest.Mocked<StarCommsAccessService> }
    ).accessService;
    mockFederationService = (
      controller as unknown as { federationService: jest.Mocked<StarCommsFederationService> }
    ).federationService;
  });

  it('should list accessible integrations', async () => {
    mockAccessService.listAccessibleIntegrations.mockResolvedValue([
      { id: 'integration-1', type: 'starcomms' },
    ] as never);

    await controller.listAccessible(mockRequest as Request, mockResponse as Response);

    expect(mockAccessService.listAccessibleIntegrations).toHaveBeenCalledWith('user-1');
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('should return federation config when user has federation membership', async () => {
    await controller.getFederationConfig(mockRequest as Request, mockResponse as Response);

    expect(mockFederationService.getFederationConfig).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('should update federation config when user has federation membership', async () => {
    await controller.updateFederationConfig(mockRequest as Request, mockResponse as Response);

    expect(mockFederationService.updateFederationConfig).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'org-1',
      'user-1',
      expect.objectContaining({
        starCommsConfig: expect.objectContaining({
          baseUrl: 'https://starcomms.example.test',
        }),
      })
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('should return sharing suggestions when user has federation membership', async () => {
    await controller.getFederationSharingSuggestions(
      mockRequest as Request,
      mockResponse as Response
    );

    expect(mockFederationService.getFederationWhitelistSuggestions).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });
});
