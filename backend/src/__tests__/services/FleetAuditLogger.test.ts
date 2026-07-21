import { createMockDataSource, createMockRepository } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../../src/services/audit/AuditService', () => ({
  AuditCategory: { FLEET: 'FLEET' },
  auditService: { log: jest.fn() },
}));

import { FleetAuditLog } from '../../models/FleetAuditLog';
import { FleetAuditAction, FleetAuditLogger } from '../../services/fleet/FleetAuditLogger';

describe('FleetAuditLogger', () => {
  let auditLogger: FleetAuditLogger;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    FleetAuditLogger.resetInstance();
    auditLogger = FleetAuditLogger.getInstance();

    mockRepo = createMockRepository();
    mockDataSource.getRepository.mockReturnValue(mockRepo);
    mockDataSource.isInitialized = true;
  });

  afterEach(() => {
    FleetAuditLogger.resetInstance();
  });

  describe('log (persistence)', () => {
    it('should persist audit entry to the database', async () => {
      auditLogger.log({
        action: FleetAuditAction.FLEET_CREATED,
        fleetId: 'fleet-1',
        fleetName: 'Alpha Fleet',
        organizationId: 'org-1',
        performedById: 'user-1',
        performedByName: 'Test User',
        details: { description: 'New fleet' },
      });

      // Allow fire-and-forget promise to resolve
      await new Promise(resolve => setImmediate(resolve));

      expect(mockDataSource.getRepository).toHaveBeenCalledWith(FleetAuditLog);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: FleetAuditAction.FLEET_CREATED,
          fleetId: 'fleet-1',
          fleetName: 'Alpha Fleet',
          organizationId: 'org-1',
          performedById: 'user-1',
          performedByName: 'Test User',
        })
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should not throw when database persistence fails', async () => {
      mockRepo.save.mockRejectedValueOnce(new Error('DB connection lost'));

      expect(() => {
        auditLogger.log({
          action: FleetAuditAction.FLEET_DELETED,
          fleetId: 'fleet-2',
          fleetName: 'Beta Fleet',
          organizationId: 'org-1',
          details: {},
        });
      }).not.toThrow();

      // Allow fire-and-forget promise to settle
      await new Promise(resolve => setImmediate(resolve));
    });

    it('should skip database write when AppDataSource is not initialized', async () => {
      mockDataSource.isInitialized = false;

      auditLogger.log({
        action: FleetAuditAction.FLEET_UPDATED,
        fleetId: 'fleet-3',
        fleetName: 'Gamma Fleet',
        organizationId: 'org-1',
        details: {},
      });

      await new Promise(resolve => setImmediate(resolve));

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getFleetAuditLog (database query)', () => {
    it('should query the database with fleet and org filters', async () => {
      const mockRows = [
        {
          id: 'log-1',
          action: FleetAuditAction.FLEET_CREATED,
          fleetId: 'fleet-1',
          fleetName: 'Alpha Fleet',
          organizationId: 'org-1',
          performedById: 'user-1',
          performedByName: 'Admin',
          details: {},
          createdAt: new Date('2026-04-08T10:00:00Z'),
        },
      ];

      const mockQb = mockRepo.createQueryBuilder();
      mockQb.getMany.mockResolvedValue(mockRows);

      const entries = await auditLogger.getFleetAuditLog({
        fleetId: 'fleet-1',
        organizationId: 'org-1',
      });

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(
        expect.objectContaining({
          action: FleetAuditAction.FLEET_CREATED,
          fleetId: 'fleet-1',
          fleetName: 'Alpha Fleet',
          organizationId: 'org-1',
          timestamp: new Date('2026-04-08T10:00:00Z'),
        })
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.fleetId = :fleetId', {
        fleetId: 'fleet-1',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('log.organizationId = :organizationId', {
        organizationId: 'org-1',
      });
      expect(mockQb.orderBy).toHaveBeenCalledWith('log.createdAt', 'DESC');
      expect(mockQb.take).toHaveBeenCalledWith(100);
    });

    it('should apply action filter when provided', async () => {
      const mockQb = mockRepo.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      await auditLogger.getFleetAuditLog({
        fleetId: 'fleet-1',
        organizationId: 'org-1',
        action: FleetAuditAction.SHIP_ADDED_TO_FLEET,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.action = :action', {
        action: FleetAuditAction.SHIP_ADDED_TO_FLEET,
      });
    });

    it('should respect custom limit', async () => {
      const mockQb = mockRepo.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      await auditLogger.getFleetAuditLog({
        fleetId: 'fleet-1',
        organizationId: 'org-1',
        limit: 25,
      });

      expect(mockQb.take).toHaveBeenCalledWith(25);
    });

    it('should fall back to in-memory buffer when DB query fails', async () => {
      const mockQb = mockRepo.createQueryBuilder();
      mockQb.getMany.mockRejectedValueOnce(new Error('Query failed'));

      const entries = await auditLogger.getFleetAuditLog({
        fleetId: 'fleet-1',
        organizationId: 'org-1',
      });

      // Should return empty array from in-memory buffer (no entries logged yet)
      expect(entries).toEqual([]);
    });

    it('should fall back to in-memory buffer when AppDataSource is not initialized', async () => {
      mockDataSource.isInitialized = false;

      const entries = await auditLogger.getFleetAuditLog({
        fleetId: 'fleet-1',
        organizationId: 'org-1',
      });

      expect(entries).toEqual([]);
      expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
