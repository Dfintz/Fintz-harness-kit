jest.mock('../../utils/pagination', () => ({
  extractPaginationOptions: jest.fn(),
}));

import { Response } from 'express';

import { CargoManifestController } from '../../controllers/cargoManifestController';
import { AuthRequest } from '../../middleware/auth';
import { ManifestStatus } from '../../models/CargoManifest';
import { NotFoundError } from '../../utils/apiErrors';
import { extractPaginationOptions } from '../../utils/pagination';

type MockManifestService = {
  create: jest.Mock;
  findAll: jest.Mock;
  findById: jest.Mock;
  addCargoItem: jest.Mock;
  updateStatus: jest.Mock;
  updateSharing: jest.Mock;
};

describe('CargoManifestController', () => {
  let controller: CargoManifestController;
  let mockManifestService: MockManifestService;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new CargoManifestController();

    mockManifestService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      addCargoItem: jest.fn(),
      updateStatus: jest.fn(),
      updateSharing: jest.fn(),
    };

    (
      controller as unknown as {
        manifestService: MockManifestService;
      }
    ).manifestService = mockManifestService;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: {
        id: 'user-123',
        currentOrganizationId: 'org-1',
      } as AuthRequest['user'],
      tenantContext: {
        organizationId: 'org-1',
        userId: 'user-123',
      } as AuthRequest['tenantContext'],
    };

    jest.clearAllMocks();
  });

  describe('createManifest', () => {
    it('should create a cargo manifest successfully', async () => {
      const manifestData = {
        shipId: 'ship-123',
        cargo: [{ itemName: 'Quantanium', quantity: 100, unitValue: 50 }],
        origin: 'Port Olisar',
        destination: 'Area 18',
        sharedWithFleet: true,
        notes: 'Valuable cargo',
      };

      const createdManifest = {
        id: 'manifest-1',
        ...manifestData,
        ownerId: 'user-123',
        status: ManifestStatus.LOADING,
      };

      mockRequest.body = manifestData;
      mockManifestService.create.mockResolvedValue(createdManifest);

      await controller.createManifest(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockManifestService.create).toHaveBeenCalledWith(manifestData, 'org-1', 'user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(createdManifest);
    });

    it('should return 400 when organization context is missing', async () => {
      mockRequest.tenantContext = undefined;
      mockRequest.user = {
        id: 'user-123',
        currentOrganizationId: undefined,
      } as AuthRequest['user'];

      await controller.createManifest(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No active organization selected',
          requiresOrgSelection: true,
        })
      );
      expect(mockManifestService.create).not.toHaveBeenCalled();
    });

    it('should return 401 when user is missing', async () => {
      mockRequest.user = undefined;

      await controller.createManifest(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authentication required' })
      );
      expect(mockManifestService.create).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockRequest.body = { shipId: 'ship-123' };
      mockManifestService.create.mockRejectedValue(new Error('Database error'));

      await controller.createManifest(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Database error',
        })
      );
    });
  });

  describe('getManifests', () => {
    it('should retrieve manifests with pagination', async () => {
      const paginationOptions = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };

      (extractPaginationOptions as jest.Mock).mockReturnValue(paginationOptions);
      mockManifestService.findAll.mockResolvedValue(paginatedResult);

      await controller.getManifests(mockRequest as AuthRequest, mockResponse as Response);

      expect(extractPaginationOptions).toHaveBeenCalledWith(mockRequest);
      expect(mockManifestService.findAll).toHaveBeenCalledWith(paginationOptions, 'org-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(paginatedResult);
    });

    it('should handle errors when fetching manifests', async () => {
      (extractPaginationOptions as jest.Mock).mockReturnValue({ page: 1, limit: 10 });
      mockManifestService.findAll.mockRejectedValue(new Error('Query error'));

      await controller.getManifests(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Query error',
        })
      );
    });
  });

  describe('getManifestById', () => {
    it('should retrieve a manifest by id', async () => {
      const manifest = {
        id: 'manifest-1',
        shipId: 'ship-123',
        cargo: [{ itemName: 'Titanium', quantity: 50 }],
        status: ManifestStatus.IN_TRANSIT,
      };

      mockRequest.params = { id: 'manifest-1' };
      mockManifestService.findById.mockResolvedValue(manifest);

      await controller.getManifestById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockManifestService.findById).toHaveBeenCalledWith('manifest-1', 'org-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(manifest);
    });

    it('should return 404 if manifest is not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockManifestService.findById.mockRejectedValue(new NotFoundError('Cargo manifest'));

      await controller.getManifestById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      const payload = (mockResponse.json as jest.Mock).mock.calls.at(-1)?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/not found/i),
        })
      );
    });
  });

  describe('addCargoItem', () => {
    it('should add a cargo item to manifest', async () => {
      const updatedManifest = {
        id: 'manifest-1',
        cargo: [
          { itemName: 'Quantanium', quantity: 100, unitValue: 50, totalValue: 5000 },
          { itemName: 'Laranite', quantity: 200, unitValue: 30, totalValue: 6000 },
        ],
      };

      mockRequest.params = { id: 'manifest-1' };
      mockRequest.body = { itemName: 'Laranite', quantity: 200, unitValue: 30 };
      mockManifestService.addCargoItem.mockResolvedValue(updatedManifest);

      await controller.addCargoItem(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockManifestService.addCargoItem).toHaveBeenCalledWith('manifest-1', 'org-1', {
        itemName: 'Laranite',
        quantity: 200,
        unitValue: 30,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(updatedManifest);
    });

    it('should return 404 if manifest is not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { itemName: 'Gold', quantity: 10 };
      mockManifestService.addCargoItem.mockRejectedValue(new NotFoundError('Cargo manifest'));

      await controller.addCargoItem(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      const payload = (mockResponse.json as jest.Mock).mock.calls.at(-1)?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/not found/i),
        })
      );
    });
  });

  describe('updateStatus', () => {
    it('should update manifest status successfully', async () => {
      const updatedManifest = {
        id: 'manifest-1',
        status: ManifestStatus.IN_TRANSIT,
      };

      mockRequest.params = { id: 'manifest-1' };
      mockRequest.body = { status: ManifestStatus.IN_TRANSIT };
      mockManifestService.updateStatus.mockResolvedValue(updatedManifest);

      await controller.updateStatus(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockManifestService.updateStatus).toHaveBeenCalledWith(
        'manifest-1',
        'org-1',
        ManifestStatus.IN_TRANSIT
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(updatedManifest);
    });

    it('should return 404 if manifest is not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { status: ManifestStatus.DELIVERED };
      mockManifestService.updateStatus.mockRejectedValue(new NotFoundError('Cargo manifest'));

      await controller.updateStatus(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      const payload = (mockResponse.json as jest.Mock).mock.calls.at(-1)?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/not found/i),
        })
      );
    });
  });
});
