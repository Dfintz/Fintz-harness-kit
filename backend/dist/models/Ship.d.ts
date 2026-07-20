import { OptionalTenantEntity } from './base/OptionalTenantEntity';
import { FleetShip } from './FleetShip';
export declare enum ShipSize {
    VEHICLE = "vehicle",
    SNUB = "snub",
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large",
    SUB_CAPITAL = "sub_capital",
    CAPITAL = "capital"
}
export declare enum ShipStatus {
    FLIGHT_READY = "flight_ready",
    IN_CONCEPT = "in_concept",
    IN_PRODUCTION = "in_production",
    ANNOUNCED = "announced"
}
export declare enum ShipDataSource {
    ERKUL = "erkul",
    SHEETS = "sheets",
    CSV = "csv",
    MANUAL = "manual"
}
export declare class Ship extends OptionalTenantEntity {
    id: string;
    name: string;
    manufacturer: string;
    manufacturerCode?: string;
    description?: string;
    role?: string;
    career?: string;
    roles?: string[];
    size?: ShipSize;
    status: ShipStatus;
    crew?: number;
    minCrew?: number;
    maxCrew?: number;
    length?: number;
    beam?: number;
    height?: number;
    mass?: number;
    cargo?: number;
    vehicleCargo?: number;
    price?: number;
    pledgePrice?: number;
    speed?: number;
    afterburnerSpeed?: number;
    quantumSpeed?: number;
    quantumFuelCapacity?: number;
    hydrogenFuelCapacity?: number;
    shields?: number;
    armor?: number;
    weapons?: {
        type: string;
        size: number;
        count: number;
    }[];
    hardpoints?: {
        type: string;
        size: number;
        location: string;
    }[];
    hangarSize?: string;
    storageUrl?: string;
    thumbnailUrl?: string;
    imageUrl?: string;
    brochureUrl?: string;
    isActive: boolean;
    loanerShip?: string;
    variants?: string[];
    isVehicle: boolean;
    isFlyable: boolean;
    metadata?: Record<string, unknown>;
    dataSource: ShipDataSource;
    lastFetchedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    fleetAssignments?: FleetShip[];
}
export interface CreateShipDTO {
    name: string;
    manufacturer: string;
    manufacturerCode?: string;
    description?: string;
    role?: string;
    career?: string;
    roles?: string[];
    size?: ShipSize;
    status?: ShipStatus;
    crew?: number;
    minCrew?: number;
    maxCrew?: number;
    length?: number;
    beam?: number;
    height?: number;
    mass?: number;
    cargo?: number;
    vehicleCargo?: number;
    price?: number;
    pledgePrice?: number;
    speed?: number;
    afterburnerSpeed?: number;
    quantumSpeed?: number;
    quantumFuelCapacity?: number;
    hydrogenFuelCapacity?: number;
    shields?: number;
    armor?: number;
    weapons?: {
        type: string;
        size: number;
        count: number;
    }[];
    hardpoints?: {
        type: string;
        size: number;
        location: string;
    }[];
    hangarSize?: string;
    storageUrl?: string;
    thumbnailUrl?: string;
    imageUrl?: string;
    brochureUrl?: string;
    isActive?: boolean;
    loanerShip?: string;
    variants?: string[];
    isVehicle?: boolean;
    isFlyable?: boolean;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=Ship.d.ts.map