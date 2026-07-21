/**
 * UserControllerV2 Ship Tests
 *
 * Tests the controller contract for /users/me/ships, which now delegates to
 * UserShipService.findMyShips for filtering/sorting/pagination.
 */

import { Request, Response } from 'express';

import { UserControllerV2 } from '../../../controllers/v2/userController';
import { ApiError } from '../../../middleware/errorHandlerV2';

// Mock dependencies
jest.mock('../../../utils/authHelpers');
jest.mock('../../../middleware/queryParser');
jest.mock('../../../services/ship/UserShipService', () => ({
  UserShipService: jest.fn().mockImplementation(() => ({
    findMyShips: jest.fn(),
  })),
}));

const mockAuthHelpers = require('../../../utils/authHelpers');
const mockQueryParser = require('../../../middleware/queryParser');

describe('UserControllerV2 - getUserShips', () => {
  let controller: UserControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUserShipService: { findMyShips: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new UserControllerV2();
    mockUserShipService = (controller as any).userShipService;

    mockAuthHelpers.getAuthenticatedUserId.mockReturnValue('user-123');

    mockQueryParser.selectFieldsFromArray.mockImplementation((items: any[]) => items);
    mockQueryParser.buildHateoasLinks.mockReturnValue({
      self: '/api/v2/users/me/ships?offset=0&limit=20',
      first: '/api/v2/users/me/ships?offset=0&limit=20',
      last: '/api/v2/users/me/ships?offset=0&limit=20',
    });

    mockUserShipService.findMyShips.mockResolvedValue({
      data: [
        {
          id: 'ship-1',
          userId: 'user-123',
          shipId: 'aurora-mr',
          shipName: 'Aurora MR',
          manufacturer: 'Roberts Space Industries',
          status: 'owned',
          condition: 'good',
        },
        {
          id: 'ship-2',
          userId: 'user-123',
          shipId: 'cutlass-black',
          shipName: 'Cutlass Black',
          manufacturer: 'Drake Interplanetary',
          status: 'pledged',
          condition: 'excellent',
        },
      ],
      total: 2,
    });

    mockRequest = {
      query: {},
      queryParams: {
        limit: 20,
        offset: 0,
        sort: null,
        filters: {},
        fields: null,
        search: null,
      },
    };

    mockResponse = {
      paginated: jest.fn(),
    };
  });

  it('should get user ships without organization filtering', async () => {
    await controller.getUserShips(mockRequest as Request, mockResponse as Response);

    expect(mockAuthHelpers.getAuthenticatedUserId).toHaveBeenCalledWith(mockRequest);
    expect(mockUserShipService.findMyShips).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        manufacturer: undefined,
        status: undefined,
        search: undefined,
      }),
      expect.objectContaining({
        limit: 20,
        offset: 0,
        sortField: undefined,
        sortOrder: undefined,
      })
    );

    expect(mockResponse.paginated).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
      }),
      expect.any(Object)
    );
  });

  it('should apply manufacturer filter', async () => {
    mockRequest.queryParams.filters = { manufacturer: 'Origin' };

    await controller.getUserShips(mockRequest as Request, mockResponse as Response);

    expect(mockUserShipService.findMyShips).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ manufacturer: 'Origin' }),
      expect.any(Object)
    );
  });

  it('should apply status filter', async () => {
    mockRequest.queryParams.filters = { status: 'pledged' };

    await controller.getUserShips(mockRequest as Request, mockResponse as Response);

    expect(mockUserShipService.findMyShips).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ status: 'pledged' }),
      expect.any(Object)
    );
  });

  it('should apply custom sorting', async () => {
    mockRequest.queryParams.sort = { field: 'shipName', order: 'ASC' as const };

    await controller.getUserShips(mockRequest as Request, mockResponse as Response);

    expect(mockUserShipService.findMyShips).toHaveBeenCalledWith(
      'user-123',
      expect.any(Object),
      expect.objectContaining({ sortField: 'shipName', sortOrder: 'ASC' })
    );
  });

  it('should use undefined sort options when no sort is specified', async () => {
    await controller.getUserShips(mockRequest as Request, mockResponse as Response);

    expect(mockUserShipService.findMyShips).toHaveBeenCalledWith(
      'user-123',
      expect.any(Object),
      expect.objectContaining({ sortField: undefined, sortOrder: undefined })
    );
  });

  it('should handle pagination correctly', async () => {
    mockRequest.queryParams.offset = 20;
    mockRequest.queryParams.limit = 10;

    await controller.getUserShips(mockRequest as Request, mockResponse as Response);

    expect(mockUserShipService.findMyShips).toHaveBeenCalledWith(
      'user-123',
      expect.any(Object),
      expect.objectContaining({ limit: 10, offset: 20 })
    );
  });

  it('should throw error if user not authenticated', async () => {
    mockAuthHelpers.getAuthenticatedUserId.mockImplementation(() => {
      throw new ApiError('UNAUTHORIZED', 'User not authenticated', 401);
    });

    await expect(
      controller.getUserShips(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow('User not authenticated');
  });

  it('should handle service errors gracefully', async () => {
    mockUserShipService.findMyShips.mockRejectedValue(new Error('Database connection failed'));

    await expect(
      controller.getUserShips(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow('Failed to fetch user ships');
  });

  it('should return empty results when user has no ships', async () => {
    mockUserShipService.findMyShips.mockResolvedValue({ data: [], total: 0 });

    await controller.getUserShips(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.paginated).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        total: 0,
        hasMore: false,
      }),
      expect.any(Object)
    );
  });
});
