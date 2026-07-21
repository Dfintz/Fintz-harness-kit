import { Repository } from 'typeorm';

import { RsiSyncAuditLog, SyncType } from '../../models/RsiSyncAuditLog';
import { RsiSyncAuditService } from '../external/RsiSyncAuditService';

// Mock dependencies
jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

import { AppDataSource } from '../../data-source';

describe('RsiSyncAuditService', () => {
    let service: RsiSyncAuditService;
    let mockAuditLogRepo: jest.Mocked<Repository<RsiSyncAuditLog>>;

    const testOrganizationId = 'org-123';

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock repository
        mockAuditLogRepo = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
        } as unknown as jest.Mocked<Repository<RsiSyncAuditLog>>;

        // Setup AppDataSource mock
        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockAuditLogRepo);

        // Create service instance
        service = new RsiSyncAuditService();
    });

    describe('createLog', () => {
        it('should create an audit log entry', async () => {
            const mockLog: Partial<RsiSyncAuditLog> = {
                id: 'log-1',
                organizationId: testOrganizationId,
                syncType: SyncType.MANUAL,
                changesDetected: 5,
                changesApplied: 4,
                errors: 1,
                syncedAt: new Date(),
            };

            mockAuditLogRepo.create.mockReturnValue(mockLog as RsiSyncAuditLog);
            mockAuditLogRepo.save.mockResolvedValue(mockLog as RsiSyncAuditLog);

            const result = await service.createLog({
                organizationId: testOrganizationId,
                syncType: SyncType.MANUAL,
                changesDetected: 5,
                changesApplied: 4,
                errors: 1,
            });

            expect(result).toBeDefined();
            expect(result.organizationId).toBe(testOrganizationId);
            expect(result.syncType).toBe(SyncType.MANUAL);
            expect(mockAuditLogRepo.create).toHaveBeenCalled();
            expect(mockAuditLogRepo.save).toHaveBeenCalled();
        });
    });

    describe('logSuccess', () => {
        it('should log a successful sync', async () => {
            const mockLog: Partial<RsiSyncAuditLog> = {
                id: 'log-1',
                organizationId: testOrganizationId,
                syncType: SyncType.SCHEDULED,
                changesDetected: 3,
                changesApplied: 3,
                errors: 0,
            };

            mockAuditLogRepo.create.mockReturnValue(mockLog as RsiSyncAuditLog);
            mockAuditLogRepo.save.mockResolvedValue(mockLog as RsiSyncAuditLog);

            const result = await service.logSuccess(
                testOrganizationId,
                SyncType.SCHEDULED,
                {
                    detected: 3,
                    applied: 3,
                }
            );

            expect(result.errors).toBe(0);
            expect(result.changesApplied).toBe(3);
        });
    });

    describe('logFailure', () => {
        it('should log a failed sync', async () => {
            const mockLog: Partial<RsiSyncAuditLog> = {
                id: 'log-1',
                organizationId: testOrganizationId,
                syncType: SyncType.SCHEDULED,
                changesDetected: 0,
                changesApplied: 0,
                errors: 1,
            };

            mockAuditLogRepo.create.mockReturnValue(mockLog as RsiSyncAuditLog);
            mockAuditLogRepo.save.mockResolvedValue(mockLog as RsiSyncAuditLog);

            const result = await service.logFailure(
                testOrganizationId,
                SyncType.SCHEDULED,
                {
                    message: 'API error',
                }
            );

            expect(result.errors).toBe(1);
        });
    });

    describe('getLogs', () => {
        it('should return logs with pagination', async () => {
            const mockLogs: Partial<RsiSyncAuditLog>[] = [
                {
                    id: 'log-1',
                    organizationId: testOrganizationId,
                    syncType: SyncType.MANUAL,
                    changesDetected: 2,
                    changesApplied: 2,
                    errors: 0,
                    syncedAt: new Date(),
                },
                {
                    id: 'log-2',
                    organizationId: testOrganizationId,
                    syncType: SyncType.SCHEDULED,
                    changesDetected: 1,
                    changesApplied: 1,
                    errors: 0,
                    syncedAt: new Date(),
                },
            ];

            const mockQueryBuilder = {
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(2),
                getMany: jest.fn().mockResolvedValue(mockLogs),
            };
            mockAuditLogRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.getLogs({
                organizationId: testOrganizationId,
                limit: 10,
            });

            expect(result.logs).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should filter by sync type', async () => {
            const mockQueryBuilder = {
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(1),
                getMany: jest.fn().mockResolvedValue([]),
            };
            mockAuditLogRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            await service.getLogs({
                organizationId: testOrganizationId,
                syncType: SyncType.SCHEDULED,
            });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'log.syncType = :syncType',
                { syncType: SyncType.SCHEDULED }
            );
        });
    });

    describe('getStatistics', () => {
        it('should return statistics for an organization', async () => {
            const mockLogs: Partial<RsiSyncAuditLog>[] = [
                {
                    id: 'log-1',
                    syncType: SyncType.MANUAL,
                    changesApplied: 5,
                    errors: 0,
                    syncedAt: new Date(),
                    details: { durationMs: 1000 },
                },
                {
                    id: 'log-2',
                    syncType: SyncType.SCHEDULED,
                    changesApplied: 3,
                    errors: 1,
                    syncedAt: new Date(),
                    details: { durationMs: 2000 },
                },
            ];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockLogs),
            };
            mockAuditLogRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const stats = await service.getStatistics(testOrganizationId);

            expect(stats.totalSyncs).toBe(2);
            expect(stats.successfulSyncs).toBe(1);
            expect(stats.failedSyncs).toBe(1);
            expect(stats.totalChangesApplied).toBe(8);
            expect(stats.averageDurationMs).toBe(1500);
        });
    });

    describe('cleanupOldLogs', () => {
        it('should delete logs older than specified date', async () => {
            mockAuditLogRepo.delete.mockResolvedValue({ affected: 10, raw: {} });

            const olderThan = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            const result = await service.cleanupOldLogs(olderThan);

            expect(result).toBe(10);
            expect(mockAuditLogRepo.delete).toHaveBeenCalled();
        });
    });

    describe('getLastSuccessfulSync', () => {
        it('should return the last successful sync', async () => {
            const mockLog: Partial<RsiSyncAuditLog> = {
                id: 'log-1',
                organizationId: testOrganizationId,
                syncType: SyncType.SCHEDULED,
                errors: 0,
                syncedAt: new Date(),
            };

            mockAuditLogRepo.findOne.mockResolvedValue(mockLog as RsiSyncAuditLog);

            const result = await service.getLastSuccessfulSync(testOrganizationId);

            expect(result).toBeDefined();
            expect(result?.errors).toBe(0);
            expect(mockAuditLogRepo.findOne).toHaveBeenCalledWith({
                where: {
                    organizationId: testOrganizationId,
                    errors: 0,
                },
                order: { syncedAt: 'DESC' },
            });
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});

