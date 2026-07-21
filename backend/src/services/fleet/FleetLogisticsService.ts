import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { FleetLogistics, LogisticsStatus } from '../../models/FleetLogistics';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions, paginateRepository } from '../../utils/pagination';

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

export class FleetLogisticsService {
  private readonly repository: Repository<FleetLogistics>;

  constructor() {
    this.repository = AppDataSource.getRepository(FleetLogistics);
  }

  async create(dto: CreateLogisticsDto): Promise<FleetLogistics> {
    logger.debug('FleetLogisticsService.create', { fleetId: dto.fleetId });

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
      status: LogisticsStatus.PLANNING,
      totalFuelCapacity: 0,
      totalCargoCapacity: 0,
      totalFuelRequired: 0,
      totalCargoUsed: 0,
    });

    this.calculateTotals(logistics);
    await this.repository.save(logistics);
    return logistics;
  }

  async findAll(
    pagination: PaginationOptions,
    fleetId?: string
  ): Promise<PaginatedResponse<FleetLogistics>> {
    const whereConditions = fleetId ? { fleetId } : undefined;
    return paginateRepository(this.repository, pagination, whereConditions, 'createdAt');
  }

  async findById(id: string): Promise<FleetLogistics> {
    const logistics = await this.repository.findOne({ where: { id } });
    if (!logistics) {
      throw new NotFoundError('Fleet logistics');
    }
    return logistics;
  }

  async update(id: string, updateData: Partial<FleetLogistics>): Promise<FleetLogistics> {
    const logistics = await this.findById(id);

    // Only update allowed fields — prevent overwriting id, status, fleetId
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

  async updateStatus(id: string, status: LogisticsStatus): Promise<FleetLogistics> {
    if (!Object.values(LogisticsStatus).includes(status)) {
      throw new ValidationError(`Invalid logistics status: ${status}`);
    }
    const logistics = await this.findById(id);
    logistics.status = status;
    await this.repository.save(logistics);
    return logistics;
  }

  async delete(id: string): Promise<void> {
    const result = await this.repository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundError('Fleet logistics');
    }
  }

  calculateFuelRequirements(logistics: FleetLogistics) {
    const totalFuelRequired = logistics.route.reduce(
      (sum, waypoint) => sum + waypoint.requiredFuel,
      0
    );
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
        fuelPercentage:
          ship.fuelCapacity > 0
            ? ((ship.currentFuel / ship.fuelCapacity) * 100).toFixed(2)
            : '0.00',
      })),
    };
  }

  calculateCargoCapacity(logistics: FleetLogistics) {
    const totalCargoUsed = logistics.resources.reduce(
      (sum, resource) => sum + (resource.totalWeight || resource.quantity),
      0
    );
    const totalCargoCapacity = logistics.ships.reduce((sum, ship) => sum + ship.cargoCapacity, 0);
    const cargoAvailable = totalCargoCapacity - totalCargoUsed;
    const cargoUtilization =
      totalCargoCapacity > 0 ? ((totalCargoUsed / totalCargoCapacity) * 100).toFixed(2) : '0.00';

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
        cargoPercentage:
          ship.cargoCapacity > 0
            ? ((ship.currentCargo / ship.cargoCapacity) * 100).toFixed(2)
            : '0.00',
      })),
    };
  }

  calculateJumpRange(logistics: FleetLogistics) {
    const minJumpRange =
      logistics.ships.length > 0 ? Math.min(...logistics.ships.map(ship => ship.jumpRange)) : 0;

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

  private calculateTotals(logistics: FleetLogistics): void {
    logistics.totalFuelCapacity = logistics.ships.reduce((sum, ship) => sum + ship.fuelCapacity, 0);
    logistics.totalCargoCapacity = logistics.ships.reduce(
      (sum, ship) => sum + ship.cargoCapacity,
      0
    );
    logistics.totalFuelRequired = logistics.route.reduce(
      (sum, waypoint) => sum + waypoint.requiredFuel,
      0
    );
    logistics.totalCargoUsed = logistics.resources.reduce(
      (sum, resource) => sum + (resource.totalWeight || resource.quantity),
      0
    );
    if (logistics.ships.length > 0) {
      logistics.maxJumpRange = Math.min(...logistics.ships.map(ship => ship.jumpRange));
    }
  }
}

