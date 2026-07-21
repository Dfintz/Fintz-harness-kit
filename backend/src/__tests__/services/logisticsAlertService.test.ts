import { AppDataSource } from '../../config/database';
import { StockStatus } from '../../models/FleetInventory';
import { 
    LogisticsAlert, 
    AlertType, 
    AlertSeverity, 
    AlertStatus,
    NotificationChannel 
} from '../../models/LogisticsAlert';
import { FleetInventoryService } from '../../services/fleet';
import { LogisticsAlertService } from '../../services/trade/logistics/LogisticsAlertService';

jest.mock('../../config/database');
jest.mock('../../services/fleet');

describe('LogisticsAlertService', () => {
    let service: LogisticsAlertService;
    let inventoryService: jest.Mocked<FleetInventoryService>;
    let mockAlertRepository: any;
    let mockInventoryRepository: any;

    beforeEach(() => {
        mockAlertRepository = {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            }))
        };

        mockInventoryRepository = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            save: jest.fn()
        };

        (AppDataSource.getRepository as jest.Mock) = jest.fn((entity) => {
            if (entity.name === 'LogisticsAlert') {return mockAlertRepository;}
            if (entity.name === 'FleetInventory') {return mockInventoryRepository;}
            return mockAlertRepository; // Default
        });

        inventoryService = {
            getInventory: jest.fn()
        } as any;

        service = new LogisticsAlertService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ==================== CREATE ALERT ====================
    describe('createAlert', () => {
        it('should create a new alert', async () => {
            const dto = {
                fleetId: 'fleet-123',
                inventoryItemId: 'item-1',
                itemName: 'Hydrogen Fuel',
                type: AlertType.LOW_STOCK,
                severity: AlertSeverity.WARNING,
                title: 'Low Stock Alert',
                message: 'Fuel levels are below threshold',
                recipients: ['user-1', 'user-2'],
                notificationChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
            };

            const expectedAlert = {
                ...dto,
                status: AlertStatus.ACTIVE,
                id: 'alert-1'
            };

            mockAlertRepository.create.mockReturnValue(expectedAlert);
            mockAlertRepository.save.mockResolvedValue(expectedAlert);

            const result = await service.createAlert(dto as any);

            expect(mockAlertRepository.create).toHaveBeenCalledWith(expect.objectContaining(dto));
            expect(result).toEqual(expectedAlert);
        });

        it('should create alert with auto-resolve enabled', async () => {
            const dto = {
                fleetId: 'fleet-123',
                inventoryItemId: 'item-1',
                itemName: 'Medical Supplies',
                type: AlertType.CRITICAL_STOCK,
                severity: AlertSeverity.CRITICAL,
                title: 'Critical Stock Alert',
                message: 'Medical supplies critically low',
                recipients: ['admin-1'],
                notificationChannels: [NotificationChannel.DISCORD],
                autoResolve: true
            };

            mockAlertRepository.create.mockReturnValue(dto);
            mockAlertRepository.save.mockResolvedValue(dto);

            const result = await service.createAlert(dto as any);

            expect(result.autoResolve).toBe(true);
        });
    });

    // ==================== CHECK INVENTORY & GENERATE ALERTS ====================
    describe('checkInventoryAndGenerateAlerts', () => {
        it('should generate alerts for low stock items', async () => {
            const mockLowStockItems = [
                {
                    id: 'item-1',
                    fleetId: 'fleet-123',
                    itemName: 'Fuel',
                    status: StockStatus.ADEQUATE, // Start with adequate, will change to LOW
                    quantity: 1500,
                    thresholds: { lowLevel: 2000, criticalLevel: 1000 },
                    alertEnabled: true
                },
                {
                    id: 'item-2',
                    fleetId: 'fleet-123',
                    itemName: 'Ammo',
                    status: StockStatus.LOW, // Start with low, will change to CRITICAL
                    quantity: 50,
                    thresholds: { lowLevel: 200, criticalLevel: 100 },
                    alertEnabled: true
                }
            ];

            // Mock inventory repository to return low stock items
            mockInventoryRepository.find.mockResolvedValue(mockLowStockItems);
            
            // Mock existing alerts check
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };
            mockAlertRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
            mockAlertRepository.create.mockImplementation((dto: any) => dto);
            mockAlertRepository.save.mockImplementation((alert: any) => Promise.resolve(alert));

            const result = await service.checkInventoryAndGenerateAlerts('fleet-123');

            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should not generate duplicate alerts', async () => {
            const mockLowStockItems = [
                {
                    id: 'item-1',
                    fleetId: 'fleet-123',
                    itemName: 'Fuel',
                    status: StockStatus.LOW,
                    quantity: 1500,
                    thresholds: { lowLevel: 2000, criticalLevel: 1000 },
                    alertEnabled: true
                }
            ];

            const existingAlert = {
                id: 'alert-1',
                inventoryItemId: 'item-1',
                type: AlertType.LOW_STOCK,
                status: AlertStatus.ACTIVE
            };

            mockInventoryRepository.find.mockResolvedValue(mockLowStockItems);
            
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([existingAlert])
            };
            mockAlertRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
            mockAlertRepository.save.mockResolvedValue(existingAlert);

            const result = await service.checkInventoryAndGenerateAlerts('fleet-123');

            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBe(0);
        });
    });

    // ==================== ACKNOWLEDGE ALERT ====================
    describe('acknowledgeAlert', () => {
        it('should acknowledge an active alert', async () => {
            const existingAlert = {
                id: 'alert-1',
                status: AlertStatus.ACTIVE,
                acknowledgedBy: null,
                acknowledgedAt: null
            };

            const userId = 'user-1';

            mockAlertRepository.findOne.mockResolvedValue(existingAlert);
            mockAlertRepository.save.mockResolvedValue({
                ...existingAlert,
                status: AlertStatus.ACKNOWLEDGED,
                acknowledgedBy: userId,
                acknowledgedAt: expect.any(Date)
            });

            const result = await service.acknowledgeAlert('alert-1', userId);

            expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
            expect(result.acknowledgedBy).toBe('user-1');
            expect(result.acknowledgedAt).toBeDefined();
        });

        it('should throw error for non-existent alert', async () => {
            mockAlertRepository.findOne.mockResolvedValue(null);

            await expect(
                service.acknowledgeAlert('nonexistent', 'user-1')
            ).rejects.toThrow();
        });
    });

    // ==================== RESOLVE ALERT ====================
    describe('resolveAlert', () => {
        it('should resolve an acknowledged alert', async () => {
            const existingAlert = {
                id: 'alert-1',
                status: AlertStatus.ACKNOWLEDGED,
                resolvedBy: null,
                resolvedAt: null
            };

            const resolveDto = {
                userId: 'user-1',
                notes: 'Stock replenished'
            };

            mockAlertRepository.findOne.mockResolvedValue(existingAlert);
            mockAlertRepository.save.mockResolvedValue({
                ...existingAlert,
                status: AlertStatus.RESOLVED,
                resolvedBy: 'user-1',
                resolvedAt: expect.any(Date),
                resolutionNotes: 'Stock replenished'
            });

            const result = await service.resolveAlert('alert-1', resolveDto.userId);

            expect(result.status).toBe(AlertStatus.RESOLVED);
            expect(result.resolvedBy).toBe('user-1');
            expect(result.resolvedAt).toBeDefined();
        });

        it('should allow resolving active alert directly', async () => {
            const existingAlert = {
                id: 'alert-1',
                status: AlertStatus.ACTIVE
            };

            mockAlertRepository.findOne.mockResolvedValue(existingAlert);
            mockAlertRepository.save.mockResolvedValue({
                ...existingAlert,
                status: AlertStatus.RESOLVED
            });

            const result = await service.resolveAlert('alert-1', 'user-1');

            expect(result.status).toBe(AlertStatus.RESOLVED);
        });
    });

    // ==================== DISMISS ALERT ====================
    describe('dismissAlert', () => {
        it('should dismiss an alert', async () => {
            const existingAlert = {
                id: 'alert-1',
                status: AlertStatus.ACTIVE
            };

            mockAlertRepository.findOne.mockResolvedValue(existingAlert);
            mockAlertRepository.save.mockResolvedValue({
                ...existingAlert,
                status: AlertStatus.DISMISSED,
                resolvedAt: expect.any(Date)
            });

            const result = await service.dismissAlert('alert-1');

            expect(result.status).toBe(AlertStatus.DISMISSED);
        });
    });

    // ==================== AUTO-RESOLVE ALERTS ====================
    describe('autoResolveAlerts', () => {
        it('should auto-resolve alerts when conditions improve', async () => {
            const mockAlerts = [
                {
                    id: 'alert-1',
                    fleetId: 'fleet-123',
                    inventoryItemId: 'item-1',
                    type: AlertType.LOW_STOCK,
                    status: AlertStatus.ACTIVE,
                    autoResolve: true
                }
            ];

            const mockInventoryItem = {
                id: 'item-1',
                status: StockStatus.ADEQUATE,
                quantity: 5000
            };

            mockAlertRepository.find.mockResolvedValue(mockAlerts);
            mockInventoryRepository.findOne.mockResolvedValue(mockInventoryItem);
            mockAlertRepository.save.mockImplementation((alert: any) => Promise.resolve({ ...alert, status: AlertStatus.RESOLVED }));

            const result = await service.autoResolveAlerts();

            expect(result).toBeGreaterThan(0);
        });

        it('should not resolve alerts with autoResolve disabled', async () => {
            const mockAlerts = [
                {
                    id: 'alert-1',
                    fleetId: 'fleet-123',
                    inventoryItemId: 'item-1',
                    type: AlertType.LOW_STOCK,
                    status: AlertStatus.ACTIVE,
                    autoResolve: false
                }
            ];

            mockAlertRepository.find.mockResolvedValue(mockAlerts);

            const result = await service.autoResolveAlerts();

            expect(result).toBe(0);
        });
    });

    // ==================== GET ALERT STATISTICS ====================
    describe('getAlertStatistics', () => {
        it('should calculate alert statistics', async () => {
            const mockAlerts = [
                { 
                    type: AlertType.LOW_STOCK, 
                    severity: AlertSeverity.WARNING, 
                    status: AlertStatus.ACTIVE 
                },
                { 
                    type: AlertType.CRITICAL_STOCK, 
                    severity: AlertSeverity.CRITICAL, 
                    status: AlertStatus.ACKNOWLEDGED 
                },
                { 
                    type: AlertType.LOW_STOCK, 
                    severity: AlertSeverity.WARNING, 
                    status: AlertStatus.RESOLVED,
                    createdAt: new Date(Date.now() - 3600000),
                    resolvedAt: new Date()
                }
            ];

            mockAlertRepository.find.mockResolvedValue(mockAlerts);

            const stats = await service.getAlertStatistics('fleet-123');

            expect(stats.total).toBe(3);
            expect(stats.active).toBe(1);
            expect(stats.acknowledged).toBe(1);
            expect(stats.resolved).toBe(1);
            expect(stats.byType.lowStock).toBe(2);
        });
    });

    // ==================== DELETE ALERT ====================
    describe('deleteAlert', () => {
        it('should delete an alert', async () => {
            mockAlertRepository.delete.mockResolvedValue({ affected: 1 });

            await service.deleteAlert('alert-1');

            expect(mockAlertRepository.delete).toHaveBeenCalledWith('alert-1');
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
