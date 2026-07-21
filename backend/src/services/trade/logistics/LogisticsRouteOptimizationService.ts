/**
 * Logistics Route Optimization Service
 * 
 * Optimizes supply chain routes for fleet logistics operations.
 * Integrates with trading routes to provide efficient logistics planning.
 * 
 * Features:
 * - Multi-stop delivery route optimization
 * - Fuel efficiency calculations
 * - Cargo capacity optimization
 * - Waypoint ordering using nearest neighbor algorithm
 * - Integration with trading route data
 */

import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../../utils/logger';

/**
 * Logistics waypoint
 */
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
    priority: number; // 1-5, higher = more urgent
    estimatedTimeAtStop: number; // minutes
    notes?: string;
}

/**
 * Optimized logistics route
 */
export interface OptimizedLogisticsRoute {
    id: string;
    organizationId: string;
    name: string;
    waypoints: LogisticsWaypoint[];
    totalDistance: number;
    estimatedDuration: number; // minutes
    estimatedFuelCost: number;
    totalCargoWeight: number;
    efficiency: RouteEfficiency;
    createdAt: Date;
}

/**
 * Route efficiency metrics
 */
export interface RouteEfficiency {
    distanceOptimization: number; // percentage improvement over unoptimized
    fuelEfficiency: number; // 0-100 rating
    timeEfficiency: number; // 0-100 rating
    overallScore: number; // 0-100
}

/**
 * Route optimization options
 */
export interface RouteOptimizationOptions {
    organizationId: string;
    name: string;
    waypoints: Omit<LogisticsWaypoint, 'id'>[];
    shipFuelCapacity?: number;
    shipCargoCapacity?: number;
    shipSpeed?: number; // km/s
    prioritizeBy?: 'distance' | 'fuel' | 'time' | 'priority';
    includeRefuelStops?: boolean;
    maxStopsPerRoute?: number;
}

/**
 * Distance matrix entry
 */
interface DistanceEntry {
    from: string;
    to: string;
    distance: number;
    fuelRequired: number;
    travelTime: number;
}

/**
 * Supply chain analysis result
 */
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

/**
 * Service for optimizing logistics routes
 */
export class LogisticsRouteOptimizationService {
    // In-memory storage for routes
    private routes: Map<string, OptimizedLogisticsRoute> = new Map();
    
    // Cached distance matrix (would be fetched from game data in production)
    private distanceMatrix: Map<string, DistanceEntry> = new Map();

    // Default ship parameters
    private readonly defaultShipSpeed = 200; // km/s
    private readonly defaultFuelConsumption = 0.5; // units per km
    private readonly defaultRefuelTime = 15; // minutes

    /**
     * Default distance estimate (in km) used when actual distance is unknown.
     * Based on average inter-planetary distances in the Stanton system.
     */
    private static readonly DEFAULT_DISTANCE_KM = 50000;

    constructor() {
        this.initializeDistanceMatrix();
        logger.info('LogisticsRouteOptimizationService initialized');
    }

