"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteCalculationService = void 0;
const database_1 = require("../../config/database");
const Ship_1 = require("../../models/Ship");
const crewCalculation_1 = require("../../utils/crewCalculation");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
class RouteCalculationService {
    shipRepository = null;
    static REFUEL_SHIPS = ['starfarer', 'starfarer gemini', 'vulcan'];
    static REARM_SHIPS = ['vulcan', 'crucible'];
    static REPAIR_SHIPS = ['vulcan', 'crucible', 'odyssey'];
    static MEDICAL_SHIPS = [
        'apollo medivac',
        'apollo triage',
        'cutlass red',
        'terrapin medic',
        'c8r pisces rescue',
        'ursa medivac',
        'clipper',
    ];
    getShipRepository() {
        if (!this.shipRepository) {
            if (!database_1.AppDataSource.isInitialized) {
                throw new Error('AppDataSource must be initialized before using RouteCalculationService');
            }
            this.shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
        }
        return this.shipRepository;
    }
    async calculateRoute(shipAssignments, routePlan) {
        const shipSpecs = await this.getShipSpecifications(shipAssignments);
        const totalCargoCapacity = shipSpecs.reduce((sum, ship) => sum + ship.cargo, 0);
        const totalQuantumFuel = shipSpecs.reduce((sum, ship) => sum + ship.quantumFuelCapacity, 0);
        const totalCrewCapacity = shipSpecs.reduce((sum, ship) => sum + ship.crewCapacity, 0);
        const hasRefuelShip = shipSpecs.some(ship => ship.isRefuelCapable);
        let maxJumpRange = 0;
        let bottleneckShip;
        if (shipSpecs.length > 0) {
            const rangesWithShips = shipSpecs
                .map(ship => ({
                range: ship.maxJumpRange || 0,
                shipType: ship.shipType,
            }))
                .filter(s => s.range > 0);
            if (rangesWithShips.length > 0) {
                const bottleneck = rangesWithShips.reduce((min, curr) => (curr.range < min.range ? curr : min), rangesWithShips[0]);
                maxJumpRange = bottleneck.range;
                bottleneckShip = bottleneck.shipType;
            }
        }
        let totalQuantumFuelRequired = 0;
        let refuelStopsNeeded = 0;
        if (routePlan && routePlan.length > 0) {
            totalQuantumFuelRequired = routePlan.reduce((sum, wp) => sum + (wp.quantumFuelRequired || wp.requiredFuel || 0), 0);
            refuelStopsNeeded = routePlan.filter(wp => wp.refuelAvailable).length;
            if (totalQuantumFuelRequired === 0 && routePlan.some(wp => wp.distance)) {
                const totalDistance = routePlan.reduce((sum, wp) => sum + (wp.distance || 0), 0);
                const BASE_FUEL_PER_1000_KM = 0.1;
                const MEDIUM_CARGO_BASELINE = 100;
                const averageCargoCapacity = shipSpecs.length > 0
                    ? shipSpecs.reduce((sum, ship) => sum + (ship.cargo || 0), 0) / shipSpecs.length
                    : 0;
                const rawSizeFactor = averageCargoCapacity > 0 ? averageCargoCapacity / MEDIUM_CARGO_BASELINE : 1;
                const sizeFactor = Math.min(3, Math.max(0.5, rawSizeFactor));
                totalQuantumFuelRequired = (totalDistance / 1000) * BASE_FUEL_PER_1000_KM * sizeFactor;
            }
        }
        const insufficientFuel = !hasRefuelShip && totalQuantumFuelRequired > totalQuantumFuel;
        return {
            totalCargoCapacity,
            totalQuantumFuel,
            totalQuantumFuelRequired,
            maxJumpRange,
            hasRefuelShip,
            insufficientFuel,
            refuelStopsNeeded,
            bottleneckShip,
            totalCrewCapacity,
        };
    }
    async getShipSpecifications(shipAssignments) {
        if (!shipAssignments || shipAssignments.length === 0) {
            return [];
        }
        const shipTypes = [...new Set(shipAssignments.map(s => s.shipType))];
        try {
            const shipRepository = this.getShipRepository();
            const ships = await shipRepository
                .createQueryBuilder('ship')
                .where('LOWER(ship.name) IN (:...names)', {
                names: shipTypes.map(t => t.toLowerCase()),
            })
                .andWhere('ship.organizationId IS NULL')
                .getMany();
            return shipAssignments.map(assignment => {
                const catalogShip = ships.find(s => s.name.toLowerCase() === assignment.shipType.toLowerCase());
                const isRefuelCapable = RouteCalculationService.REFUEL_SHIPS.some(refuelShip => assignment.shipType.toLowerCase().includes(refuelShip));
                return {
                    shipType: assignment.shipType,
                    cargo: catalogShip?.cargo ?? assignment.metadata?.cargoCapacity ?? 0,
                    quantumFuelCapacity: catalogShip?.quantumFuelCapacity ??
                        assignment.metadata?.quantumFuelCapacity ??
                        0,
                    crewCapacity: catalogShip ? (0, crewCalculation_1.resolveShipCrew)(catalogShip) : assignment.crewCapacity || 1,
                    maxJumpRange: catalogShip?.quantumSpeed ? catalogShip.quantumSpeed * 100 : undefined,
                    isRefuelCapable,
                };
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching ship specifications for route calculation:', error);
            return shipAssignments.map(assignment => ({
                shipType: assignment.shipType,
                cargo: assignment.metadata?.cargoCapacity || 0,
                quantumFuelCapacity: assignment.metadata?.quantumFuelCapacity || 0,
                crewCapacity: assignment.crewCapacity || 1,
                isRefuelCapable: RouteCalculationService.REFUEL_SHIPS.some(refuelShip => assignment.shipType.toLowerCase().includes(refuelShip)),
            }));
        }
    }
    async enrichShipMetadata(shipAssignments) {
        if (!shipAssignments || shipAssignments.length === 0) {
            return;
        }
        const shipTypes = [...new Set(shipAssignments.map(s => s.shipType))];
        try {
            const shipRepository = this.getShipRepository();
            const ships = await shipRepository
                .createQueryBuilder('ship')
                .where('LOWER(ship.name) IN (:...names)', {
                names: shipTypes.map(t => t.toLowerCase()),
            })
                .andWhere('ship.organizationId IS NULL')
                .getMany();
            for (const assignment of shipAssignments) {
                const catalogShip = ships.find(s => s.name.toLowerCase() === assignment.shipType.toLowerCase());
                if (!catalogShip) {
                    continue;
                }
                assignment.metadata ??= {};
                const meta = assignment.metadata;
                meta.cargoCapacity ??= catalogShip.cargo ?? 0;
                meta.vehicleCargoCapacity ??= catalogShip.vehicleCargo ?? 0;
                meta.quantumFuelCapacity ??= catalogShip.quantumFuelCapacity ?? 0;
                meta.hydrogenFuelCapacity ??= catalogShip.hydrogenFuelCapacity ?? 0;
                meta.hangarSize ??= catalogShip.hangarSize;
                meta.loanerShip ??= catalogShip.loanerShip;
                meta.manufacturer ??= catalogShip.manufacturer;
                meta.size ??= catalogShip.size;
                meta.isRefuelCapable ??= RouteCalculationService.REFUEL_SHIPS.some(r => assignment.shipType.toLowerCase().includes(r));
                meta.isRearmCapable ??= RouteCalculationService.REARM_SHIPS.some(r => assignment.shipType.toLowerCase().includes(r));
                meta.isRepairCapable ??= RouteCalculationService.REPAIR_SHIPS.some(r => assignment.shipType.toLowerCase().includes(r));
                if (assignment.crewCapacity <= 1) {
                    const catalogCrew = (0, crewCalculation_1.resolveShipCrew)(catalogShip);
                    if (catalogCrew > 1) {
                        assignment.crewCapacity = catalogCrew;
                        assignment.maxCrew = catalogCrew;
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error enriching ship metadata from catalogue:', error);
        }
    }
    async updateActivityRouteData(activity) {
        const shipAssignments = activity.shipAssignments ?? activity.ships ?? [];
        const routeCalc = await this.calculateRoute(shipAssignments, activity.routePlan);
        activity.totalCargoCapacity = routeCalc.totalCargoCapacity;
        activity.totalQuantumFuel = routeCalc.totalQuantumFuel;
        activity.totalQuantumFuelRequired = routeCalc.totalQuantumFuelRequired;
        activity.maxJumpRange = routeCalc.maxJumpRange;
        activity.hasRefuelShip = routeCalc.hasRefuelShip;
        activity.totalCrewCapacity = routeCalc.totalCrewCapacity;
        logger_1.logger.info('Updated activity route calculation fields', {
            activityId: activity.id,
            organizationId: activity.organizationId,
            totalCargoCapacity: routeCalc.totalCargoCapacity,
            totalQuantumFuel: routeCalc.totalQuantumFuel,
            totalCrewCapacity: routeCalc.totalCrewCapacity,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'ACTIVITY_ROUTE_DATA_UPDATED',
            message: `Updated route calculation fields for activity ${activity.id}`,
            organizationId: activity.organizationId ?? undefined,
            resource: `activity/${activity.id}`,
            metadata: {
                activityId: activity.id,
                totalCargoCapacity: routeCalc.totalCargoCapacity,
                totalQuantumFuel: routeCalc.totalQuantumFuel,
                totalCrewCapacity: routeCalc.totalCrewCapacity,
            },
        });
        return activity;
    }
}
exports.RouteCalculationService = RouteCalculationService;
//# sourceMappingURL=RouteCalculationService.js.map