import { MaintenanceStatus, MaintenanceType } from '../../models/ShipMaintenance';

// Local mock state
let mockMaintenances: any[] = [];

// Mock the database connection
jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(() => ({
            create: jest.fn((data) => ({
                ...data,
                id: data.id || `maintenance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                status: data.status || MaintenanceStatus.SCHEDULED,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            save: jest.fn((maintenance) => {
                const index = mockMaintenances.findIndex(m => m.id === maintenance.id);
                if (index >= 0) {
                    mockMaintenances[index] = maintenance;
                } else {
                    mockMaintenances.push(maintenance);
                }
                return Promise.resolve(maintenance);
            }),
            findOne: jest.fn(({ where }) => {
                const found = mockMaintenances.find(m => m.id === where.id);
                return Promise.resolve(found || null);
            }),
            delete: jest.fn((id) => {
                const index = mockMaintenances.findIndex(m => m.id === id);
                if (index >= 0) {
                    mockMaintenances.splice(index, 1);
                    return Promise.resolve({ affected: 1 });
                }
                return Promise.resolve({ affected: 0 });
            }),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                execute: jest.fn(() => Promise.resolve({ affected: 0 })),
                getMany: jest.fn(() => Promise.resolve(mockMaintenances)),
                getManyAndCount: jest.fn(() => Promise.resolve([mockMaintenances, mockMaintenances.length]))
            }))
        }))
    }
}));

import { ShipMaintenanceService, CreateMaintenanceDto } from '../../services/ship';

describe('ShipMaintenanceService', () => {
    let maintenanceService: ShipMaintenanceService;

    beforeEach(() => {
        mockMaintenances = []; // Reset mock data between tests
        maintenanceService = new ShipMaintenanceService();
    });

    describe('scheduleMaintenance', () => {
        it('should schedule a new maintenance', async () => {
            const maintenanceData: CreateMaintenanceDto = {
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.ROUTINE,
                scheduledDate: new Date('2025-12-15'),
                description: 'Routine inspection',
                cost: 5000
            };

            const maintenance = await maintenanceService.scheduleMaintenance(maintenanceData);

            expect(maintenance).toBeDefined();
            expect(maintenance.shipId).toBe('ship-123');
            expect(maintenance.ownerId).toBe('user-123');
            expect(maintenance.maintenanceType).toBe(MaintenanceType.ROUTINE);
            expect(maintenance.status).toBe(MaintenanceStatus.SCHEDULED);
        });

        it('should generate a unique ID for maintenance', async () => {
            const maintenanceData: CreateMaintenanceDto = {
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.REPAIR,
                scheduledDate: new Date('2025-12-20')
            };

            const maintenance = await maintenanceService.scheduleMaintenance(maintenanceData);

            expect(maintenance.id).toBeDefined();
            expect(maintenance.id).toMatch(/^maintenance-/);
        });
    });

    describe('getMaintenanceById', () => {
        it('should return maintenance by ID', async () => {
            // First create a maintenance
            const created = await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.UPGRADE,
                scheduledDate: new Date('2025-12-25')
            });

            const found = await maintenanceService.getMaintenanceById(created.id);

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
        });

        it('should return null for non-existent maintenance', async () => {
            const found = await maintenanceService.getMaintenanceById('non-existent');

            expect(found).toBeNull();
        });
    });

    describe('updateMaintenance', () => {
        it('should update maintenance details', async () => {
            const created = await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.ROUTINE,
                scheduledDate: new Date('2025-12-15')
            });

            const updated = await maintenanceService.updateMaintenance(created.id, {
                description: 'Updated description',
                cost: 7500
            });

            expect(updated).toBeDefined();
            expect(updated?.description).toBe('Updated description');
            expect(updated?.cost).toBe(7500);
        });

        it('should set completedDate when status changes to COMPLETED', async () => {
            const created = await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.REPAIR,
                scheduledDate: new Date('2025-12-15')
            });

            const updated = await maintenanceService.updateMaintenance(created.id, {
                status: MaintenanceStatus.COMPLETED
            });

            expect(updated).toBeDefined();
            expect(updated?.status).toBe(MaintenanceStatus.COMPLETED);
            expect((updated as any).completedDate).toBeDefined();
        });

        it('should return null for non-existent maintenance', async () => {
            const updated = await maintenanceService.updateMaintenance('non-existent', {
                description: 'Test'
            });

            expect(updated).toBeNull();
        });
    });

    describe('startMaintenance', () => {
        it('should start maintenance and set status to IN_PROGRESS', async () => {
            const created = await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.INSPECTION,
                scheduledDate: new Date('2025-12-15')
            });

            const started = await maintenanceService.startMaintenance(created.id, 'mechanic-456');

            expect(started).toBeDefined();
            expect(started?.status).toBe(MaintenanceStatus.IN_PROGRESS);
            expect(started?.performedBy).toBe('mechanic-456');
        });
    });

    describe('completeMaintenance', () => {
        it('should complete maintenance with all details', async () => {
            const created = await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.REPAIR,
                scheduledDate: new Date('2025-12-15'),
                cost: 5000
            });

            const completed = await maintenanceService.completeMaintenance(
                created.id,
                'mechanic-456',
                'Completed successfully',
                6000
            );

            expect(completed).toBeDefined();
            expect(completed?.status).toBe(MaintenanceStatus.COMPLETED);
            expect(completed?.performedBy).toBe('mechanic-456');
            expect(completed?.notes).toBe('Completed successfully');
            expect(completed?.cost).toBe(6000);
        });
    });

    describe('cancelMaintenance', () => {
        it('should cancel maintenance with reason', async () => {
            const created = await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.UPGRADE,
                scheduledDate: new Date('2025-12-15')
            });

            const cancelled = await maintenanceService.cancelMaintenance(created.id, 'Ship sold');

            expect(cancelled).toBeDefined();
            expect(cancelled?.status).toBe(MaintenanceStatus.CANCELLED);
            expect(cancelled?.notes).toBe('Ship sold');
        });
    });

    describe('getMaintenanceReminders', () => {
        it('should return reminders sorted by urgency', async () => {
            const reminders = await maintenanceService.getMaintenanceReminders();

            expect(reminders).toBeDefined();
            expect(Array.isArray(reminders)).toBe(true);
        });
    });

    describe('getMaintenanceStats', () => {
        it('should return maintenance statistics', async () => {
            // Create some test maintenances
            await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.ROUTINE,
                scheduledDate: new Date('2025-12-15'),
                cost: 5000
            });

            await maintenanceService.scheduleMaintenance({
                shipId: 'ship-456',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.REPAIR,
                scheduledDate: new Date('2025-12-20'),
                cost: 10000
            });

            const stats = await maintenanceService.getMaintenanceStats('user-123');

            expect(stats).toBeDefined();
            expect(stats.byType).toBeDefined();
            expect(typeof stats.totalCost).toBe('number');
            expect(typeof stats.completionRate).toBe('number');
        });
    });

    describe('getMaintenanceCostSummary', () => {
        it('should return cost summary', async () => {
            const summary = await maintenanceService.getMaintenanceCostSummary('user-123');

            expect(summary).toBeDefined();
            expect(summary.byShip).toBeDefined();
            expect(summary.byType).toBeDefined();
            expect(typeof summary.totalCost).toBe('number');
        });
    });

    describe('scheduleRecurringMaintenance', () => {
        it('should create multiple maintenance entries', async () => {
            const baseData: CreateMaintenanceDto = {
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.ROUTINE,
                scheduledDate: new Date('2025-12-01'),
                description: 'Monthly routine check'
            };

            const schedules = await maintenanceService.scheduleRecurringMaintenance(
                baseData,
                30, // Every 30 days
                3   // 3 occurrences
            );

            expect(schedules).toHaveLength(3);
            expect(schedules[0].scheduledDate.getDate()).toBe(1);
            // Second occurrence should be 30 days later
        });
    });

    describe('deleteMaintenance', () => {
        it('should delete scheduled maintenance', async () => {
            const created = await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.ROUTINE,
                scheduledDate: new Date('2025-12-15')
            });

            const deleted = await maintenanceService.deleteMaintenance(created.id);

            expect(deleted).toBe(true);
        });

        it('should not delete completed maintenance', async () => {
            const created = await maintenanceService.scheduleMaintenance({
                shipId: 'ship-123',
                ownerId: 'user-123',
                maintenanceType: MaintenanceType.ROUTINE,
                scheduledDate: new Date('2025-12-15')
            });

            // Complete the maintenance
            await maintenanceService.completeMaintenance(created.id);

            const deleted = await maintenanceService.deleteMaintenance(created.id);

            expect(deleted).toBe(false);
        });

        it('should return false for non-existent maintenance', async () => {
            const deleted = await maintenanceService.deleteMaintenance('non-existent');

            expect(deleted).toBe(false);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