    /**
     * Initialize distance matrix with common Star Citizen locations
     */
    private initializeDistanceMatrix(): void {
        // Sample distances between major locations (in km)
        const locations = [
            { from: 'Port Olisar', to: 'Area 18', distance: 45000, fuelRequired: 22500, travelTime: 225 },
            { from: 'Port Olisar', to: 'Lorville', distance: 55000, fuelRequired: 27500, travelTime: 275 },
            { from: 'Port Olisar', to: 'New Babbage', distance: 65000, fuelRequired: 32500, travelTime: 325 },
            { from: 'Port Olisar', to: 'GrimHEX', distance: 25000, fuelRequired: 12500, travelTime: 125 },
            { from: 'Area 18', to: 'Lorville', distance: 40000, fuelRequired: 20000, travelTime: 200 },
            { from: 'Area 18', to: 'New Babbage', distance: 50000, fuelRequired: 25000, travelTime: 250 },
            { from: 'Area 18', to: 'GrimHEX', distance: 35000, fuelRequired: 17500, travelTime: 175 },
            { from: 'Lorville', to: 'New Babbage', distance: 30000, fuelRequired: 15000, travelTime: 150 },
            { from: 'Lorville', to: 'GrimHEX', distance: 50000, fuelRequired: 25000, travelTime: 250 },
            { from: 'New Babbage', to: 'GrimHEX', distance: 55000, fuelRequired: 27500, travelTime: 275 },
            { from: 'Orison', to: 'Port Olisar', distance: 20000, fuelRequired: 10000, travelTime: 100 },
            { from: 'Orison', to: 'Area 18', distance: 35000, fuelRequired: 17500, travelTime: 175 }
        ];

        // Store both directions
        for (const entry of locations) {
            const key1 = `${entry.from}:${entry.to}`;
            const key2 = `${entry.to}:${entry.from}`;
            this.distanceMatrix.set(key1, entry);
            this.distanceMatrix.set(key2, { ...entry, from: entry.to, to: entry.from });
        }
    }

    // ==================== ROUTE OPTIMIZATION ====================

    /**
     * Optimize a logistics route
     */
    public async optimizeRoute(options: RouteOptimizationOptions): Promise<OptimizedLogisticsRoute> {
        const startTime = Date.now();
        
        // Add IDs to waypoints
        const waypoints: LogisticsWaypoint[] = options.waypoints.map(wp => ({
            ...wp,
            id: uuidv4()
        }));

        if (waypoints.length === 0) {
            throw new Error('At least one waypoint is required');
        }

        if (waypoints.length === 1) {
            // Single waypoint, no optimization needed
            return this.createRoute(options.organizationId, options.name, waypoints, { 
                distanceOptimization: 100, 
                fuelEfficiency: 100, 
                timeEfficiency: 100, 
                overallScore: 100 
            });
        }

        // Calculate unoptimized distance for comparison
        const unoptimizedDistance = this.calculateTotalDistance(waypoints);

        // Optimize waypoint order
        let optimizedWaypoints: LogisticsWaypoint[];

        switch (options.prioritizeBy) {
            case 'priority':
                optimizedWaypoints = this.optimizeByPriority(waypoints);
                break;
            case 'fuel':
                optimizedWaypoints = this.optimizeByFuel(waypoints, options.shipFuelCapacity);
                break;
            case 'time':
                optimizedWaypoints = this.optimizeByTime(waypoints);
                break;
            case 'distance':
            default:
                optimizedWaypoints = this.optimizeByDistance(waypoints);
        }

        // Add refuel stops if needed
        if (options.includeRefuelStops && options.shipFuelCapacity) {
            optimizedWaypoints = this.addRefuelStops(optimizedWaypoints, options.shipFuelCapacity);
        }

        // Limit stops if specified
        if (options.maxStopsPerRoute && optimizedWaypoints.length > options.maxStopsPerRoute) {
            optimizedWaypoints = optimizedWaypoints.slice(0, options.maxStopsPerRoute);
        }

        // Calculate metrics
        const optimizedDistance = this.calculateTotalDistance(optimizedWaypoints);
        const distanceImprovement = unoptimizedDistance > 0 
            ? ((unoptimizedDistance - optimizedDistance) / unoptimizedDistance) * 100 
            : 0;

        const efficiency: RouteEfficiency = {
            distanceOptimization: Math.round(Math.max(0, distanceImprovement) * 100) / 100,
            fuelEfficiency: this.calculateFuelEfficiency(optimizedWaypoints, options.shipFuelCapacity),
            timeEfficiency: this.calculateTimeEfficiency(optimizedWaypoints),
            overallScore: 0
        };

        efficiency.overallScore = Math.round(
            (efficiency.distanceOptimization * 0.3 + 
             efficiency.fuelEfficiency * 0.4 + 
             efficiency.timeEfficiency * 0.3)
        );

        const route = this.createRoute(
            options.organizationId, 
            options.name, 
            optimizedWaypoints, 
            efficiency
        );

        logger.info(`Route optimized in ${Date.now() - startTime}ms`, {
            routeId: route.id,
            waypointCount: optimizedWaypoints.length,
            distanceImprovement: efficiency.distanceOptimization,
            overallScore: efficiency.overallScore
        });

        return route;
    }

