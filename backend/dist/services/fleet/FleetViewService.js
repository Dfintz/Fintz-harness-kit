"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetViewService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const Ship_1 = require("../../models/Ship");
class FleetViewService {
    shipRepository = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
    async exportToFleetView(options) {
        const { organizationId, userId, includeStatistics = true, includeInactive = false } = options;
        const queryBuilder = this.shipRepository.createQueryBuilder('ship');
        if (organizationId) {
            queryBuilder.where('ship.organizationId = :organizationId', { organizationId });
        }
        else if (userId) {
            queryBuilder.where('ship.organizationId = :organizationId', { organizationId: `user-${userId}` });
        }
        if (!includeInactive) {
            queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
        }
        const ships = await queryBuilder.getMany();
        const fleetViewShips = ships.map((ship) => this.shipToFleetView(ship));
        const schema = {
            version: '1.0',
            updated: new Date().toISOString(),
            ships: fleetViewShips
        };
        if (includeStatistics) {
            schema.statistics = this.calculateStatistics(ships);
        }
        return schema;
    }
    async importFromFleetView(schema, options) {
        const { skipDuplicates = true, organizationId, userId } = options;
        const result = {
            success: true,
            imported: 0,
            skipped: 0,
            errors: [],
            ships: []
        };
        for (const fleetViewShip of schema.ships) {
            try {
                const shipName = fleetViewShip.name;
                const manufacturer = fleetViewShip.manufacturer || 'Unknown';
                if (skipDuplicates) {
                    const existingShip = await this.shipRepository.findOne({
                        where: {
                            name: shipName,
                            manufacturer,
                            organizationId
                        }
                    });
                    if (existingShip) {
                        result.skipped++;
                        result.ships.push({
                            name: shipName,
                            status: 'skipped',
                            message: 'Ship already exists'
                        });
                        continue;
                    }
                }
                const ship = this.fleetViewToShip(fleetViewShip, organizationId, userId);
                await this.shipRepository.save(ship);
                result.imported++;
                result.ships.push({
                    name: shipName,
                    status: 'imported'
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Failed to import ${fleetViewShip.name}: ${errorMessage}`);
                result.ships.push({
                    name: fleetViewShip.name,
                    status: 'error',
                    message: errorMessage
                });
            }
        }
        result.success = result.errors.length === 0;
        return result;
    }
    shipToFleetView(ship) {
        const fleetViewShip = {
            name: ship.name,
            manufacturer: ship.manufacturer,
            kind: ship.role || undefined,
            owned: 1,
            notes: ship.description || undefined,
        };
        if (ship.metadata && typeof ship.metadata === 'object') {
            if ('lti' in ship.metadata) {
                fleetViewShip.lti = ship.metadata.lti;
            }
            if ('warbond' in ship.metadata) {
                fleetViewShip.warbond = ship.metadata.warbond;
            }
            if ('tags' in ship.metadata && Array.isArray(ship.metadata.tags)) {
                fleetViewShip.tags = ship.metadata.tags;
            }
        }
        if (ship.pledgePrice) {
            fleetViewShip.cost = ship.pledgePrice;
        }
        else if (ship.price) {
            fleetViewShip.cost = Number(ship.price);
        }
        return fleetViewShip;
    }
    fleetViewToShip(fleetViewShip, organizationId, _userId) {
        const shipId = this.generateShipId(fleetViewShip.name, fleetViewShip.manufacturer || 'Unknown');
        const ship = new Ship_1.Ship();
        ship.id = shipId;
        ship.name = fleetViewShip.name;
        ship.manufacturer = fleetViewShip.manufacturer || 'Unknown';
        ship.role = fleetViewShip.kind || undefined;
        ship.description = fleetViewShip.notes || undefined;
        ship.organizationId = organizationId;
        ship.status = Ship_1.ShipStatus.FLIGHT_READY;
        ship.isActive = true;
        ship.metadata = {
            importedFromFleetView: true,
            importDate: new Date().toISOString(),
            lti: fleetViewShip.lti || false,
            warbond: fleetViewShip.warbond || false,
            pledge: fleetViewShip.pledge,
            tags: fleetViewShip.tags || []
        };
        if (fleetViewShip.cost) {
            ship.pledgePrice = fleetViewShip.cost;
            ship.price = fleetViewShip.cost;
        }
        return ship;
    }
    calculateStatistics(ships) {
        const stats = {
            totalShips: ships.length,
            totalValue: 0,
            manufacturers: {},
            roles: {}
        };
        for (const ship of ships) {
            if (ship.pledgePrice) {
                stats.totalValue += ship.pledgePrice;
            }
            else if (ship.price) {
                stats.totalValue += Number(ship.price);
            }
            const manufacturer = ship.manufacturer || 'Unknown';
            stats.manufacturers[manufacturer] = (stats.manufacturers[manufacturer] || 0) + 1;
            const role = ship.role || 'Unknown';
            stats.roles[role] = (stats.roles[role] || 0) + 1;
        }
        return stats;
    }
    generateShipId(name, manufacturer) {
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const cleanManufacturer = manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const uniqueSuffix = (0, uuid_1.v4)().split('-')[0];
        return `${cleanManufacturer}-${cleanName}-${uniqueSuffix}`;
    }
    validateSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            return false;
        }
        if (!Array.isArray(schema.ships)) {
            return false;
        }
        for (const ship of schema.ships) {
            if (!ship.name || typeof ship.name !== 'string') {
                return false;
            }
        }
        return true;
    }
}
exports.FleetViewService = FleetViewService;
//# sourceMappingURL=FleetViewService.js.map