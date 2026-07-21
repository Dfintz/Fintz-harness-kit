import { 
    SupplierManagementService, 
    SupplierCategory, 
    SupplierStatus,
    CreateSupplierDto
} from '../../services/trade/logistics/SupplierManagementService';

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    },
logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('SupplierManagementService', () => {
    let service: SupplierManagementService;
    const testOrgId = 'org-123';

    beforeEach(() => {
        service = new SupplierManagementService();
    });

    describe('createSupplier', () => {
        it('should create a new supplier', async () => {
            const dto: CreateSupplierDto = {
                organizationId: testOrgId,
                name: 'Test Supplier',
                category: SupplierCategory.FUEL,
                location: 'Port Olisar',
                products: ['Hydrogen Fuel', 'Quantum Fuel']
            };

            const result = await service.createSupplier(dto);

            expect(result.id).toBeDefined();
            expect(result.name).toBe('Test Supplier');
            expect(result.category).toBe(SupplierCategory.FUEL);
            expect(result.status).toBe(SupplierStatus.ACTIVE);
            expect(result.metrics.reliabilityScore).toBe(100);
        });

        it('should create supplier with optional fields', async () => {
            const dto: CreateSupplierDto = {
                organizationId: testOrgId,
                name: 'Full Supplier',
                category: SupplierCategory.MEDICAL,
                location: 'Area 18',
                products: ['Med Supplies'],
                contactEmail: 'supplier@test.com',
                contactName: 'John Doe',
                systemName: 'Stanton',
                notes: 'Preferred for medical supplies'
            };

            const result = await service.createSupplier(dto);

            expect(result.contactEmail).toBe('supplier@test.com');
            expect(result.contactName).toBe('John Doe');
            expect(result.systemName).toBe('Stanton');
            expect(result.notes).toBe('Preferred for medical supplies');
        });
    });

    describe('getSupplier', () => {
        it('should return supplier by ID', async () => {
            const dto: CreateSupplierDto = {
                organizationId: testOrgId,
                name: 'Get Test',
                category: SupplierCategory.COMPONENTS,
                location: 'Lorville',
                products: ['Ship Parts']
            };

            const created = await service.createSupplier(dto);
            const result = await service.getSupplier(created.id);

            expect(result).not.toBeNull();
            expect(result?.name).toBe('Get Test');
        });

        it('should return null for non-existent supplier', async () => {
            const result = await service.getSupplier('non-existent-id');
            expect(result).toBeNull();
        });
    });

    describe('getSuppliers', () => {
        beforeEach(async () => {
            await service.createSupplier({
                organizationId: testOrgId,
                name: 'Fuel Supplier 1',
                category: SupplierCategory.FUEL,
                location: 'Port Olisar',
                products: ['Hydrogen']
            });
            await service.createSupplier({
                organizationId: testOrgId,
                name: 'Medical Supplier',
                category: SupplierCategory.MEDICAL,
                location: 'New Babbage',
                products: ['Med Pens']
            });
            await service.createSupplier({
                organizationId: 'other-org',
                name: 'Other Org Supplier',
                category: SupplierCategory.FUEL,
                location: 'Orison',
                products: ['Hydrogen']
            });
        });

        it('should return all suppliers for organization', async () => {
            const result = await service.getSuppliers(testOrgId);
            expect(result.length).toBe(2);
        });

        it('should filter by category', async () => {
            const result = await service.getSuppliers(testOrgId, {
                category: SupplierCategory.FUEL
            });
            expect(result.length).toBe(1);
            expect(result[0].category).toBe(SupplierCategory.FUEL);
        });

        it('should filter by product', async () => {
            const result = await service.getSuppliers(testOrgId, {
                product: 'Hydrogen'
            });
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('Fuel Supplier 1');
        });

        it('should not return suppliers from other organizations', async () => {
            const result = await service.getSuppliers(testOrgId);
            const otherOrgSuppliers = result.filter(s => s.organizationId === 'other-org');
            expect(otherOrgSuppliers.length).toBe(0);
        });
    });

    describe('updateSupplier', () => {
        it('should update supplier fields', async () => {
            const supplier = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Original Name',
                category: SupplierCategory.GENERAL,
                location: 'Port Olisar',
                products: ['General']
            });

            const result = await service.updateSupplier(supplier.id, {
                name: 'Updated Name',
                location: 'Area 18'
            });

            expect(result).not.toBeNull();
            expect(result?.name).toBe('Updated Name');
            expect(result?.location).toBe('Area 18');
        });

        it('should return null for non-existent supplier', async () => {
            const result = await service.updateSupplier('non-existent', { name: 'Test' });
            expect(result).toBeNull();
        });
    });

    describe('deleteSupplier', () => {
        it('should delete a supplier', async () => {
            const supplier = await service.createSupplier({
                organizationId: testOrgId,
                name: 'To Delete',
                category: SupplierCategory.GENERAL,
                location: 'Port Olisar',
                products: []
            });

            const deleted = await service.deleteSupplier(supplier.id);
            expect(deleted).toBe(true);

            const found = await service.getSupplier(supplier.id);
            expect(found).toBeNull();
        });

        it('should return false for non-existent supplier', async () => {
            const result = await service.deleteSupplier('non-existent');
            expect(result).toBe(false);
        });
    });

    describe('setPreferredSupplier', () => {
        it('should set supplier as preferred', async () => {
            const supplier = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Preferred Test',
                category: SupplierCategory.FUEL,
                location: 'Port Olisar',
                products: ['Hydrogen']
            });

            const result = await service.setPreferredSupplier(supplier.id, testOrgId);

            expect(result).not.toBeNull();
            expect(result?.status).toBe(SupplierStatus.PREFERRED);
        });

        it('should remove preferred status from other suppliers in same category', async () => {
            const supplier1 = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Supplier 1',
                category: SupplierCategory.FUEL,
                location: 'Port Olisar',
                products: ['Hydrogen']
            });

            await service.setPreferredSupplier(supplier1.id, testOrgId);

            const supplier2 = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Supplier 2',
                category: SupplierCategory.FUEL,
                location: 'Lorville',
                products: ['Hydrogen']
            });

            await service.setPreferredSupplier(supplier2.id, testOrgId);

            const updatedSupplier1 = await service.getSupplier(supplier1.id);
            expect(updatedSupplier1?.status).toBe(SupplierStatus.ACTIVE);

            const updatedSupplier2 = await service.getSupplier(supplier2.id);
            expect(updatedSupplier2?.status).toBe(SupplierStatus.PREFERRED);
        });
    });

    describe('recordOrder and completeOrder', () => {
        it('should record and complete an order', async () => {
            const supplier = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Order Test',
                category: SupplierCategory.FUEL,
                location: 'Port Olisar',
                products: ['Hydrogen']
            });

            const expectedDelivery = new Date();
            expectedDelivery.setDate(expectedDelivery.getDate() + 7);

            const order = await service.recordOrder(
                supplier.id,
                testOrgId,
                [{ name: 'Hydrogen', quantity: 100, unitPrice: 50 }],
                expectedDelivery
            );

            expect(order.id).toBeDefined();
            expect(order.totalAmount).toBe(5000);
            expect(order.status).toBe('pending');

            // Complete the order
            const actualDelivery = new Date();
            actualDelivery.setDate(actualDelivery.getDate() + 5);

            const completed = await service.completeOrder(order.id, actualDelivery, 4);

            expect(completed).not.toBeNull();
            expect(completed?.status).toBe('delivered');
            expect(completed?.qualityRating).toBe(4);

            // Check supplier metrics are updated
            const updatedSupplier = await service.getSupplier(supplier.id);
            expect(updatedSupplier?.metrics.completedOrders).toBe(1);
            expect(updatedSupplier?.metrics.onTimeDeliveries).toBe(1);
            expect(updatedSupplier?.metrics.totalSpent).toBe(5000);
        });

        it('should handle late deliveries', async () => {
            const supplier = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Late Delivery Test',
                category: SupplierCategory.GENERAL,
                location: 'Port Olisar',
                products: ['Parts']
            });

            const expectedDelivery = new Date();
            expectedDelivery.setDate(expectedDelivery.getDate() - 1); // Expected yesterday

            const order = await service.recordOrder(
                supplier.id,
                testOrgId,
                [{ name: 'Parts', quantity: 10, unitPrice: 100 }],
                expectedDelivery
            );

            const actualDelivery = new Date(); // Today (late)
            await service.completeOrder(order.id, actualDelivery, 3);

            const updatedSupplier = await service.getSupplier(supplier.id);
            expect(updatedSupplier?.metrics.lateDeliveries).toBe(1);
        });
    });

    describe('cancelOrder', () => {
        it('should cancel an order', async () => {
            const supplier = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Cancel Test',
                category: SupplierCategory.GENERAL,
                location: 'Port Olisar',
                products: ['Items']
            });

            const order = await service.recordOrder(
                supplier.id,
                testOrgId,
                [{ name: 'Items', quantity: 5, unitPrice: 20 }],
                new Date()
            );

            const cancelled = await service.cancelOrder(order.id);

            expect(cancelled).not.toBeNull();
            expect(cancelled?.status).toBe('cancelled');

            const updatedSupplier = await service.getSupplier(supplier.id);
            expect(updatedSupplier?.metrics.cancelledOrders).toBe(1);
        });
    });

    describe('compareSuppliers', () => {
        it('should compare suppliers and return recommendation', async () => {
            await service.createSupplier({
                organizationId: testOrgId,
                name: 'Supplier A',
                category: SupplierCategory.FUEL,
                location: 'Port Olisar',
                products: ['Hydrogen']
            });

            await service.createSupplier({
                organizationId: testOrgId,
                name: 'Supplier B',
                category: SupplierCategory.FUEL,
                location: 'Lorville',
                products: ['Hydrogen']
            });

            const comparison = await service.compareSuppliers(testOrgId, 'Hydrogen');

            expect(comparison.suppliers.length).toBe(2);
            expect(comparison.recommendation).not.toBeNull();
            expect(comparison.suppliers[0].score).toBeDefined();
        });

        it('should return empty result when no suppliers match', async () => {
            const comparison = await service.compareSuppliers(testOrgId, 'NonExistentProduct');

            expect(comparison.suppliers.length).toBe(0);
            expect(comparison.recommendation).toBeNull();
        });
    });

    describe('getPerformanceReport', () => {
        it('should return performance report', async () => {
            const supplier = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Report Test',
                category: SupplierCategory.FUEL,
                location: 'Port Olisar',
                products: ['Hydrogen']
            });

            await service.setPreferredSupplier(supplier.id, testOrgId);

            const report = await service.getPerformanceReport(testOrgId);

            expect(report.totalSuppliers).toBe(1);
            expect(report.preferredSuppliers).toBe(1);
            expect(report.averageReliabilityScore).toBe(100);
        });
    });

    describe('getRecommendedSupplier', () => {
        it('should return preferred supplier first', async () => {
            const supplier1 = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Regular Supplier',
                category: SupplierCategory.FUEL,
                location: 'Port Olisar',
                products: ['Hydrogen']
            });

            const supplier2 = await service.createSupplier({
                organizationId: testOrgId,
                name: 'Preferred Supplier',
                category: SupplierCategory.FUEL,
                location: 'Lorville',
                products: ['Hydrogen']
            });

            await service.setPreferredSupplier(supplier2.id, testOrgId);

            const recommended = await service.getRecommendedSupplier(testOrgId, 'Hydrogen');

            expect(recommended).not.toBeNull();
            expect(recommended?.name).toBe('Preferred Supplier');
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
