"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logisticsRouteOptimizationService = exports.LogisticsRouteOptimizationService = void 0;
const uuid_1 = require("uuid");
const logger_1 = require("../../../utils/logger");
class LogisticsRouteOptimizationService {
    routes = new Map();
    distanceMatrix = new Map();
    defaultShipSpeed = 200;
    defaultFuelConsumption = 0.5;
    defaultRefuelTime = 15;
    static DEFAULT_DISTANCE_KM = 50000;
    constructor() {
        this.initializeDistanceMatrix();
        logger_1.logger.info('LogisticsRouteOptimizationService initialized');
    }
    initializeDistanceMatrix() {
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
        for (const entry of locations) {
            const key1 = `${entry.from}:${entry.to}`;
            const key2 = `${entry.to}:${entry.from}`;
            this.distanceMatrix.set(key1, entry);
            this.distanceMatrix.set(key2, { ...entry, from: entry.to, to: entry.from });
        }
    }
    async optimizeRoute(options) {
        const startTime = Date.now();
        const waypoints = options.waypoints.map(wp => ({
            ...wp,
            id: (0, uuid_1.v4)()
        }));
        if (waypoints.length === 0) {
            throw new Error('At least one waypoint is required');
        }
        if (waypoints.length === 1) {
            return this.createRoute(options.organizationId, options.name, waypoints, {
                distanceOptimization: 100,
                fuelEfficiency: 100,
                timeEfficiency: 100,
                overallScore: 100
            });
        }
        const unoptimizedDistance = this.calculateTotalDistance(waypoints);
        let optimizedWaypoints;
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
        if (options.includeRefuelStops && options.shipFuelCapacity) {
            optimizedWaypoints = this.addRefuelStops(optimizedWaypoints, options.shipFuelCapacity);
        }
        if (options.maxStopsPerRoute && optimizedWaypoints.length > options.maxStopsPerRoute) {
            optimizedWaypoints = optimizedWaypoints.slice(0, options.maxStopsPerRoute);
        }
        const optimizedDistance = this.calculateTotalDistance(optimizedWaypoints);
        const distanceImprovement = unoptimizedDistance > 0
            ? ((unoptimizedDistance - optimizedDistance) / unoptimizedDistance) * 100
            : 0;
        const efficiency = {
            distanceOptimization: Math.round(Math.max(0, distanceImprovement) * 100) / 100,
            fuelEfficiency: this.calculateFuelEfficiency(optimizedWaypoints, options.shipFuelCapacity),
            timeEfficiency: this.calculateTimeEfficiency(optimizedWaypoints),
            overallScore: 0
        };
        efficiency.overallScore = Math.round((efficiency.distanceOptimization * 0.3 +
            efficiency.fuelEfficiency * 0.4 +
            efficiency.timeEfficiency * 0.3));
        const route = this.createRoute(options.organizationId, options.name, optimizedWaypoints, efficiency);
        logger_1.logger.info(`Route optimized in ${Date.now() - startTime}ms`, {
            routeId: route.id,
            waypointCount: optimizedWaypoints.length,
            distanceImprovement: efficiency.distanceOptimization,
            overallScore: efficiency.overallScore
        });
        return route;
    }
    optimizeByDistance(waypoints) {
        if (waypoints.length <= 2) {
            return waypoints;
        }
        const optimized = [];
        const remaining = [...waypoints];
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
    optimizeByPriority(waypoints) {
        return [...waypoints].sort((a, b) => b.priority - a.priority);
    }
    optimizeByFuel(waypoints, fuelCapacity) {
        const distanceOptimized = this.optimizeByDistance(waypoints);
        if (fuelCapacity) {
            const segments = [];
            let currentSegment = [];
            let fuelUsed = 0;
            for (const waypoint of distanceOptimized) {
                const fuelToWaypoint = currentSegment.length > 0
                    ? this.getFuelRequired(currentSegment[currentSegment.length - 1].location, waypoint.location)
                    : 0;
                if (fuelUsed + fuelToWaypoint > fuelCapacity * 0.8) {
                    segments.push(currentSegment);
                    currentSegment = [waypoint];
                    fuelUsed = 0;
                }
                else {
                    currentSegment.push(waypoint);
                    fuelUsed += fuelToWaypoint;
                }
            }
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }
            return segments.flat();
        }
        return distanceOptimized;
    }
    optimizeByTime(waypoints) {
        const withTotalTime = waypoints.map((wp, index) => ({
            waypoint: wp,
            totalTime: wp.estimatedTimeAtStop + (index > 0
                ? this.getTravelTime(waypoints[index - 1].location, wp.location)
                : 0)
        }));
        withTotalTime.sort((a, b) => {
            if (a.waypoint.priority !== b.waypoint.priority) {
                return b.waypoint.priority - a.waypoint.priority;
            }
            return a.totalTime - b.totalTime;
        });
        return withTotalTime.map(item => item.waypoint);
    }
    addRefuelStops(waypoints, fuelCapacity) {
        const result = [];
        let currentFuel = fuelCapacity;
        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            const fuelNeeded = i > 0
                ? this.getFuelRequired(waypoints[i - 1].location, waypoint.location)
                : 0;
            if (fuelNeeded > currentFuel) {
                result.push({
                    id: (0, uuid_1.v4)(),
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
    findNearestRefuelStation(location) {
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
    createRoute(organizationId, name, waypoints, efficiency) {
        const id = (0, uuid_1.v4)();
        const totalDistance = this.calculateTotalDistance(waypoints);
        const estimatedDuration = this.calculateEstimatedDuration(waypoints);
        const estimatedFuelCost = this.calculateFuelCost(waypoints);
        const totalCargoWeight = this.calculateTotalCargoWeight(waypoints);
        const route = {
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
    async getRoute(routeId) {
        return this.routes.get(routeId) || null;
    }
    async getOrganizationRoutes(organizationId) {
        return Array.from(this.routes.values())
            .filter(r => r.organizationId === organizationId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async deleteRoute(routeId) {
        return this.routes.delete(routeId);
    }
    async analyzeSupplyChain(organizationId) {
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
        const totalEfficiency = routes.reduce((sum, r) => sum + r.efficiency.overallScore, 0);
        const averageEfficiency = Math.round(totalEfficiency / routes.length);
        const bottlenecks = this.identifyBottlenecks(routes);
        const recommendations = this.generateRecommendations(routes, averageEfficiency, bottlenecks);
        return {
            totalRoutes: routes.length,
            averageEfficiency,
            bottlenecks,
            recommendations
        };
    }
    identifyBottlenecks(routes) {
        const bottlenecks = [];
        const locationUsage = new Map();
        for (const route of routes) {
            for (const waypoint of route.waypoints) {
                const count = locationUsage.get(waypoint.location) || 0;
                locationUsage.set(waypoint.location, count + 1);
            }
        }
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
    generateRecommendations(routes, averageEfficiency, bottlenecks) {
        const recommendations = [];
        if (averageEfficiency < 60) {
            recommendations.push('Overall supply chain efficiency is below optimal. Consider re-optimizing existing routes.');
        }
        else if (averageEfficiency >= 80) {
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
    getDistance(from, to) {
        const key = `${from}:${to}`;
        const entry = this.distanceMatrix.get(key);
        return entry?.distance || LogisticsRouteOptimizationService.DEFAULT_DISTANCE_KM;
    }
    getFuelRequired(from, to) {
        const key = `${from}:${to}`;
        const entry = this.distanceMatrix.get(key);
        if (entry) {
            return entry.fuelRequired;
        }
        return this.getDistance(from, to) * this.defaultFuelConsumption;
    }
    getTravelTime(from, to) {
        const key = `${from}:${to}`;
        const entry = this.distanceMatrix.get(key);
        if (entry) {
            return Math.round(entry.travelTime / 60);
        }
        const seconds = this.getDistance(from, to) / this.defaultShipSpeed;
        return Math.round(seconds / 60);
    }
    calculateTotalDistance(waypoints) {
        let total = 0;
        for (let i = 1; i < waypoints.length; i++) {
            total += this.getDistance(waypoints[i - 1].location, waypoints[i].location);
        }
        return total;
    }
    calculateEstimatedDuration(waypoints) {
        let total = 0;
        for (let i = 1; i < waypoints.length; i++) {
            total += this.getTravelTime(waypoints[i - 1].location, waypoints[i].location);
        }
        for (const waypoint of waypoints) {
            total += waypoint.estimatedTimeAtStop;
        }
        return total;
    }
    calculateFuelCost(waypoints) {
        let total = 0;
        for (let i = 1; i < waypoints.length; i++) {
            total += this.getFuelRequired(waypoints[i - 1].location, waypoints[i].location);
        }
        return total;
    }
    calculateTotalCargoWeight(waypoints) {
        let total = 0;
        for (const waypoint of waypoints) {
            for (const item of waypoint.items) {
                total += (item.weight || 0) * item.quantity;
            }
        }
        return total;
    }
    calculateFuelEfficiency(waypoints, fuelCapacity) {
        if (!fuelCapacity || waypoints.length < 2) {
            return 75;
        }
        const totalFuel = this.calculateFuelCost(waypoints);
        const deliveries = waypoints.filter(w => w.type === 'delivery' || w.type === 'pickup').length;
        if (deliveries === 0) {
            return 50;
        }
        const fuelPerDelivery = totalFuel / deliveries;
        const averageFuelPerDelivery = 20000;
        const ratio = averageFuelPerDelivery / fuelPerDelivery;
        return Math.min(100, Math.round(ratio * 50 + 50));
    }
    calculateTimeEfficiency(waypoints) {
        if (waypoints.length < 2) {
            return 100;
        }
        const totalDuration = this.calculateEstimatedDuration(waypoints);
        const _travelTime = waypoints.reduce((sum, wp, i) => {
            if (i === 0) {
                return 0;
            }
            return sum + this.getTravelTime(waypoints[i - 1].location, wp.location);
        }, 0);
        const stopTime = waypoints.reduce((sum, wp) => sum + wp.estimatedTimeAtStop, 0);
        const productiveRatio = stopTime / totalDuration;
        return Math.min(100, Math.round(productiveRatio * 100 + 20));
    }
}
exports.LogisticsRouteOptimizationService = LogisticsRouteOptimizationService;
exports.logisticsRouteOptimizationService = new LogisticsRouteOptimizationService();
//# sourceMappingURL=LogisticsRouteOptimizationService.js.map