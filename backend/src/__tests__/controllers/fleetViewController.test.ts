/**
 * FleetViewController Unit Tests
 *
 * Tests FleetView import/export operations
 * Covers user and org fleet export/import, schema validation
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { FleetViewController } from '../../controllers/fleetViewController';
import { FleetViewService } from '../../services/fleet/FleetViewService';
import { MockResponse } from '../helpers/testHelpers.helper';

// Mock dependencies
jest.mock('../../services/fleet/FleetViewService');
describe('FleetViewController', () => {
  let controller: FleetViewController;
  let mockFleetViewService: jest.Mocked<FleetViewService>;
  let mockOrgRepo: any;
  let mockUserOrgRepo: any;

  // Helper to create authenticated request
  const createAuthRequest = (overrides: any = {}) => ({
    user: { id: 'test-user-id', username: 'testuser', role: 'user' },
    body: {},
    params: {},
    query: {},
    headers: {},
    file: undefined,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked service instance
    mockFleetViewService = {
      exportToFleetView: jest.fn(),
      importFromFleetView: jest.fn(),
      validateSchema: jest.fn(),
    } as any;

    mockOrgRepo = {
      findOne: jest.fn(),
    };

    mockUserOrgRepo = {
      findOne: jest.fn(),
    };

    // Mock AppDataSource.getRepository
    mockAppDataSource.getRepository.mockImplementation((entity: any) => {
      if (entity.name === 'Organization') {
        return mockOrgRepo;
      }
      if (entity.name === 'OrganizationMembership') {
        return mockUserOrgRepo;
      }
      return {};
    });

    controller = new FleetViewController();
    (controller as any).fleetViewService = mockFleetViewService;
    (controller as any).organizationRepository = mockOrgRepo;
    (controller as any).userOrganizationRepository = mockUserOrgRepo;
  });

  describe('exportUserFleet', () => {
    it('should export user fleet successfully', async () => {
      const req = createAuthRequest({
        query: { includeStatistics: 'true', includeInactive: 'false' },
      });
      const res = MockResponse.create();
      const mockSchema = {
        ships: [{ id: 'ship-1', name: 'My Aurora' }],
        statistics: { totalShips: 1 },
      };
      mockFleetViewService.exportToFleetView.mockResolvedValue(mockSchema as any);

      await controller.exportUserFleet(req as any, res);

      expect(mockFleetViewService.exportToFleetView).toHaveBeenCalledWith({
        userId: 'test-user-id',
        includeStatistics: true,
        includeInactive: false,
      });
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="my-fleet-')
      );
      expect(res.json).toHaveBeenCalledWith(mockSchema);
    });

    it('should throw error if user not authenticated', async () => {
      const req = createAuthRequest({ user: undefined });
      const res = MockResponse.create();

      await controller.exportUserFleet(req as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should default includeStatistics to true', async () => {
      const req = createAuthRequest({ query: {} });
      const res = MockResponse.create();
      mockFleetViewService.exportToFleetView.mockResolvedValue({} as any);

      await controller.exportUserFleet(req as any, res);

      expect(mockFleetViewService.exportToFleetView).toHaveBeenCalledWith(
        expect.objectContaining({ includeStatistics: true })
      );
    });
  });

  describe('exportOrgFleet', () => {
    it('should export org fleet for authorized user', async () => {
      const req = createAuthRequest({
        params: { organizationId: 'org-123' },
        query: { includeStatistics: 'true' },
      });
      const res = MockResponse.create();
      const mockUserOrg = { userId: 'test-user-id', organizationId: 'org-123', role: 'admin' };
      const mockOrg = { id: 'org-123', name: 'Test Organization' };
      const mockSchema = { ships: [], statistics: {} };

      mockUserOrgRepo.findOne.mockResolvedValue(mockUserOrg);
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockFleetViewService.exportToFleetView.mockResolvedValue(mockSchema as any);

      await controller.exportOrgFleet(req as any, res);

      expect(mockUserOrgRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'test-user-id', organizationId: 'org-123', isActive: true },
      });
      expect(mockFleetViewService.exportToFleetView).toHaveBeenCalledWith({
        organizationId: 'org-123',
        includeStatistics: true,
        includeInactive: false,
      });
      expect(res.json).toHaveBeenCalledWith(mockSchema);
    });

    it('should allow owner role to export', async () => {
      const req = createAuthRequest({
        params: { organizationId: 'org-123' },
      });
      const res = MockResponse.create();
      const mockUserOrg = { userId: 'test-user-id', organizationId: 'org-123', role: 'owner' };
      mockUserOrgRepo.findOne.mockResolvedValue(mockUserOrg);
      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-123', name: 'Org' });
      mockFleetViewService.exportToFleetView.mockResolvedValue({} as any);

      await controller.exportOrgFleet(req as any, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject non-admin/owner users', async () => {
      const req = createAuthRequest({
        params: { organizationId: 'org-123' },
      });
      const res = MockResponse.create();
      const mockUserOrg = { userId: 'test-user-id', organizationId: 'org-123', role: 'member' };
      mockUserOrgRepo.findOne.mockResolvedValue(mockUserOrg);

      await controller.exportOrgFleet(req as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject user not in organization', async () => {
      const req = createAuthRequest({
        params: { organizationId: 'org-123' },
      });
      const res = MockResponse.create();
      mockUserOrgRepo.findOne.mockResolvedValue(null);

      await controller.exportOrgFleet(req as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('importUserFleet', () => {
    it('should import from file upload successfully', async () => {
      const mockSchema = { ships: [{ id: 'ship-1' }] };
      const req = createAuthRequest({
        file: {
          buffer: Buffer.from(JSON.stringify(mockSchema)),
        },
        body: { merge: 'true', skipDuplicates: 'true' },
      });
      const res = MockResponse.create();
      const mockResult = { imported: 1, skipped: 0, errors: [] };
      mockFleetViewService.validateSchema.mockReturnValue(true);
      mockFleetViewService.importFromFleetView.mockResolvedValue(mockResult as any);

      await controller.importUserFleet(req as any, res);

      expect(mockFleetViewService.validateSchema).toHaveBeenCalledWith(mockSchema);
      expect(mockFleetViewService.importFromFleetView).toHaveBeenCalledWith(
        mockSchema,
        expect.objectContaining({
          userId: 'test-user-id',
          organizationId: 'user-test-user-id',
        })
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should import from request body', async () => {
      const mockSchema = { ships: [{ id: 'ship-1' }] };
      const req = createAuthRequest({
        body: { schema: mockSchema, merge: true },
      });
      const res = MockResponse.create();
      mockFleetViewService.validateSchema.mockReturnValue(true);
      mockFleetViewService.importFromFleetView.mockResolvedValue({ imported: 1 } as any);

      await controller.importUserFleet(req as any, res);

      expect(mockFleetViewService.importFromFleetView).toHaveBeenCalledWith(
        mockSchema,
        expect.any(Object)
      );
    });

    it('should normalize raw array schema from request body', async () => {
      const rawShips = [{ name: 'Aurora MR' }];
      const normalizedSchema = { ships: rawShips };
      const req = createAuthRequest({
        body: { schema: rawShips },
      });
      const res = MockResponse.create();
      mockFleetViewService.validateSchema.mockReturnValue(true);
      mockFleetViewService.importFromFleetView.mockResolvedValue({ imported: 1 } as any);

      await controller.importUserFleet(req as any, res);

      expect(mockFleetViewService.validateSchema).toHaveBeenCalledWith(normalizedSchema);
      expect(mockFleetViewService.importFromFleetView).toHaveBeenCalledWith(
        normalizedSchema,
        expect.any(Object)
      );
    });

    it('should throw error for invalid JSON file', async () => {
      const req = createAuthRequest({
        file: {
          buffer: Buffer.from('not valid json'),
        },
      });
      const res = MockResponse.create();

      await controller.importUserFleet(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should throw error for invalid schema', async () => {
      const req = createAuthRequest({
        body: { schema: { invalid: true } },
      });
      const res = MockResponse.create();
      mockFleetViewService.validateSchema.mockReturnValue(false);

      await controller.importUserFleet(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should throw error if no data provided', async () => {
      const req = createAuthRequest({
        body: {},
      });
      const res = MockResponse.create();

      await controller.importUserFleet(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('importOrgFleet', () => {
    it('should import org fleet for authorized user', async () => {
      const mockSchema = { ships: [{ id: 'ship-1' }] };
      const req = createAuthRequest({
        params: { organizationId: 'org-123' },
        body: { schema: mockSchema },
      });
      const res = MockResponse.create();
      const mockUserOrg = { userId: 'test-user-id', organizationId: 'org-123', role: 'admin' };
      mockUserOrgRepo.findOne.mockResolvedValue(mockUserOrg);
      mockFleetViewService.validateSchema.mockReturnValue(true);
      mockFleetViewService.importFromFleetView.mockResolvedValue({ imported: 1 } as any);

      await controller.importOrgFleet(req as any, res);

      expect(mockFleetViewService.importFromFleetView).toHaveBeenCalledWith(
        mockSchema,
        expect.objectContaining({
          organizationId: 'org-123',
          userId: 'test-user-id',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const req = createAuthRequest({
        params: { organizationId: 'org-123' },
        body: { schema: { ships: [] } },
      });
      const res = MockResponse.create();
      const mockUserOrg = { userId: 'test-user-id', organizationId: 'org-123', role: 'member' };
      mockUserOrgRepo.findOne.mockResolvedValue(mockUserOrg);

      await controller.importOrgFleet(req as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should import from file upload', async () => {
      const mockSchema = { ships: [] };
      const req = createAuthRequest({
        params: { organizationId: 'org-123' },
        file: {
          buffer: Buffer.from(JSON.stringify(mockSchema)),
        },
      });
      const res = MockResponse.create();
      const mockUserOrg = { userId: 'test-user-id', organizationId: 'org-123', role: 'owner' };
      mockUserOrgRepo.findOne.mockResolvedValue(mockUserOrg);
      mockFleetViewService.validateSchema.mockReturnValue(true);
      mockFleetViewService.importFromFleetView.mockResolvedValue({ imported: 0 } as any);

      await controller.importOrgFleet(req as any, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('validateSchema', () => {
    it('should validate valid schema', async () => {
      const mockSchema = { ships: [{ id: 'ship-1' }] };
      const req = createAuthRequest({
        body: { schema: mockSchema },
      });
      const res = MockResponse.create();
      mockFleetViewService.validateSchema.mockReturnValue(true);

      await controller.validateSchema(req as any, res);

      expect(mockFleetViewService.validateSchema).toHaveBeenCalledWith(mockSchema);
      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        shipCount: 1,
        message: 'Schema is valid and ready for import',
      });
    });

    it('should normalize raw array schema during validation', async () => {
      const rawShips = [{ name: 'Avenger Titan' }, { name: 'Cutlass Black' }];
      const normalizedSchema = { ships: rawShips };
      const req = createAuthRequest({
        body: { schema: rawShips },
      });
      const res = MockResponse.create();
      mockFleetViewService.validateSchema.mockReturnValue(true);

      await controller.validateSchema(req as any, res);

      expect(mockFleetViewService.validateSchema).toHaveBeenCalledWith(normalizedSchema);
      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        shipCount: 2,
        message: 'Schema is valid and ready for import',
      });
    });

    it('should return invalid for bad schema', async () => {
      const req = createAuthRequest({
        body: { invalid: true },
      });
      const res = MockResponse.create();
      mockFleetViewService.validateSchema.mockReturnValue(false);

      await controller.validateSchema(req as any, res);

      expect(res.json).toHaveBeenCalledWith({
        valid: false,
        error: 'Invalid FleetView schema format',
      });
    });

    it('should validate schema from file upload', async () => {
      const mockSchema = { ships: [{ id: 'ship-1' }, { id: 'ship-2' }] };
      const req = createAuthRequest({
        file: {
          buffer: Buffer.from(JSON.stringify(mockSchema)),
        },
      });
      const res = MockResponse.create();
      mockFleetViewService.validateSchema.mockReturnValue(true);

      await controller.validateSchema(req as any, res);

      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        shipCount: 2,
        message: 'Schema is valid and ready for import',
      });
    });

    it('should return invalid JSON error for bad file', async () => {
      const req = createAuthRequest({
        file: {
          buffer: Buffer.from('not json'),
        },
      });
      const res = MockResponse.create();

      await controller.validateSchema(req as any, res);

      expect(res.json).toHaveBeenCalledWith({
        valid: false,
        error: 'Invalid JSON format',
      });
    });

    it('should handle schema from body directly (without schema wrapper)', async () => {
      const mockSchema = { ships: [] };
      const req = createAuthRequest({
        body: mockSchema, // Direct schema without wrapper
      });
      const res = MockResponse.create();
      mockFleetViewService.validateSchema.mockReturnValue(true);

      await controller.validateSchema(req as any, res);

      expect(mockFleetViewService.validateSchema).toHaveBeenCalledWith(mockSchema);
    });
  });
});
