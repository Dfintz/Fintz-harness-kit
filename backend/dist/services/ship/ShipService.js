"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Ship_1 = require("../../models/Ship");
const careerMapping_1 = require("../../utils/careerMapping");
const logger_1 = require("../../utils/logger");
const fullTextSearch_1 = require("../../utils/query/fullTextSearch");
const TenantService_1 = require("../base/TenantService");
class ShipService extends TenantService_1.TenantService {
    constructor() {
        const shipRepository = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
        super(shipRepository, {
            enableCache: true,
            cacheTTL: 600,
            cacheCheckPeriod: 120,
        });
    }
    async findWithFilters(organizationId, filters) {
        logger_1.logger.debug('ShipService.findWithFilters', { organizationId, filters });
        const queryBuilder = this.repository
            .createQueryBuilder('ship')
            .where('ship.organizationId = :organizationId', { organizationId });
        if (filters.manufacturer) {
            queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', {
                manufacturer: filters.manufacturer,
            });
        }
        if (filters.size) {
            queryBuilder.andWhere('ship.size = :size', { size: filters.size });
        }
        if (filters.role) {
            queryBuilder.andWhere('LOWER(ship.role) LIKE LOWER(:role)', {
                role: `%${filters.role}%`,
            });
        }
        if (filters.status) {
            queryBuilder.andWhere('ship.status = :status', { status: filters.status });
        }
        if (filters.isVehicle !== undefined) {
            queryBuilder.andWhere('ship.isVehicle = :isVehicle', {
                isVehicle: filters.isVehicle,
            });
        }
        if (filters.isActive !== undefined) {
            queryBuilder.andWhere('ship.isActive = :isActive', {
                isActive: filters.isActive,
            });
        }
        else {
            queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
        }
        if (filters.search) {
            (0, fullTextSearch_1.addFullTextSearch)(queryBuilder, 'ship', filters.search, ['name', 'manufacturer']);
        }
        if (filters.search) {
            queryBuilder.addOrderBy('ship.name', 'ASC');
        }
        else {
            queryBuilder.orderBy('ship.name', 'ASC');
        }
        return queryBuilder.getMany();
    }
    async findByIds(organizationId, shipIds) {
        if (shipIds.length === 0) {
            return [];
        }
        logger_1.logger.debug('ShipService.findByIds', { organizationId, count: shipIds.length });
        return this.repository.find({
            where: {
                id: (0, typeorm_1.In)(shipIds),
                organizationId,
            },
        });
    }
    async findByManufacturer(organizationId, manufacturer) {
        logger_1.logger.debug('ShipService.findByManufacturer', { organizationId, manufacturer });
        return this.repository.find({
            where: {
                organizationId,
                manufacturer: (0, typeorm_1.ILike)(manufacturer),
                isActive: true,
            },
            order: { name: 'ASC' },
        });
    }
    async findBySize(organizationId, size) {
        logger_1.logger.debug('ShipService.findBySize', { organizationId, size });
        return this.repository.find({
            where: {
                organizationId,
                size,
                isActive: true,
            },
            order: { name: 'ASC' },
        });
    }
    async findByRole(organizationId, role) {
        logger_1.logger.debug('ShipService.findByRole', { organizationId, role });
        return this.repository
            .createQueryBuilder('ship')
            .where('ship.organizationId = :organizationId', { organizationId })
            .andWhere('ship.isActive = :isActive', { isActive: true })
            .andWhere('LOWER(ship.role) LIKE LOWER(:role)', { role: `%${role}%` })
            .orderBy('ship.name', 'ASC')
            .getMany();
    }
    async getStatistics(organizationId) {
        logger_1.logger.debug('ShipService.getStatistics', { organizationId });
        const baseQb = this.repository
            .createQueryBuilder('ship')
            .where('ship.organizationId = :organizationId', { organizationId })
            .andWhere('ship.isActive = :isActive', { isActive: true });
        const [totalAndValue, manufacturerStats, sizeStats, statusStats] = await Promise.all([
            baseQb
                .clone()
                .select('COUNT(*)', 'total')
                .addSelect('COALESCE(SUM(ship.price), 0)', 'totalValue')
                .getRawOne(),
            baseQb
                .clone()
                .select('ship.manufacturer', 'manufacturer')
                .addSelect('COUNT(*)', 'count')
                .groupBy('ship.manufacturer')
                .getRawMany(),
            baseQb
                .clone()
                .select('ship.size', 'size')
                .addSelect('COUNT(*)', 'count')
                .where('ship.organizationId = :organizationId', { organizationId })
                .andWhere('ship.isActive = :isActive', { isActive: true })
                .andWhere('ship.size IS NOT NULL')
                .groupBy('ship.size')
                .getRawMany(),
            baseQb
                .clone()
                .select('ship.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .groupBy('ship.status')
                .getRawMany(),
        ]);
        const byManufacturer = {};
        for (const row of manufacturerStats) {
            byManufacturer[row.manufacturer] = Number.parseInt(row.count, 10);
        }
        const bySize = {};
        for (const row of sizeStats) {
            bySize[row.size] = Number.parseInt(row.count, 10);
        }
        const byStatus = {};
        for (const row of statusStats) {
            byStatus[row.status] = Number.parseInt(row.count, 10);
        }
        return {
            total: Number.parseInt(totalAndValue?.total ?? '0', 10),
            byManufacturer,
            bySize,
            byStatus,
            totalValue: Number.parseFloat(totalAndValue?.totalValue ?? '0'),
        };
    }
    async search(organizationId, searchTerm) {
        logger_1.logger.debug('ShipService.search', { organizationId, searchTerm });
        return this.repository
            .createQueryBuilder('ship')
            .where('ship.organizationId = :organizationId', { organizationId })
            .andWhere('ship.isActive = :isActive', { isActive: true })
            .andWhere('(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))', { search: `%${searchTerm}%` })
            .orderBy('ship.name', 'ASC')
            .limit(50)
            .getMany();
    }
    async deactivate(organizationId, id) {
        logger_1.logger.info('ShipService.deactivate', { organizationId, id });
        const ship = await this.findById(organizationId, id);
        if (!ship) {
            return null;
        }
        ship.isActive = false;
        return this.repository.save(ship);
    }
    async reactivate(organizationId, id) {
        logger_1.logger.info('ShipService.reactivate', { organizationId, id });
        const ship = await this.repository.findOne({
            where: { id, organizationId },
        });
        if (!ship) {
            return null;
        }
        ship.isActive = true;
        return this.repository.save(ship);
    }
    async getAverageCrewByRole(role) {
        logger_1.logger.debug('ShipService.getAverageCrewByRole', { role });
        const result = await this.repository
            .createQueryBuilder('ship')
            .select('AVG(COALESCE(ship.maxCrew, ship.crew, 1))', 'avgCrew')
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('LOWER(ship.role) = LOWER(:role)', { role })
            .andWhere('(ship.maxCrew IS NOT NULL OR ship.crew IS NOT NULL)')
            .getRawOne();
        const avg = Number.parseFloat(result?.avgCrew ?? '0');
        return avg > 0 ? Math.ceil(avg) : 1;
    }
    async getCrewByShipName(shipName) {
        logger_1.logger.debug('ShipService.getCrewByShipName', { shipName });
        const ship = await this.repository.findOne({
            where: { name: shipName, isActive: true },
            select: ['maxCrew', 'crew'],
        });
        return ship?.maxCrew ?? ship?.crew ?? 1;
    }
    async calculateCrewFromRequirements(requirements) {
        logger_1.logger.debug('ShipService.calculateCrewFromRequirements', {
            count: requirements.length,
        });
        const shipNamesToLookup = requirements
            .filter((r) => r.requirementType === 'specific' && r.crewPerShip <= 0)
            .map(r => r.shipName);
        const rolesToLookup = requirements
            .filter((r) => r.requirementType === 'role' && r.avgCrewPerShip <= 0)
            .map(r => r.role);
        const crewByName = await this.batchGetCrewByNames(shipNamesToLookup);
        const crewByRole = await this.batchGetCrewByRoles(rolesToLookup);
        let totalCrew = 0;
        for (const req of requirements) {
            if (req.requirementType === 'specific') {
                const crewPerShip = req.crewPerShip > 0 ? req.crewPerShip : (crewByName.get(req.shipName) ?? 1);
                totalCrew += req.count * crewPerShip;
            }
            else if (req.requirementType === 'role') {
                const avgCrew = req.avgCrewPerShip > 0
                    ? req.avgCrewPerShip
                    : (crewByRole.get(req.role.toLowerCase()) ?? 1);
                totalCrew += req.count * avgCrew;
            }
        }
        return totalCrew;
    }
    async batchGetCrewByNames(shipNames) {
        const result = new Map();
        if (shipNames.length === 0) {
            return result;
        }
        const uniqueNames = [...new Set(shipNames)];
        const ships = await this.repository
            .createQueryBuilder('ship')
            .select(['ship.name', 'ship.maxCrew', 'ship.crew'])
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('ship.name IN (:...names)', { names: uniqueNames })
            .getMany();
        for (const ship of ships) {
            result.set(ship.name, ship.maxCrew ?? ship.crew ?? 1);
        }
        return result;
    }
    async batchGetCrewByRoles(roles) {
        const result = new Map();
        if (roles.length === 0) {
            return result;
        }
        const uniqueRoles = [...new Set(roles)];
        const rows = await this.repository
            .createQueryBuilder('ship')
            .select('LOWER(ship.role)', 'role')
            .addSelect('AVG(COALESCE(ship.maxCrew, ship.crew, 1))', 'avgCrew')
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('LOWER(ship.role) IN (:...roles)', { roles: uniqueRoles.map(r => r.toLowerCase()) })
            .andWhere('(ship.maxCrew IS NOT NULL OR ship.crew IS NOT NULL)')
            .groupBy('LOWER(ship.role)')
            .getRawMany();
        for (const row of rows) {
            const avg = Number.parseFloat(row.avgCrew);
            result.set(row.role.toLowerCase(), avg > 0 ? Math.ceil(avg) : 1);
        }
        return result;
    }
    async batchGetShipSpecsByNames(shipNames) {
        const result = new Map();
        if (shipNames.length === 0) {
            return result;
        }
        const uniqueNames = [...new Set(shipNames.map(n => n.toLowerCase()))];
        const ships = await this.repository
            .createQueryBuilder('ship')
            .select(['ship.name', 'ship.cargo', 'ship.quantumFuelCapacity'])
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('LOWER(ship.name) IN (:...names)', { names: uniqueNames })
            .getMany();
        for (const ship of ships) {
            result.set(ship.name.toLowerCase(), {
                cargo: ship.cargo ?? 0,
                quantumFuelCapacity: ship.quantumFuelCapacity ?? 0,
            });
        }
        return result;
    }
    async batchGetShipCareersByNames(shipNames) {
        const result = new Map();
        if (shipNames.length === 0) {
            return result;
        }
        const uniqueNames = [...new Set(shipNames.map(n => n.toLowerCase()))];
        const ships = await this.repository
            .createQueryBuilder('ship')
            .select(['ship.name', 'ship.career', 'ship.role', 'ship.size'])
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('LOWER(ship.name) IN (:...names)', { names: uniqueNames })
            .getMany();
        for (const ship of ships) {
            const displayCareer = (0, careerMapping_1.resolveDisplayCareer)(ship.career ?? '', ship.role, ship.size, ship.name);
            if (displayCareer && displayCareer !== 'Unknown') {
                result.set(ship.name.toLowerCase(), displayCareer);
            }
        }
        return result;
    }
}
exports.ShipService = ShipService;
//# sourceMappingURL=ShipService.js.map