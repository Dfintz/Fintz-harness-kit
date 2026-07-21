import { Repository } from 'typeorm';

const mockGetRepository = jest.fn();
const mockEmitFleetUpdated = jest.fn();
const mockSyncTeamCapacity = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: (...args: unknown[]) => mockGetRepository(...args),
  },
}));

jest.mock('../../../websocket/controllers/fleetWebSocketController', () => ({
  emitFleetUpdated: (...args: unknown[]) => mockEmitFleetUpdated(...args),
}));

jest.mock('../../../services/fleet/FleetTeamService', () => ({
  FleetTeamService: {
    getInstance: () => ({
      syncTeamCapacity: (...args: unknown[]) => mockSyncTeamCapacity(...args),
    }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { Fleet } from '../../../models/Fleet';

import {
  emitTouchedFleetUpdates,
  syncTeamCapacityForFleets,
} from '../fleetController.postBulkUpdates';

describe('fleetController.postBulkUpdates', () => {
  const mockFind = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRepository.mockReturnValue({ find: mockFind });
  });

  describe('emitTouchedFleetUpdates', () => {
    it('returns an empty list when no fleets were touched', async () => {
      const result = await emitTouchedFleetUpdates('org-1', 'user-1', new Set<string>());

      expect(result).toEqual([]);
      expect(mockFind).not.toHaveBeenCalled();
      expect(mockEmitFleetUpdated).not.toHaveBeenCalled();
    });

    it('loads touched fleets and emits updates for each one', async () => {
      const fleets = [{ id: 'fleet-1' }, { id: 'fleet-2' }] as Fleet[];
      mockFind.mockResolvedValue(fleets);

      const result = await emitTouchedFleetUpdates(
        'org-1',
        'user-1',
        new Set(['fleet-1', 'fleet-2'])
      );

      expect(result).toBe(fleets);
      expect(mockFind).toHaveBeenCalledWith({
        where: { id: expect.anything(), organizationId: 'org-1' },
      });
      expect(mockEmitFleetUpdated).toHaveBeenNthCalledWith(1, 'org-1', { id: 'fleet-1' }, 'user-1');
      expect(mockEmitFleetUpdated).toHaveBeenNthCalledWith(2, 'org-1', { id: 'fleet-2' }, 'user-1');
    });
  });

  describe('syncTeamCapacityForFleets', () => {
    it('skips syncing when there are no fleets', async () => {
      await syncTeamCapacityForFleets('org-1', []);

      expect(mockSyncTeamCapacity).not.toHaveBeenCalled();
    });

    it('syncs each fleet and logs warnings for failures', async () => {
      mockSyncTeamCapacity
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('boom'));

      await syncTeamCapacityForFleets('org-1', [{ id: 'fleet-1' }, { id: 'fleet-2' }] as Fleet[]);

      expect(mockSyncTeamCapacity).toHaveBeenNthCalledWith(1, 'org-1', 'fleet-1');
      expect(mockSyncTeamCapacity).toHaveBeenNthCalledWith(2, 'org-1', 'fleet-2');
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'Failed to sync team capacity after bulk fleet change',
        {
          fleetId: 'fleet-2',
          error: 'boom',
        }
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
