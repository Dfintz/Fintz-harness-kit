"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationShipService = void 0;
exports.attachCatalogueMetadata = attachCatalogueMetadata;
const data_source_1 = require("../../data-source");
const OrganizationShip_1 = require("../../models/OrganizationShip");
const Ship_1 = require("../../models/Ship");
const ShipLoan_1 = require("../../models/ShipLoan");
const UserShip_1 = require("../../models/UserShip");
const cacheInvalidation_1 = require("../../utils/cacheInvalidation");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
const redis_1 = require("../../utils/redis");
const TenantService_1 = require("../base/TenantService");
const shipServiceHelpers_1 = require("./shipServiceHelpers");
async function attachCatalogueMetadata(ships) {
    if (ships.length === 0) {
        return ships;
    }
    const shipIds = [...new Set(ships.map(s => s.shipId).filter((v) => !!v))];
    const shipNamesLower = [
        ...new Set(ships
            .filter(s => !s.shipId)
            .map(s => (s.shipName ?? '').toLowerCase())
            .filter(v => v.length > 0)),
    ];
    const shipRepo = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
    const qb = shipRepo
        .createQueryBuilder('s')
        .select(['s.id', 's.name', 's.role', 's.size', 's.manufacturer']);
    const conditions = [];
    if (shipIds.length > 0) {
        qb.setParameter('ids', shipIds);
        conditions.push('s.id IN (:...ids)');
    }
    if (shipNamesLower.length > 0) {
        qb.setParameter('names', shipNamesLower);
        conditions.push('LOWER(s.name) IN (:...names)');
    }
    if (conditions.length === 0) {
        return ships;
    }
    const catalogueRows = await qb.where(conditions.join(' OR ')).getMany();
    const byId = new Map();
    const byNameLower = new Map();
    for (const row of catalogueRows) {
        byId.set(row.id, row);
        byNameLower.set(row.name.toLowerCase(), row);
    }
    return ships.map(ship => {
        const match = (ship.shipId && byId.get(ship.shipId)) ??
            byNameLower.get((ship.shipName ?? '').toLowerCase());
        if (!match) {
            return ship;
        }
        return Object.assign(ship, {
            shipRole: match.role,
            shipSize: match.size,
            shipManufacturer: match.manufacturer,
        });
    });
}
class OrganizationShipService extends TenantService_1.TenantService {
    constructor() {
        super(data_source_1.AppDataSource.getRepository(OrganizationShip_1.OrganizationShip), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
    }
    async createOrgShip(organizationId, data) {
        logger_1.logger.info('OrganizationShipService.createOrgShip', {
            organizationId,
            shipName: data.shipName,
        });
        const ship = this.repository.create({
            ...data,
            organizationId,
            role: data.role || OrganizationShip_1.OrgShipRole.RESERVE,
            status: data.status || UserShip_1.ShipOwnershipStatus.OWNED,
            condition: data.condition || UserShip_1.ShipCondition.GOOD,
            isActive: true,
            isAvailable: true,
        });
        const saved = await this.repository.save(ship);
        (0, cacheInvalidation_1.invalidateFleetSummaryCache)(organizationId);
        return saved;
    }
    async getOrgShipById(organizationId, shipId) {
        return this.findById(organizationId, shipId);
    }
    async getOrgShips(organizationId, options) {
        const result = await (0, pagination_1.paginateRepository)(this.repository, options || {}, { organizationId, isActive: true }, 'shipName');
        result.data = await attachCatalogueMetadata(result.data);
        return result;
    }
    async findOrgShips(organizationId, filters, options) {
        const query = this.repository
            .createQueryBuilder('ship')
            .where('ship.organizationId = :organizationId', { organizationId })
            .andWhere('ship.isActive = :isActive', { isActive: true });
        if (filters.shipId) {
            query.andWhere('ship.shipId = :shipId', { shipId: filters.shipId });
        }
        if (filters.role) {
            if (Array.isArray(filters.role)) {
                query.andWhere('ship.role IN (:...roles)', { roles: filters.role });
            }
            else {
                query.andWhere('ship.role = :role', { role: filters.role });
            }
        }
        (0, shipServiceHelpers_1.applyCommonShipFilters)(query, filters);
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const sortBy = options?.sortBy || 'shipName';
        const sortOrder = options?.sortOrder || 'ASC';
        query
            .orderBy(`ship.${sortBy}`, sortOrder)
            .skip((page - 1) * limit)
            .take(limit);
        const [data, total] = await query.getManyAndCount();
        return {
            data: await attachCatalogueMetadata(data),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async updateOrgShip(organizationId, shipId, updates) {
        logger_1.logger.info('OrganizationShipService.updateOrgShip', { organizationId, shipId });
        const ship = await this.findById(organizationId, shipId);
        if (!ship) {
            return null;
        }
        Object.assign(ship, updates);
        const saved = await this.repository.save(ship);
        (0, cacheInvalidation_1.invalidateFleetSummaryCache)(organizationId);
        return saved;
    }
    async assignCaptain(organizationId, shipId, captainId) {
        const ship = await this.findById(organizationId, shipId);
        if (!ship) {
            return null;
        }
        ship.assignedCaptain = captainId;
        return this.repository.save(ship);
    }
    async assignCrew(organizationId, shipId, crewIds) {
        const ship = await this.findById(organizationId, shipId);
        if (!ship) {
            return null;
        }
        ship.assignedCrew = crewIds;
        return this.repository.save(ship);
    }
    async addCrewMember(organizationId, shipId, userId, _role) {
        const ship = await this.findById(organizationId, shipId);
        if (!ship) {
            return null;
        }
        if (!ship.assignedCrew) {
            ship.assignedCrew = [];
        }
        if (!ship.assignedCrew.includes(userId)) {
            ship.assignedCrew.push(userId);
            return this.repository.save(ship);
        }
        return ship;
    }
    async removeCrewMember(organizationId, shipId, userId) {
        const ship = await this.findById(organizationId, shipId);
        if (!ship) {
            return null;
        }
        if (ship.assignedCrew) {
            ship.assignedCrew = ship.assignedCrew.filter(id => id !== userId);
            return this.repository.save(ship);
        }
        return ship;
    }
    async getShipsNeedingMaintenance(organizationId) {
        const now = new Date();
        return this.repository
            .createQueryBuilder('ship')
            .where('ship.organizationId = :organizationId', { organizationId })
            .andWhere('ship.nextMaintenance IS NOT NULL')
            .andWhere('ship.nextMaintenance <= :now', { now })
            .andWhere('ship.isActive = :isActive', { isActive: true })
            .orderBy('ship.nextMaintenance', 'ASC')
            .getMany();
    }
    async getCapitalShips(organizationId, options) {
        return this.findOrgShips(organizationId, { isCapital: true }, options);
    }
    async getShipsByRole(organizationId, role, options) {
        return this.findOrgShips(organizationId, { role }, options);
    }
    async getAvailableShips(organizationId, options) {
        return this.findOrgShips(organizationId, { isAvailable: true, status: UserShip_1.ShipOwnershipStatus.OWNED }, options);
    }
    async getFleetSummary(organizationId) {
        const cacheKey = `org:${organizationId}:fleet:summary`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const roleRows = await this.repository
            .createQueryBuilder('s')
            .select('s.role', 'role')
            .addSelect('COUNT(*)::int', 'count')
            .where('s."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('s."isActive" = true')
            .groupBy('s.role')
            .getRawMany();
        const statusRows = await this.repository
            .createQueryBuilder('s')
            .select('s.status', 'status')
            .addSelect('COUNT(*)::int', 'count')
            .where('s."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('s."isActive" = true')
            .groupBy('s.status')
            .getRawMany();
        const conditionRows = await this.repository
            .createQueryBuilder('s')
            .select('s.condition', 'condition')
            .addSelect('COUNT(*)::int', 'count')
            .where('s."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('s."isActive" = true')
            .groupBy('s.condition')
            .getRawMany();
        const aggregates = await this.repository
            .createQueryBuilder('s')
            .select('COUNT(*)::int', 'totalShips')
            .addSelect('SUM(CASE WHEN s."isCapital" = true THEN 1 ELSE 0 END)::int', 'capitalShips')
            .addSelect(`SUM(CASE WHEN s.condition NOT IN ('damaged', 'critical')
              AND s.status NOT IN ('destroyed', 'lost')
              AND s."isActive" = true
              AND s."isAvailable" = true
              AND (s."nextMaintenance" IS NULL OR s."nextMaintenance" > NOW())
         THEN 1 ELSE 0 END)::int`, 'availableShips')
            .addSelect(`SUM(CASE WHEN s."nextMaintenance" IS NOT NULL AND s."nextMaintenance" <= NOW()
         THEN 1 ELSE 0 END)::int`, 'needsMaintenance')
            .addSelect('COALESCE(SUM(s."acquisitionCost"), 0)', 'totalValue')
            .addSelect('COALESCE(SUM(s."maintenanceCosts"), 0)', 'totalMaintenanceCosts')
            .where('s."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('s."isActive" = true')
            .getRawOne();
        const byRole = {};
        for (const row of roleRows) {
            byRole[row.role] = row.count;
        }
        const byStatus = {};
        for (const row of statusRows) {
            byStatus[row.status] = row.count;
        }
        const byCondition = {};
        for (const row of conditionRows) {
            byCondition[row.condition] = row.count;
        }
        const result = {
            totalShips: aggregates?.totalShips ?? 0,
            byRole,
            byStatus,
            byCondition,
            capitalShips: aggregates?.capitalShips ?? 0,
            availableShips: aggregates?.availableShips ?? 0,
            needsMaintenance: aggregates?.needsMaintenance ?? 0,
            totalValue: Number(aggregates?.totalValue ?? 0),
            totalMaintenanceCosts: Number(aggregates?.totalMaintenanceCosts ?? 0),
        };
        await redis_1.cache.set(cacheKey, result, 300);
        return result;
    }
    async deleteOrgShip(organizationId, shipId) {
        const ship = await this.findById(organizationId, shipId);
        if (!ship) {
            return false;
        }
        ship.isActive = false;
        await this.repository.save(ship);
        (0, cacheInvalidation_1.invalidateFleetSummaryCache)(organizationId);
        return true;
    }
    async loanOrgShip(organizationId, shipId, borrowerId, options) {
        const ship = await this.findById(organizationId, shipId);
        if (!ship) {
            return null;
        }
        const { purpose, activityId, activityName } = options ?? {};
        ship.status = UserShip_1.ShipOwnershipStatus.LOANED;
        ship.assignedCaptain = borrowerId;
        ship.isAvailable = false;
        if (purpose) {
            ship.notes = `Loaned: ${purpose}${ship.notes ? `\n${ship.notes}` : ''}`;
        }
        const savedShip = await this.repository.save(ship);
        try {
            const loanRepo = data_source_1.AppDataSource.getRepository(ShipLoan_1.ShipLoan);
            const now = new Date();
            const loan = loanRepo.create({
                id: `loan-${Date.now()}`,
                shipId,
                shipName: ship.shipName,
                lenderId: organizationId,
                borrowerId,
                organizationId,
                activityId,
                activityName,
                scope: 'organization',
                purpose,
                requestDate: now,
                startDate: now,
                expectedReturnDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                status: ShipLoan_1.LoanStatus.ACTIVE,
            });
            await loanRepo.save(loan);
            logger_1.logger.info('Org ShipLoan record created', {
                loanId: loan.id,
                shipId,
                organizationId,
                activityId,
            });
        }
        catch (err) {
            logger_1.logger.error('Failed to create org ShipLoan record', {
                shipId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        (0, cacheInvalidation_1.invalidateFleetSummaryCache)(organizationId);
        return savedShip;
    }
    async returnOrgShipLoan(organizationId, shipId) {
        const ship = await this.findById(organizationId, shipId);
        if (ship?.status !== UserShip_1.ShipOwnershipStatus.LOANED) {
            return null;
        }
        ship.status = UserShip_1.ShipOwnershipStatus.OWNED;
        ship.assignedCaptain = undefined;
        ship.isAvailable = true;
        const savedShip = await this.repository.save(ship);
        try {
            const loanRepo = data_source_1.AppDataSource.getRepository(ShipLoan_1.ShipLoan);
            const activeLoan = await loanRepo.findOne({
                where: { shipId, organizationId, status: ShipLoan_1.LoanStatus.ACTIVE },
                order: { startDate: 'DESC' },
            });
            if (activeLoan) {
                activeLoan.status = ShipLoan_1.LoanStatus.RETURNED;
                activeLoan.actualReturnDate = new Date();
                await loanRepo.save(activeLoan);
                logger_1.logger.info('Org ShipLoan record closed', { loanId: activeLoan.id, shipId });
            }
        }
        catch (err) {
            logger_1.logger.error('Failed to close org ShipLoan record', {
                shipId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        (0, cacheInvalidation_1.invalidateFleetSummaryCache)(organizationId);
        return savedShip;
    }
}
exports.OrganizationShipService = OrganizationShipService;
//# sourceMappingURL=OrganizationShipService.js.map