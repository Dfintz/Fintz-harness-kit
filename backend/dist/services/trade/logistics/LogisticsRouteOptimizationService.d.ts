export interface LogisticsWaypoint {
    id: string;
    location: string;
    systemName?: string;
    type: 'pickup' | 'delivery' | 'refuel' | 'waypoint';
    items: Array<{
        name: string;
        quantity: number;
        weight?: number;
    }>;
    priority: number;
    estimatedTimeAtStop: number;
    notes?: string;
}
export interface OptimizedLogisticsRoute {
    id: string;
    organizationId: string;
    name: string;
    waypoints: LogisticsWaypoint[];
    totalDistance: number;
    estimatedDuration: number;
    estimatedFuelCost: number;
    totalCargoWeight: number;
    efficiency: RouteEfficiency;
    createdAt: Date;
}
export interface RouteEfficiency {
    distanceOptimization: number;
    fuelEfficiency: number;
    timeEfficiency: number;
    overallScore: number;
}
export interface RouteOptimizationOptions {
    organizationId: string;
    name: string;
    waypoints: Omit<LogisticsWaypoint, 'id'>[];
    shipFuelCapacity?: number;
    shipCargoCapacity?: number;
    shipSpeed?: number;
    prioritizeBy?: 'distance' | 'fuel' | 'time' | 'priority';
    includeRefuelStops?: boolean;
    maxStopsPerRoute?: number;
}
export interface SupplyChainAnalysis {
    totalRoutes: number;
    averageEfficiency: number;
    bottlenecks: Array<{
        location: string;
        issue: string;
        severity: 'low' | 'medium' | 'high';
        recommendation: string;
    }>;
    recommendations: string[];
}
export declare class LogisticsRouteOptimizationService {
    private routes;
    private distanceMatrix;
    private readonly defaultShipSpeed;
    private readonly defaultFuelConsumption;
    private readonly defaultRefuelTime;
    private static readonly DEFAULT_DISTANCE_KM;
    constructor();
    private initializeDistanceMatrix;
    optimizeRoute(options: RouteOptimizationOptions): Promise<OptimizedLogisticsRoute>;
    private optimizeByDistance;
    private optimizeByPriority;
    private optimizeByFuel;
    private optimizeByTime;
    private addRefuelStops;
    private findNearestRefuelStation;
    private createRoute;
    getRoute(routeId: string): Promise<OptimizedLogisticsRoute | null>;
    getOrganizationRoutes(organizationId: string): Promise<OptimizedLogisticsRoute[]>;
    deleteRoute(routeId: string): Promise<boolean>;
    analyzeSupplyChain(organizationId: string): Promise<SupplyChainAnalysis>;
    private identifyBottlenecks;
    private generateRecommendations;
    private getDistance;
    private getFuelRequired;
    private getTravelTime;
    private calculateTotalDistance;
    private calculateEstimatedDuration;
    private calculateFuelCost;
    private calculateTotalCargoWeight;
    private calculateFuelEfficiency;
    private calculateTimeEfficiency;
}
export declare const logisticsRouteOptimizationService: LogisticsRouteOptimizationService;
//# sourceMappingURL=LogisticsRouteOptimizationService.d.ts.map