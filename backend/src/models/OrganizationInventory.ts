import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Category types for organization inventory
 */
export enum OrganizationInventoryCategory {
    SHIPS = 'ships',
    COMPONENTS = 'components',
    COMMODITIES = 'commodities'
}

/**
 * Organization Inventory Entity
 * Tracks organization-owned assets including ships, components, and commodities
 */
@Entity('organization_inventory')
export class OrganizationInventory {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column()
    organizationId!: string;

    @Index()
    @Column()
    itemName!: string;

    @Column('text', { nullable: true })
    description?: string;

    @Index()
    @Column({
        type: 'varchar',
        default: OrganizationInventoryCategory.COMMODITIES
    })
    category!: OrganizationInventoryCategory;

    @Column('int', { default: 1 })
    quantity!: number;

    @Column({ nullable: true })
    unit?: string;

    /**
     * Value in aUEC (alpha United Earth Credits)
     * Stored as decimal to allow fractional credits
     */
    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    unitValue!: number;

    /**
     * Total value calculated as quantity * unitValue
     */
    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalValue!: number;

    @Column('text', { nullable: true })
    notes?: string;

    @Column({ nullable: true })
    location?: string;

    @Column({ nullable: true })
    assignedTo?: string; // User ID if assigned to specific person

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

// DTOs for API
export interface CreateOrganizationInventoryDto {
    itemName: string;
    description?: string;
    category: OrganizationInventoryCategory;
    quantity: number;
    unit?: string;
    unitValue: number;
    notes?: string;
    location?: string;
    assignedTo?: string;
}

export interface UpdateOrganizationInventoryDto {
    itemName?: string;
    description?: string;
    category?: OrganizationInventoryCategory;
    quantity?: number;
    unit?: string;
    unitValue?: number;
    notes?: string;
    location?: string;
    assignedTo?: string;
}

export interface OrganizationInventoryFilterOptions {
    category?: OrganizationInventoryCategory | OrganizationInventoryCategory[];
    searchTerm?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
    sortBy?: 'itemName' | 'quantity' | 'totalValue' | 'category' | 'createdAt' | 'updatedAt';
    sortOrder?: 'ASC' | 'DESC';
}

export interface OrganizationInventoryStatistics {
    totalItems: number;
    totalValue: number;
    byCategory: {
        ships: {
            count: number;
            value: number;
        };
        components: {
            count: number;
            value: number;
        };
        commodities: {
            count: number;
            value: number;
        };
    };
}
