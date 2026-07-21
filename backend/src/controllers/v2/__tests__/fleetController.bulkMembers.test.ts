import { Repository } from 'typeorm';

import { ApiError } from '../../../middleware/errorHandlerV2';
import { FleetShip } from '../../../models/FleetShip';
import { ApiErrorCode } from '../../../types/api';

import {
  applyBulkDelete,
  applyBulkUpdate,
  validateBulkDeleteItems,
  validateBulkUpdates,
} from '../fleetController.bulkMembers';

describe('fleetController.bulkMembers', () => {
  describe('validateBulkUpdates', () => {
    it('accepts valid update rows', () => {
      expect(() =>
        validateBulkUpdates([
          { fleetId: 'f1', shipId: 's1', role: 'escort' },
          { fleetId: 'f2', shipId: 's2', notes: 'reserve' },
        ])
      ).not.toThrow();
    });

    it('rejects missing identifiers', () => {
      expect(() => validateBulkUpdates([{ fleetId: 'f1' }])).toThrow(ApiError);
      expect(() => validateBulkUpdates([{ shipId: 's1' }])).toThrow(ApiError);
    });

    it('rejects rows without role or notes', () => {
      expect(() => validateBulkUpdates([{ fleetId: 'f1', shipId: 's1' }])).toThrow(
        expect.objectContaining({
          code: ApiErrorCode.INVALID_INPUT,
          message: 'Each update must include at least one of role or notes',
        })
      );
    });
  });

  describe('validateBulkDeleteItems', () => {
    it('accepts valid delete rows', () => {
      expect(() =>
        validateBulkDeleteItems([
          { fleetId: 'f1', shipId: 's1' },
          { fleetId: 'f2', shipId: 's2' },
        ])
      ).not.toThrow();
    });

    it('rejects missing identifiers', () => {
      expect(() => validateBulkDeleteItems([{ fleetId: 'f1' }])).toThrow(ApiError);
      expect(() => validateBulkDeleteItems([{ shipId: 's1' }])).toThrow(ApiError);
    });
  });

  describe('applyBulkUpdate', () => {
    it('returns updated=false when assignment does not exist', async () => {
      const txRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
      } as unknown as Repository<FleetShip>;

      const result = await applyBulkUpdate(txRepo, 'org-1', {
        fleetId: 'fleet-1',
        shipId: 'ship-1',
        role: 'escort',
      });

      expect(result).toEqual({ updated: false });
      expect(txRepo.save).not.toHaveBeenCalled();
    });

    it('updates assignment fields and saves when assignment exists', async () => {
      const assignment = {
        fleetId: 'fleet-1',
        shipId: 'ship-1',
        role: 'old',
        notes: 'old-note',
      } as FleetShip;
      const txRepo = {
        findOne: jest.fn().mockResolvedValue(assignment),
        save: jest.fn().mockResolvedValue(undefined),
      } as unknown as Repository<FleetShip>;

      const result = await applyBulkUpdate(txRepo, 'org-1', {
        fleetId: 'fleet-1',
        shipId: 'ship-1',
        role: 'new-role',
        notes: 'new-note',
      });

      expect(result).toEqual({ updated: true });
      expect(assignment.role).toBe('new-role');
      expect(assignment.notes).toBe('new-note');
      expect(txRepo.save).toHaveBeenCalledWith(assignment);
    });
  });

  describe('applyBulkDelete', () => {
    it('returns false when assignment does not exist', async () => {
      const txRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        remove: jest.fn(),
      } as unknown as Repository<FleetShip>;

      const removed = await applyBulkDelete(txRepo, 'org-1', {
        fleetId: 'fleet-1',
        shipId: 'ship-1',
      });

      expect(removed).toBe(false);
      expect(txRepo.remove).not.toHaveBeenCalled();
    });

    it('removes assignment and returns true when assignment exists', async () => {
      const assignment = { fleetId: 'fleet-1', shipId: 'ship-1' } as FleetShip;
      const txRepo = {
        findOne: jest.fn().mockResolvedValue(assignment),
        remove: jest.fn().mockResolvedValue(undefined),
      } as unknown as Repository<FleetShip>;

      const removed = await applyBulkDelete(txRepo, 'org-1', {
        fleetId: 'fleet-1',
        shipId: 'ship-1',
      });

      expect(removed).toBe(true);
      expect(txRepo.remove).toHaveBeenCalledWith(assignment);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
