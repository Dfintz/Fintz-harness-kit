// Mock TypeORM before imports
import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';
const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

import { Fleet } from '../../models/Fleet';
import { FleetService } from '../../services/fleet';
import { FleetNotFoundError, NotFoundError, ValidationError } from '../../utils/apiErrors';

describe('FleetService', () => {
  let fleetService: FleetService;
  let mockFleets: Partial<Fleet>[];

  beforeEach(() => {
    // Reset mock data
    mockFleets = [];

    // Setup Fleet repository mock with smart data handling
    const mockRepo = createMockRepositoryWithData(mockFleets);
    mockDataSource.getRepository.mockReturnValue(mockRepo);

    fleetService = new FleetService();
    jest.clearAllMocks();
  });

  describe('getFleets', () => {
    it('should return all fleets', async () => {
      // Pre-populate mock data with organizationId
      mockFleets.push(
        {
          id: '1',
          organizationId: 'org-123',
          name: 'Fleet Alpha',
          members: ['user1', 'user2'],
        } as any,
        { id: '2', organizationId: 'org-123', name: 'Fleet Beta', members: ['user3'] } as any
      );

      const result = await fleetService.getFleets('org-123');

      expect(result).toEqual(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'Fleet Alpha' }),
            expect.objectContaining({ name: 'Fleet Beta' }),
          ]),
        })
      );
    });
  });

  describe('getFleetById', () => {
    it('should return a fleet by ID', async () => {
      const mockFleet = {
        id: '1',
        organizationId: 'org-123',
        name: 'Fleet Alpha',
        members: ['user1'],
      };
      mockFleets.push(mockFleet as any);

      const result = await fleetService.getFleetById('org-123', '1');

      expect(result).toMatchObject({ name: 'Fleet Alpha', id: '1' });
    });

    it('should return null if fleet not found', async () => {
      const result = await fleetService.getFleetById('org-123', '999');

      expect(result).toBeNull();
    });
  });

  describe('updateFleet', () => {
    it('should update and return the fleet', async () => {
      mockFleets.push({
        id: '1',
        organizationId: 'org-123',
        name: 'Original Fleet',
        members: [],
      } as any);
      const fleetData = { name: 'Updated Fleet' };

      const result = await fleetService.updateFleet('org-123', '1', fleetData as any);

      expect(result?.name).toBe('Updated Fleet');
    });
  });

  describe('typed error contract', () => {
    it('bulkCreateFleets throws ValidationError (400) for an empty list', async () => {
      const error = await fleetService.bulkCreateFleets('org-123', []).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('bulkCreateFleets throws ValidationError (400) for more than 100 fleets', async () => {
      const data = Array.from({ length: 101 }, (_, i) => ({ name: `Fleet ${i}` }));
      const error = await fleetService.bulkCreateFleets('org-123', data).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('bulkUpdateFleets throws ValidationError (400) for an empty list', async () => {
      const error = await fleetService.bulkUpdateFleets('org-123', []).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('bulkDeleteFleets throws ValidationError (400) for an empty list', async () => {
      const error = await fleetService.bulkDeleteFleets('org-123', []).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('bulkShareFleets throws ValidationError (400) for an empty list', async () => {
      const error = await fleetService
        .bulkShareFleets('org-123', [], 'org-target')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('moveFleet throws FleetNotFoundError (404) when the fleet does not exist', async () => {
      const error = await fleetService
        .moveFleet('org-123', 'missing', null)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FleetNotFoundError);
      expect((error as FleetNotFoundError).statusCode).toBe(404);
    });

    it('moveFleet throws ValidationError (400) when moving a fleet under itself', async () => {
      mockFleets.push({ id: 'f1', organizationId: 'org-123', name: 'Fleet', members: [] } as any);

      const error = await fleetService.moveFleet('org-123', 'f1', 'f1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('moveFleet throws NotFoundError (404) when the target parent does not exist', async () => {
      mockFleets.push({ id: 'f1', organizationId: 'org-123', name: 'Fleet', members: [] } as any);

      const error = await fleetService
        .moveFleet('org-123', 'f1', 'missing-parent')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
