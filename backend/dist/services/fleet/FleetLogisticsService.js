"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetLogisticsService = void 0;
const database_1 = require("../../config/database");
const FleetLogistics_1 = require("../../models/FleetLogistics");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
class FleetLogisticsService {
    repository;
    constructor() {
        this.repository = database_1.AppDataSource.getRepository(FleetLogistics_1.FleetLogistics);
    }
    async create(dto) {
        logger_1.logger.debug('FleetLogisticsService.create', { fleetId: dto.fleetId });
        const logistics = this.repository.create({
            id: crypto.randomUUID(),
            fleetId: dto.fleetId,
            operationName: dto.operationName,
            description: dto.description,
            coordinatorId: dto.coordinatorId,
            ships: dto.ships || [],
            resources: dto.resources || [],
            route: dto.route || [],
            notes: dto.notes,
            status: FleetLogistics_1.LogisticsStatus.PLANNING,
            totalFuelCapacity: 0,
            totalCargoCapacity: 0,
            totalFuelRequired: 0,
            totalCargoUsed: 0,
        });
        this.calculateTotals(logistics);
        await this.repository.save(logistics);
        return logistics;
    }
    async findAll(pagination, fleetId) {
        const whereConditions = fleetId ? { fleetId } : undefined;
        return (0, pagination_1.paginateRepository)(this.repository, pagination, whereConditions, 'createdAt');
    }
    async findById(id) {
        const logistics = await this.repository.findOne({ where: { id } });
        if (!logistics) {
            throw new apiErrors_1.NotFoundError('Fleet logistics');
        }
        return logistics;
    }
    async update(id, updateData) {
        const logistics = await this.findById(id);
        if (updateData.operationName !== undefined) {
            logistics.operationName = updateData.operationName;
        }
        if (updateData.description !== undefined) {
            logistics.description = updateData.description;
        }
        if (updateData.coordinatorId !== undefined) {
            logistics.coordinatorId = updateData.coordinatorId;
        }
        if (updateData.ships !== undefined) {
            logistics.ships = updateData.ships;
        }
        if (updateData.resources !== undefined) {
            logistics.resources = updateData.resources;
        }
        if (updateData.route !== undefined) {
            logistics.route = updateData.route;
        }
        if (updateData.notes !== undefined) {
            logistics.notes = updateData.notes;
        }
        if (updateData.ships || updateData.resources || updateData.route) {
            this.calculateTotals(logistics);
        }
        await this.repository.save(logistics);
        return logistics;
    }
    async updateStatus(id, status) {
        if (!Object.values(FleetLogistics_1.LogisticsStatus).includes(status)) {
            throw new apiErrors_1.ValidationError(`Invalid logistics status: ${status}`);
        }
        const logistics = await this.findById(id);
        logistics.status = status;
        await this.repository.save(logistics);
        return logistics;
    }
    async delete(id) {
        const result = await this.repository.delete(id);
        if (result.affected === 0) {
            throw new apiErrors_1.NotFoundError('Fleet logistics');
        }
    }
    calculateFuelRequirements(logistics) {
        const totalFuelRequired = logistics.route.reduce((sum, waypoint) => sum + waypoint.requiredFuel, 0);
        const totalCurrentFuel = logistics.ships.reduce((sum, ship) => sum + ship.currentFuel, 0);
        const fuelShortage = Math.max(0, totalFuelRequired - totalCurrentFuel);
        return {
            totalFuelRequired,
            totalCurrentFuel,
            fuelShortage,
            canCompleteRoute: fuelShortage === 0,
            shipsStatus: logistics.ships.map(ship => ({
                shipId: ship.shipId,
                shipName: ship.shipName,
                currentFuel: ship.currentFuel,
                fuelCapacity: ship.fuelCapacity,
                fuelPercentage: ship.fuelCapacity > 0
                    ? ((ship.currentFuel / ship.fuelCapacity) * 100).toFixed(2)
                    : '0.00',
            })),
        };
    }
    calculateCargoCapacity(logistics) {
        const totalCargoUsed = logistics.resources.reduce((sum, resource) => sum + (resource.totalWeight || resource.quantity), 0);
        const totalCargoCapacity = logistics.ships.reduce((sum, ship) => sum + ship.cargoCapacity, 0);
        const cargoAvailable = totalCargoCapacity - totalCargoUsed;
        const cargoUtilization = totalCargoCapacity > 0 ? ((totalCargoUsed / totalCargoCapacity) * 100).toFixed(2) : '0.00';
        return {
            totalCargoCapacity,
            totalCargoUsed,
            cargoAvailable,
            cargoUtilization: `${cargoUtilization}%`,
            canFitAllResources: cargoAvailable >= 0,
            shipsStatus: logistics.ships.map(ship => ({
                shipId: ship.shipId,
                shipName: ship.shipName,
                currentCargo: ship.currentCargo,
                cargoCapacity: ship.cargoCapacity,
                cargoPercentage: ship.cargoCapacity > 0
                    ? ((ship.currentCargo / ship.cargoCapacity) * 100).toFixed(2)
                    : '0.00',
            })),
        };
    }
    calculateJumpRange(logistics) {
        const minJumpRange = logistics.ships.length > 0 ? Math.min(...logistics.ships.map(ship => ship.jumpRange)) : 0;
        const routeFeasibility = logistics.route.map(waypoint => ({
            location: waypoint.location,
            distance: waypoint.distance,
            order: waypoint.order,
            accessible: waypoint.distance <= minJumpRange,
            exceedsRange: waypoint.distance > minJumpRange ? waypoint.distance - minJumpRange : 0,
        }));
        return {
            fleetMinJumpRange: minJumpRange,
            canCompleteRoute: routeFeasibility.every(wp => wp.accessible),
            routeFeasibility,
            shipsJumpRange: logistics.ships.map(ship => ({
                shipId: ship.shipId,
                shipName: ship.shipName,
                jumpRange: ship.jumpRange,
                isLimitingFactor: ship.jumpRange === minJumpRange,
            })),
        };
    }
    calculateTotals(logistics) {
        logistics.totalFuelCapacity = logistics.ships.reduce((sum, ship) => sum + ship.fuelCapacity, 0);
        logistics.totalCargoCapacity = logistics.ships.reduce((sum, ship) => sum + ship.cargoCapacity, 0);
        logistics.totalFuelRequired = logistics.route.reduce((sum, waypoint) => sum + waypoint.requiredFuel, 0);
        logistics.totalCargoUsed = logistics.resources.reduce((sum, resource) => sum + (resource.totalWeight || resource.quantity), 0);
        if (logistics.ships.length > 0) {
            logistics.maxJumpRange = Math.min(...logistics.ships.map(ship => ship.jumpRange));
        }
    }
}
exports.FleetLogisticsService = FleetLogisticsService;
//# sourceMappingURL=FleetLogisticsService.js.map