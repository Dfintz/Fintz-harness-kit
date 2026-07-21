/**
 * OrgWatchlistService — Phase C unit tests
 *
 * Wave 2.1 — Membership Audit & Intel
 */
import { WatchlistReason, WatchlistThreatLevel } from '@sc-fleet-manager/shared-types';

/* ─── Mock AppDataSource BEFORE any service imports ──────────────── */

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
};

const mockRepo = {
  create: jest.fn((dto: Record<string, unknown>) => ({ ...dto })),
  save: jest.fn((entity: Record<string, unknown>) => ({
    ...entity,
    id: entity.id ?? 'entry-1',
    createdAt: entity.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    updatedAt: entity.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
  })),
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue({ affected: 0 }),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockRepo),
  },
}));

import { OrgWatchlistService } from '../../../services/intel/OrgWatchlistService';

/* ─── Constants ──────────────────────────────────────────────────── */

const ORG_ID = 'org-abc';
const OFFICER_ID = 'officer-42';

const makeEntry = (overrides?: Record<string, unknown>) => ({
  id: 'entry-1',
  organizationId: ORG_ID,
  rsiHandle: 'HOSTILE1',
  citizenName: 'HostilePlayer',
  reason: WatchlistReason.HOSTILE,
  threatLevel: WatchlistThreatLevel.HIGH,
  notes: 'Known griefer',
  addedBy: OFFICER_ID,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

/* ================================================================= */

describe('OrgWatchlistService', () => {
  let service: OrgWatchlistService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrgWatchlistService();
  });

  /* ─── createEntry ──────────────────────────────────────────────── */

  describe('createEntry', () => {
    it('should create and return a WatchlistEntrySummary', async () => {
      const dto = {
        rsiHandle: 'hostile1',
        citizenName: 'HostilePlayer',
        reason: WatchlistReason.HOSTILE,
        threatLevel: WatchlistThreatLevel.HIGH,
        notes: 'Known griefer',
      };

      const result = await service.createEntry(ORG_ID, OFFICER_ID, dto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          addedBy: OFFICER_ID,
          rsiHandle: 'HOSTILE1', // uppercased
          citizenName: 'HostilePlayer',
          reason: WatchlistReason.HOSTILE,
          threatLevel: WatchlistThreatLevel.HIGH,
        })
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result.rsiHandle).toBe('HOSTILE1');
      expect(typeof result.createdAt).toBe('string'); // ISO string
    });

    it('should normalise rsiHandle to uppercase and trim', async () => {
      const dto = {
        rsiHandle: '  testhandle  ',
        citizenName: 'Test Citizen',
        reason: WatchlistReason.SUSPICIOUS,
        threatLevel: WatchlistThreatLevel.LOW,
      };

      await service.createEntry(ORG_ID, OFFICER_ID, dto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ rsiHandle: 'TESTHANDLE' })
      );
    });
  });

  /* ─── getEntryById ─────────────────────────────────────────────── */

  describe('getEntryById', () => {
    it('should return summary when entry exists', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeEntry());

      const result = await service.getEntryById(ORG_ID, 'entry-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('entry-1');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'entry-1', organizationId: ORG_ID },
      });
    });

    it('should return null when not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.getEntryById(ORG_ID, 'missing');
      expect(result).toBeNull();
    });
  });

  /* ─── listEntries ──────────────────────────────────────────────── */

  describe('listEntries', () => {
    it('should use default pagination when no query provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await service.listEntries(ORG_ID);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('w.createdAt', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(25);
      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 25 });
    });

    it('should apply reason filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await service.listEntries(ORG_ID, {
        reasons: [WatchlistReason.HOSTILE, WatchlistReason.GRIEFER],
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('w.reason IN (:...reasons)', {
        reasons: [WatchlistReason.HOSTILE, WatchlistReason.GRIEFER],
      });
    });

    it('should apply threat level filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await service.listEntries(ORG_ID, {
        threatLevels: [WatchlistThreatLevel.CRITICAL],
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'w.threatLevel IN (:...threatLevels)',
        { threatLevels: [WatchlistThreatLevel.CRITICAL] }
      );
    });

    it('should apply search filter (case-insensitive)', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await service.listEntries(ORG_ID, { search: 'Hostile' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(LOWER(w.rsiHandle) LIKE :search OR LOWER(w.citizenName) LIKE :search)',
        { search: '%hostile%' }
      );
    });

    it('should cap pageSize at 100', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await service.listEntries(ORG_ID, { pageSize: 500 });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
      expect(result.pageSize).toBe(100);
    });

    it('should return mapped summaries', async () => {
      const entries = [makeEntry(), makeEntry({ id: 'entry-2', rsiHandle: 'GRIEFER1' })];
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([entries, 2]);

      const result = await service.listEntries(ORG_ID);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(typeof result.data[0].createdAt).toBe('string');
    });
  });

  /* ─── updateEntry ──────────────────────────────────────────────── */

  describe('updateEntry', () => {
    it('should update specified fields only', async () => {
      const entry = makeEntry();
      mockRepo.findOne.mockResolvedValueOnce(entry);

      await service.updateEntry(ORG_ID, 'entry-1', {
        threatLevel: WatchlistThreatLevel.CRITICAL,
        notes: 'Escalated',
      });

      expect(entry.threatLevel).toBe(WatchlistThreatLevel.CRITICAL);
      expect(entry.notes).toBe('Escalated');
      // Reason should remain unchanged
      expect(entry.reason).toBe(WatchlistReason.HOSTILE);
      expect(mockRepo.save).toHaveBeenCalledWith(entry);
    });

    it('should throw when entry not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.updateEntry(ORG_ID, 'missing', { notes: 'nope' })).rejects.toThrow(
        'Watchlist entry not found'
      );
    });
  });

  /* ─── deleteEntry ──────────────────────────────────────────────── */

  describe('deleteEntry', () => {
    it('should return true when entry deleted', async () => {
      mockRepo.delete.mockResolvedValueOnce({ affected: 1 });

      const result = await service.deleteEntry(ORG_ID, 'entry-1');

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith({
        id: 'entry-1',
        organizationId: ORG_ID,
      });
    });

    it('should return false when entry not found', async () => {
      mockRepo.delete.mockResolvedValueOnce({ affected: 0 });

      const result = await service.deleteEntry(ORG_ID, 'missing');
      expect(result).toBe(false);
    });
  });

  /* ─── crossReference ───────────────────────────────────────────── */

  describe('crossReference', () => {
    it('should return empty array when given empty input', async () => {
      const result = await service.crossReference(ORG_ID, []);
      expect(result).toEqual([]);
      expect(mockRepo.find).not.toHaveBeenCalled();
    });

    it('should normalise handles and return matching entries', async () => {
      const entry = makeEntry();
      mockRepo.find.mockResolvedValueOnce([entry]);

      const result = await service.crossReference(ORG_ID, ['hostile1', 'unknown1']);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {
          organizationId: ORG_ID,
          rsiHandle: expect.anything(), // In(['HOSTILE1', 'UNKNOWN1'])
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].rsiHandle).toBe('HOSTILE1');
      expect(result[0].entry.id).toBe('entry-1');
    });

    it('should return empty when no matches', async () => {
      mockRepo.find.mockResolvedValueOnce([]);

      const result = await service.crossReference(ORG_ID, ['safe1']);
      expect(result).toHaveLength(0);
    });
  });

  /* ─── findBySid ────────────────────────────────────────────────── */

  describe('findByHandle', () => {
    it('should return summary when handle found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeEntry());

      const result = await service.findByHandle(ORG_ID, 'hostile1');

      expect(result).not.toBeNull();
      expect(result!.rsiHandle).toBe('HOSTILE1');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, rsiHandle: 'HOSTILE1' },
      });
    });

    it('should return null when handle not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.findByHandle(ORG_ID, 'unknown');
      expect(result).toBeNull();
    });
  });
});