    /**
     * Optimize waypoints by distance using nearest neighbor algorithm
     */
    private optimizeByDistance(waypoints: LogisticsWaypoint[]): LogisticsWaypoint[] {
        if (waypoints.length <= 2) {
            return waypoints;
        }

        const optimized: LogisticsWaypoint[] = [];
        const remaining = [...waypoints];
        
        // Start with first waypoint
        // @ts-expect-error - Strict mode compatibility
        optimized.push(remaining.shift());

        while (remaining.length > 0) {
            const current = optimized[optimized.length - 1];
            let nearestIndex = 0;
            let nearestDistance = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const distance = this.getDistance(current.location, remaining[i].location);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = i;
                }
            }

            optimized.push(remaining.splice(nearestIndex, 1)[0]);
        }

        return optimized;
    }

    /**
     * Optimize waypoints by priority (highest priority first)
     */
    private optimizeByPriority(waypoints: LogisticsWaypoint[]): LogisticsWaypoint[] {
        return [...waypoints].sort((a, b) => b.priority - a.priority);
    }

    /**
     * Optimize waypoints for fuel efficiency
     */
    private optimizeByFuel(waypoints: LogisticsWaypoint[], fuelCapacity?: number): LogisticsWaypoint[] {
        // Start with distance optimization
        const distanceOptimized = this.optimizeByDistance(waypoints);
        
        // If fuel capacity is limited, reorder to minimize refuel stops
        if (fuelCapacity) {
            // Group waypoints into segments that can be completed without refueling
            const segments: LogisticsWaypoint[][] = [];
            let currentSegment: LogisticsWaypoint[] = [];
            let fuelUsed = 0;

            for (const waypoint of distanceOptimized) {
                const fuelToWaypoint = currentSegment.length > 0 
                    ? this.getFuelRequired(currentSegment[currentSegment.length - 1].location, waypoint.location)
                    : 0;

                if (fuelUsed + fuelToWaypoint > fuelCapacity * 0.8) {
                    // Start new segment
                    segments.push(currentSegment);
                    currentSegment = [waypoint];
                    fuelUsed = 0;
                } else {
                    currentSegment.push(waypoint);
                    fuelUsed += fuelToWaypoint;
                }
            }

            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }

            // Flatten segments back to single array
            return segments.flat();
        }

        return distanceOptimized;
    }

    /**
     * Optimize waypoints for time (considering stop time at each location)
     */
    private optimizeByTime(waypoints: LogisticsWaypoint[]): LogisticsWaypoint[] {
        // Consider both travel time and time at stop
        const withTotalTime = waypoints.map((wp, index) => ({
            waypoint: wp,
            totalTime: wp.estimatedTimeAtStop + (index > 0 
                ? this.getTravelTime(waypoints[index - 1].location, wp.location) 
                : 0)
        }));

        // Sort by priority first, then optimize for time
        withTotalTime.sort((a, b) => {
            if (a.waypoint.priority !== b.waypoint.priority) {
                return b.waypoint.priority - a.waypoint.priority;
            }
            return a.totalTime - b.totalTime;
        });

        return withTotalTime.map(item => item.waypoint);
    }

    /**
     * Add refuel stops where needed
     */
    private addRefuelStops(waypoints: LogisticsWaypoint[], fuelCapacity: number): LogisticsWaypoint[] {
        const result: LogisticsWaypoint[] = [];
        let currentFuel = fuelCapacity;

        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            const fuelNeeded = i > 0 
                ? this.getFuelRequired(waypoints[i - 1].location, waypoint.location)
                : 0;

            if (fuelNeeded > currentFuel) {
                // Add refuel stop before this waypoint
                result.push({
                    id: uuidv4(),
                    location: this.findNearestRefuelStation(waypoints[i - 1]?.location || waypoint.location),
                    type: 'refuel',
                    items: [],
                    priority: 3,
                    estimatedTimeAtStop: this.defaultRefuelTime
                });
                currentFuel = fuelCapacity;
            }

            currentFuel -= fuelNeeded;
            result.push(waypoint);
        }

        return result;
    }

    /**
     * Find nearest refuel station
     */
    private findNearestRefuelStation(location: string): string {
        // In production, this would query available refuel stations
        // For now, return a placeholder
        const stations = ['Port Olisar', 'Area 18', 'Lorville', 'New Babbage', 'Orison'];
        
        let nearest = stations[0];
        let nearestDistance = Infinity;

        for (const station of stations) {
            const distance = this.getDistance(location, station);
            if (distance < nearestDistance && station !== location) {
                nearestDistance = distance;
                nearest = station;
            }
        }

        return nearest;
    }

    // ==================== ROUTE MANAGEMENT ====================

    /**
     * Create an optimized route object
     */
    private createRoute(
        organizationId: string,
        name: string,
        waypoints: LogisticsWaypoint[],
        efficiency: RouteEfficiency
    ): OptimizedLogisticsRoute {
        const id = uuidv4();
        const totalDistance = this.calculateTotalDistance(waypoints);
        const estimatedDuration = this.calculateEstimatedDuration(waypoints);
        const estimatedFuelCost = this.calculateFuelCost(waypoints);
        const totalCargoWeight = this.calculateTotalCargoWeight(waypoints);

        const route: OptimizedLogisticsRoute = {
            id,
            organizationId,
            name,
            waypoints,
            totalDistance,
            estimatedDuration,
            estimatedFuelCost,
            totalCargoWeight,
            efficiency,
            createdAt: new Date()
        };

        this.routes.set(id, route);
        return route;
    }

    /**
     * Get route by ID
     */
    public async getRoute(routeId: string): Promise<OptimizedLogisticsRoute | null> {
        return this.routes.get(routeId) || null;
    }

    /**
     * Get all routes for an organization
     */
    public async getOrganizationRoutes(organizationId: string): Promise<OptimizedLogisticsRoute[]> {
        return Array.from(this.routes.values())
            .filter(r => r.organizationId === organizationId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    /**
     * Delete a route
     */
    public async deleteRoute(routeId: string): Promise<boolean> {
        return this.routes.delete(routeId);
    }

    // ==================== SUPPLY CHAIN ANALYSIS ====================

    /**
     * Analyze supply chain for an organization
     */
    public async analyzeSupplyChain(organizationId: string): Promise<SupplyChainAnalysis> {
        const routes = await this.getOrganizationRoutes(organizationId);

        if (routes.length === 0) {
            return {
                totalRoutes: 0,
                averageEfficiency: 0,
                bottlenecks: [],
                recommendations: [
                    'Create logistics routes to start analyzing your supply chain',
                    'Consider adding multiple pickup and delivery points for efficiency'
                ]
            };
        }

        // Calculate average efficiency
        const totalEfficiency = routes.reduce((sum, r) => sum + r.efficiency.overallScore, 0);
        const averageEfficiency = Math.round(totalEfficiency / routes.length);

        // Identify bottlenecks
        const bottlenecks = this.identifyBottlenecks(routes);

        // Generate recommendations
        const recommendations = this.generateRecommendations(routes, averageEfficiency, bottlenecks);

        return {
            totalRoutes: routes.length,
            averageEfficiency,
            bottlenecks,
            recommendations
        };
    }

    /**
     * Identify bottlenecks in routes
     */
    private identifyBottlenecks(routes: OptimizedLogisticsRoute[]): SupplyChainAnalysis['bottlenecks'] {
        const bottlenecks: SupplyChainAnalysis['bottlenecks'] = [];
        const locationUsage: Map<string, number> = new Map();

        // Count location usage
        for (const route of routes) {
            for (const waypoint of route.waypoints) {
                const count = locationUsage.get(waypoint.location) || 0;
                locationUsage.set(waypoint.location, count + 1);
            }
        }

        // Check for heavily used locations
        for (const [location, count] of locationUsage) {
            if (count > routes.length * 0.5) {
                bottlenecks.push({
                    location,
                    issue: 'High traffic concentration',
                    severity: count > routes.length * 0.7 ? 'high' : 'medium',
                    recommendation: `Consider alternative routes to reduce dependency on ${location}`
                });
            }
        }

        // Check for inefficient routes
        for (const route of routes) {
            if (route.efficiency.overallScore < 50) {
                bottlenecks.push({
                    location: route.waypoints[0]?.location || 'Unknown',
                    issue: `Low efficiency route: ${route.name}`,
                    severity: route.efficiency.overallScore < 30 ? 'high' : 'medium',
                    recommendation: 'Re-optimize this route or consider alternative waypoints'
                });
            }

            if (route.efficiency.fuelEfficiency < 40) {
                bottlenecks.push({
                    location: route.name,
                    issue: 'Poor fuel efficiency',
                    severity: 'medium',
                    recommendation: 'Consider adding refuel stops or using more fuel-efficient ships'
                });
            }
        }

        return bottlenecks;
    }

    /**
     * Generate recommendations based on analysis
     */
    private generateRecommendations(
        routes: OptimizedLogisticsRoute[],
        averageEfficiency: number,
        bottlenecks: SupplyChainAnalysis['bottlenecks']
    ): string[] {
        const recommendations: string[] = [];

        if (averageEfficiency < 60) {
            recommendations.push('Overall supply chain efficiency is below optimal. Consider re-optimizing existing routes.');
        } else if (averageEfficiency >= 80) {
            recommendations.push('Supply chain efficiency is excellent. Maintain current routing strategies.');
        }

        if (bottlenecks.filter(b => b.severity === 'high').length > 0) {
            recommendations.push('Address high-severity bottlenecks immediately to improve logistics performance.');
        }

        const avgWaypoints = routes.reduce((sum, r) => sum + r.waypoints.length, 0) / routes.length;
        if (avgWaypoints > 6) {
            recommendations.push('Consider splitting long routes into smaller segments for better management.');
        }

        const lowFuelRoutes = routes.filter(r => r.efficiency.fuelEfficiency < 50);
        if (lowFuelRoutes.length > routes.length * 0.3) {
            recommendations.push('Many routes have poor fuel efficiency. Consider optimizing by fuel consumption.');
        }

        if (recommendations.length === 0) {
            recommendations.push('Supply chain is operating efficiently. Continue monitoring for changes.');
        }

        return recommendations;
    }

    // ==================== CALCULATION HELPERS ====================

    /**
     * Get distance between two locations
     */
    private getDistance(from: string, to: string): number {
        const key = `${from}:${to}`;
        const entry = this.distanceMatrix.get(key);
        
        // Return cached distance or estimate using default
        return entry?.distance || LogisticsRouteOptimizationService.DEFAULT_DISTANCE_KM;
    }

    /**
     * Get fuel required between two locations
     */
    private getFuelRequired(from: string, to: string): number {
        const key = `${from}:${to}`;
        const entry = this.distanceMatrix.get(key);
        
        if (entry) {
            return entry.fuelRequired;
        }

        // Estimate based on distance
        return this.getDistance(from, to) * this.defaultFuelConsumption;
    }

    /**
     * Get travel time between two locations in minutes
     */
    private getTravelTime(from: string, to: string): number {
        const key = `${from}:${to}`;
        const entry = this.distanceMatrix.get(key);
        
        if (entry) {
            // Distance matrix stores travelTime in seconds, convert to minutes
            return Math.round(entry.travelTime / 60);
        }

        // Estimate based on distance and speed: (km) / (km/s) = seconds, then convert to minutes
        const seconds = this.getDistance(from, to) / this.defaultShipSpeed;
        return Math.round(seconds / 60);
    }

    /**
     * Calculate total distance for waypoints
     */
    private calculateTotalDistance(waypoints: LogisticsWaypoint[]): number {
        let total = 0;
        for (let i = 1; i < waypoints.length; i++) {
            total += this.getDistance(waypoints[i - 1].location, waypoints[i].location);
        }
        return total;
    }

    /**
     * Calculate estimated duration for route
     */
    private calculateEstimatedDuration(waypoints: LogisticsWaypoint[]): number {
        let total = 0;
        
        // Add travel time
        for (let i = 1; i < waypoints.length; i++) {
            total += this.getTravelTime(waypoints[i - 1].location, waypoints[i].location);
        }

        // Add time at each stop
        for (const waypoint of waypoints) {
            total += waypoint.estimatedTimeAtStop;
        }

        return total;
    }

    /**
     * Calculate fuel cost for route
     */
    private calculateFuelCost(waypoints: LogisticsWaypoint[]): number {
        let total = 0;
        for (let i = 1; i < waypoints.length; i++) {
            total += this.getFuelRequired(waypoints[i - 1].location, waypoints[i].location);
        }
        return total;
    }

    /**
     * Calculate total cargo weight
     */
    private calculateTotalCargoWeight(waypoints: LogisticsWaypoint[]): number {
        let total = 0;
        for (const waypoint of waypoints) {
            for (const item of waypoint.items) {
                total += (item.weight || 0) * item.quantity;
            }
        }
        return total;
    }

    /**
     * Calculate fuel efficiency score
     */
    private calculateFuelEfficiency(waypoints: LogisticsWaypoint[], fuelCapacity?: number): number {
        if (!fuelCapacity || waypoints.length < 2) {
            return 75; // Default score
        }

        const totalFuel = this.calculateFuelCost(waypoints);
        const deliveries = waypoints.filter(w => w.type === 'delivery' || w.type === 'pickup').length;
        
        if (deliveries === 0) {
            return 50;
        }

        // Calculate fuel per delivery
        const fuelPerDelivery = totalFuel / deliveries;
        
        // Score based on fuel efficiency (lower fuel per delivery = higher score)
        // Assuming 20000 fuel units per delivery is average
        const averageFuelPerDelivery = 20000;
        const ratio = averageFuelPerDelivery / fuelPerDelivery;
        
        return Math.min(100, Math.round(ratio * 50 + 50));
    }

    /**
     * Calculate time efficiency score
     */
    private calculateTimeEfficiency(waypoints: LogisticsWaypoint[]): number {
        if (waypoints.length < 2) {
            return 100;
        }

        const totalDuration = this.calculateEstimatedDuration(waypoints);
        const _travelTime = waypoints.reduce((sum, wp, i) => {
            if (i === 0) {return 0;}
            return sum + this.getTravelTime(waypoints[i - 1].location, wp.location);
        }, 0);

        const stopTime = waypoints.reduce((sum, wp) => sum + wp.estimatedTimeAtStop, 0);

        // Calculate ratio of productive time (stop time) to total time
        const productiveRatio = stopTime / totalDuration;

        // Score: higher productive time ratio = higher score
        return Math.min(100, Math.round(productiveRatio * 100 + 20));
    }
}

// Export singleton instance
export const logisticsRouteOptimizationService = new LogisticsRouteOptimizationService();


