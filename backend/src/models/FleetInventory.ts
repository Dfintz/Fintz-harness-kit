import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum InventoryCategory {
    FUEL = 'fuel',
    AMMUNITION = 'ammunition',
    MEDICAL = 'medical',
    FOOD = 'food',
    MINING = 'mining',
    REPAIR = 'repair',
    TRADE = 'trade',
    COMPONENTS = 'components',
    CONSUMABLES = 'consumables',
    OTHER = 'other'
}

export enum InventoryUnit {
    UNITS = 'units',
    SCU = 'scu',
    LITERS = 'liters',
    KILOGRAMS = 'kilograms',
    TONNES = 'tonnes'
}

export enum StockStatus {
    ADEQUATE = 'adequate',
    LOW = 'low',
    CRITICAL = 'critical',
    OUT_OF_STOCK = 'out_of_stock'
}

export interface StockThresholds {
    criticalLevel: number;    // Below this = critical alert
    lowLevel: number;         // Below this = low stock warning
    targetLevel: number;      // Optimal stock level
    maxLevel: number;         // Maximum storage capacity
}

export interface InventoryLocation {
    shipId?: string;
    shipName?: string;
    stationName?: string;
    systemName?: string;
    planetName?: string;
}

@Entity('fleet_inventory')
export class FleetInventory {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column()
    organizationId!: string;

    @Index()
    @Column()
    fleetId!: string;

    @Index()
    @Column()
    itemName!: string;

    @Column('text', { nullable: true })
    description?: string;

    @Index()
    @Column({
        type: 'varchar',
        default: InventoryCategory.OTHER
    })
    category!: InventoryCategory;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    quantity!: number;

    @Column({
        type: 'varchar',
        default: InventoryUnit.UNITS
    })
    unit!: InventoryUnit;

    @Column('simple-json')
    thresholds!: StockThresholds;

    @Column({
        type: 'varchar',
        default: StockStatus.ADEQUATE
    })
    status!: StockStatus;

    @Column('simple-json', { nullable: true })
    location?: InventoryLocation;

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    unitCost?: number;

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    totalValue?: number;

    @Column({ nullable: true })
    supplierId?: string;

    @Column({ nullable: true })
    supplierName?: string;

    @Column({ default: true })
    alertEnabled!: boolean;

    @Column({ nullable: true })
    lastRestockDate?: Date;

    @Column({ nullable: true })
    nextRestockDate?: Date;

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    averageConsumptionRate?: number; // per day

    @Column({ nullable: true })
    estimatedDaysRemaining?: number;

    @Column('text', { nullable: true })
    notes?: string;

    @Index()
    @Column()
    managerId!: string; // User responsible for this inventory

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

// DTOs for API
export interface CreateInventoryItemDto {
    fleetId: string;
    itemName: string;
    description?: string;
    category: InventoryCategory;
    quantity: number;
    unit: InventoryUnit;
    thresholds: StockThresholds;
    location?: InventoryLocation;
    unitCost?: number;
    supplierId?: string;
    supplierName?: string;
    alertEnabled?: boolean;
    averageConsumptionRate?: number;
    notes?: string;
    managerId: string;
}

export interface UpdateInventoryItemDto {
    itemName?: string;
    description?: string;
    category?: InventoryCategory;
    quantity?: number;
    unit?: InventoryUnit;
    thresholds?: StockThresholds;
    location?: InventoryLocation;
    unitCost?: number;
    supplierId?: string;
    supplierName?: string;
    alertEnabled?: boolean;
    lastRestockDate?: Date;
    nextRestockDate?: Date;
    averageConsumptionRate?: number;
    notes?: string;
    managerId?: string;
}

export interface InventoryFilterOptions {
    fleetId?: string;
    category?: InventoryCategory | InventoryCategory[];
    status?: StockStatus | StockStatus[];
    managerId?: string;
    lowStockOnly?: boolean;
    criticalOnly?: boolean;
    searchTerm?: string;
    // Pagination options
    page?: number;
    limit?: number;
    sortBy?: 'itemName' | 'quantity' | 'status' | 'category' | 'createdAt' | 'updatedAt';
    sortOrder?: 'ASC' | 'DESC';
}

export interface StockAdjustmentDto {
    quantity: number;
    reason: string;
    adjustedBy: string;
}
