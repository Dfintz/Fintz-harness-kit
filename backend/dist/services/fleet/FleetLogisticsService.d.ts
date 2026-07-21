import { FleetLogistics, LogisticsStatus } from '../../models/FleetLogistics';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface CreateLogisticsDto {
    fleetId: string;
    operationName: string;
    description?: string;
    coordinatorId: string;
    ships?: FleetLogistics['ships'];
    resources?: FleetLogistics['resources'];
    route?: FleetLogistics['route'];
    notes?: string;
}
export declare class FleetLogisticsService {
    private readonly repository;
    constructor();
    create(dto: CreateLogisticsDto): Promise<FleetLogistics>;
    findAll(pagination: PaginationOptions, fleetId?: string): Promise<PaginatedResponse<FleetLogistics>>;
    findById(id: string): Promise<FleetLogistics>;
    update(id: string, updateData: Partial<FleetLogistics>): Promise<FleetLogistics>;
    updateStatus(id: string, status: LogisticsStatus): Promise<FleetLogistics>;
    delete(id: string): Promise<void>;
    calculateFuelRequirements(logistics: FleetLogistics): {
        totalFuelRequired: number;
        totalCurrentFuel: number;
        fuelShortage: number;
        canCompleteRoute: boolean;
        shipsStatus: {
            shipId: string;
            shipName: string;
            currentFuel: number;
            fuelCapacity: number;
            fuelPercentage: string;
        }[];
    };
    calculateCargoCapacity(logistics: FleetLogistics): {
        totalCargoCapacity: number;
        totalCargoUsed: number;
        cargoAvailable: number;
        cargoUtilization: string;
        canFitAllResources: boolean;
        shipsStatus: {
            shipId: string;
            shipName: string;
            currentCargo: number;
            cargoCapacity: number;
            cargoPercentage: string;
        }[];
    };
    calculateJumpRange(logistics: FleetLogistics): {
        fleetMinJumpRange: number;
        canCompleteRoute: boolean;
        routeFeasibility: {
            location: string;
            distance: number;
            order: number;
            accessible: boolean;
            exceedsRange: number;
        }[];
        shipsJumpRange: {
            shipId: string;
            shipName: string;
            jumpRange: number;
            isLimitingFactor: boolean;
        }[];
    };
    private calculateTotals;
}
//# sourceMappingURL=FleetLogisticsService.d.ts.map