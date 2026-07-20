"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserShipService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const Ship_1 = require("../../models/Ship");
const ShipLoan_1 = require("../../models/ShipLoan");
const User_1 = require("../../models/User");
const UserShip_1 = require("../../models/UserShip");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
const OrganizationShipService_1 = require("./OrganizationShipService");
const shipServiceHelpers_1 = require("./shipServiceHelpers");
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ALLOWED_SORT_FIELDS = new Set([
    'shipName',
    'customName',
    'status',
    'condition',
    'location',
    'insuranceLevel',
    'insuranceExpires',
    'sharingLevel',
    'createdAt',
    'updatedAt',
    'acquiredDate',
    'flightHours',
    'missionsCompleted',
    'totalEarnings',
]);
function validateSortField(field, defaultField = 'createdAt') {
    if (field && ALLOWED_SORT_FIELDS.has(field)) {
        return field;
    }
    return defaultField;
}
class UserShipService {
    repository;
    shipNameCache = new Map();
    cacheTTL = 5 * 60 * 1000;
    cacheTimestamp = 0;
    constructor() {
        this.repository = data_source_1.AppDataSource.getRepository(UserShip_1.UserShip);
    }
    async resolveShipId(shipName) {
        const now = Date.now();
        if (now - this.cacheTimestamp > this.cacheTTL) {
            this.shipNameCache.clear();
            this.cacheTimestamp = now;
        }
        if (this.shipNameCache.has(shipName)) {
            return this.shipNameCache.get(shipName) ?? undefined;
        }
        try {
            const shipRepo = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
            const catalogueShip = await shipRepo.findOne({
                where: { name: shipName },
            });
            const shipId = catalogueShip?.id ?? null;
            this.shipNameCache.set(shipName, shipId);
            if (shipId) {
                logger_1.logger.info('Resolved ship from catalogue', {
                    shipName,
                    shipId,
                });
            }
            return shipId ?? undefined;
        }
        catch (err) {
            logger_1.logger.warn('Failed to resolve ship from catalogue', {
                shipName,
                error: err instanceof Error ? err.message : String(err),
            });
            return undefined;
        }
    }
    async createUserShip(data) {
        logger_1.logger.info('UserShipService.createUserShip', {
            userId: data.userId,
            shipName: data.shipName,
        });
        let resolvedShipId = data.shipId;
        if (!resolvedShipId && data.shipName) {
            resolvedShipId = await this.resolveShipId(data.shipName);
        }
        const ship = this.repository.create({
            ...data,
            shipId: resolvedShipId || undefined,
            status: data.status || UserShip_1.ShipOwnershipStatus.OWNED,
            condition: data.condition || UserShip_1.ShipCondition.GOOD,
            sharingLevel: data.sharingLevel || UserShip_1.ShipSharingLevel.PRIVATE,
            isActive: true,
            visibleToOrganization: true,
        });
        return this.repository.save(ship);
    }
    async bulkCreateUserShips(userId, shipsData) {
        const MAX_BULK = 200;
        if (shipsData.length > MAX_BULK) {
            throw new Error(`Bulk import limited to ${MAX_BULK} ships per request`);
        }
        const errors = [];
        const entities = [];
        for (const data of shipsData) {
            try {
                let resolvedShipId = data.shipId;
                if (!resolvedShipId && data.shipName) {
                    resolvedShipId = await this.resolveShipId(data.shipName);
                }
                const ship = this.repository.create({
                    ...data,
                    userId,
                    shipId: resolvedShipId || undefined,
                    status: data.status || UserShip_1.ShipOwnershipStatus.OWNED,
                    condition: data.condition || UserShip_1.ShipCondition.GOOD,
                    sharingLevel: data.sharingLevel || UserShip_1.ShipSharingLevel.PRIVATE,
                    isActive: true,
                    visibleToOrganization: true,
                });
                entities.push(ship);
            }
            catch (err) {
                errors.push(`${data.shipName || 'unknown'}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        if (entities.length > 0) {
            await this.repository.save(entities);
        }
        logger_1.logger.info('UserShipService.bulkCreateUserShips', {
            userId,
            requested: shipsData.length,
            created: entities.length,
            failed: errors.length,
        });
        return { created: entities.length, failed: errors.length, errors };
    }
    async getUserShipById(shipId) {
        return this.repository.findOne({ where: { id: shipId } });
    }
    async getUserShips(userId, options) {
        return (0, pagination_1.paginateRepository)(this.repository, options || {}, { userId, isActive: true });
    }
    async findMyShips(userId, filters, options) {
        const query = this.repository
            .createQueryBuilder('ship')
            .where('ship.userId = :userId', { userId })
            .andWhere('ship.isActive = :isActive', { isActive: true });
        if (filters.manufacturer) {
            query.andWhere('ship.manufacturer = :manufacturer', {
                manufacturer: filters.manufacturer,
            });
        }
        if (filters.status) {
            query.andWhere('ship.status = :status', { status: filters.status });
        }
        if (filters.condition) {
            query.andWhere('ship.condition = :condition', { condition: filters.condition });
        }
        if (filters.sharingLevel) {
            query.andWhere('ship.sharingLevel = :sharingLevel', {
                sharingLevel: filters.sharingLevel,
            });
        }
        if (filters.search) {
            query.andWhere('(ship.shipName ILIKE :search OR ship.customName ILIKE :search OR ship.description ILIKE :search OR ship.notes ILIKE :search)', { search: `%${filters.search}%` });
        }
        if (filters.productionStatus) {
            query.leftJoin(Ship_1.Ship, 'catalog', 'catalog.id = ship.shipId').andWhere(new typeorm_1.Brackets(qb => {
                qb.where('catalog.status = :productionStatus', {
                    productionStatus: filters.productionStatus,
                }).orWhere(`ship.shipId IS NULL AND EXISTS (
                SELECT 1 FROM ships s
                WHERE LOWER(s.name) = LOWER(ship."shipName")
                AND s.status = :productionStatus
              )`);
            }));
        }
        const sortField = validateSortField(options.sortField);
        const sortOrder = options.sortOrder ?? 'DESC';
        query.orderBy(`ship.${sortField}`, sortOrder);
        const total = await query.getCount();
        const ships = await query.skip(options.offset).take(options.limit).getMany();
        const enriched = await this.enrichWithCatalogStatus(ships);
        return { data: enriched, total };
    }
    async findPublicShips(targetUserId, requestingUserId, options) {
        const query = this.repository
            .createQueryBuilder('ship')
            .where('ship.userId = :targetUserId', { targetUserId });
        const isOwnProfile = requestingUserId === targetUserId;
        if (!isOwnProfile) {
            query.andWhere('ship.sharingLevel = :sharingLevel', { sharingLevel: 'public' });
        }
        const sortField = validateSortField(options.sortField);
        const sortOrder = options.sortOrder ?? 'DESC';
        query.orderBy(`ship.${sortField}`, sortOrder);
        const total = await query.getCount();
        const ships = await query.skip(options.offset).take(options.limit).getMany();
        const enriched = await this.enrichWithCatalogStatus(ships);
        return { data: enriched, total };
    }
    async findUserShips(organizationId, filters, options) {
        const query = this.repository
            .createQueryBuilder('ship')
            .where('ship.isActive = :isActive', { isActive: true });
        if (filters.userId) {
            query.andWhere('ship.userId = :userId', { userId: filters.userId });
        }
        if (filters.shipId) {
            query.andWhere('ship.shipId = :shipId', { shipId: filters.shipId });
        }
        if (filters.shipName) {
            query.andWhere('ship.shipName ILIKE :shipName', {
                shipName: `%${filters.shipName}%`,
            });
        }
        (0, shipServiceHelpers_1.applyCommonShipFilters)(query, filters);
        if (filters.sharingLevel) {
            if (Array.isArray(filters.sharingLevel)) {
                query.andWhere('ship.sharingLevel IN (:...sharingLevels)', {
                    sharingLevels: filters.sharingLevel,
                });
            }
            else {
                query.andWhere('ship.sharingLevel = :sharingLevel', {
                    sharingLevel: filters.sharingLevel,
                });
            }
        }
        if (filters.accessibleToUser) {
            query.andWhere(new typeorm_1.Brackets(qb => {
                qb.where('ship.userId = :accessibleUserId', {
                    accessibleUserId: filters.accessibleToUser,
                })
                    .orWhere(new typeorm_1.Brackets(subQb => {
                    subQb
                        .where('ship.sharingLevel = :sharedUsersLevel', {
                        sharedUsersLevel: UserShip_1.ShipSharingLevel.SHARED_USERS,
                    })
                        .andWhere(":accessibleUserId = ANY(string_to_array(ship.sharedWithUsers, ','))", {
                        accessibleUserId: filters.accessibleToUser,
                    });
                }))
                    .orWhere('ship.sharingLevel IN (:...sharedLevels)', {
                    sharedLevels: [UserShip_1.ShipSharingLevel.ORGANIZATION, UserShip_1.ShipSharingLevel.ALLIANCE],
                });
            }));
        }
        if (filters.sharedWithOrg) {
            query.andWhere(":sharedOrgId = ANY(string_to_array(ship.sharedWithOrgs, ','))", {
                sharedOrgId: filters.sharedWithOrg,
            });
        }
        if (filters.isLoaned !== undefined) {
            query.andWhere('ship.status = :loanedStatus', {
                loanedStatus: UserShip_1.ShipOwnershipStatus.LOANED,
            });
        }
        if (filters.location) {
            query.andWhere('ship.location = :location', { location: filters.location });
        }
        if (filters.tags && filters.tags.length > 0) {
            query.andWhere('ship.tags && ARRAY[:...tags]::text[]', { tags: filters.tags });
        }
        query.andWhere('ship.isActive = :isActive', { isActive: true });
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const sortBy = validateSortField(options?.sortBy, 'shipName');
        const sortOrder = options?.sortOrder || 'ASC';
        query
            .orderBy(`ship.${sortBy}`, sortOrder)
            .skip((page - 1) * limit)
            .take(limit);
        const [data, total] = await query.getManyAndCount();
        const enrichedData = await this.enrichWithCatalogStatus(data);
        return {
            data: enrichedData,
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
    async updateUserShip(organizationId, shipId, updates) {
        logger_1.logger.info('UserShipService.updateUserShip', { organizationId, shipId });
        const ship = await this.getUserShipById(shipId);
        if (!ship) {
            return null;
        }
        Object.assign(ship, updates);
        return this.repository.save(ship);
    }
    async loanShip(organizationId, shipId, loanedTo, options) {
        const ship = await this.getUserShipById(shipId);
        if (!ship) {
            return null;
        }
        const { expiresAt, scope, startDate, purpose, activityId, activityName } = options ?? {};
        ship.status = UserShip_1.ShipOwnershipStatus.LOANED;
        ship.loanedFrom = ship.userId;
        ship.loanedTo = loanedTo;
        ship.loanExpires = expiresAt;
        if (scope === 'alliance') {
            ship.sharingLevel = UserShip_1.ShipSharingLevel.ALLIANCE;
        }
        else {
            ship.sharingLevel = UserShip_1.ShipSharingLevel.ORGANIZATION;
        }
        const savedShip = await this.repository.save(ship);
        try {
            const loanRepo = data_source_1.AppDataSource.getRepository(ShipLoan_1.ShipLoan);
            const now = new Date();
            const loan = loanRepo.create({
                id: `loan-${Date.now()}`,
                shipId,
                shipName: ship.shipName,
                lenderId: ship.userId,
                borrowerId: loanedTo,
                organizationId: organizationId || undefined,
                activityId,
                activityName,
                scope: scope || 'organization',
                purpose,
                requestDate: now,
                startDate: startDate || now,
                expectedReturnDate: expiresAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                status: ShipLoan_1.LoanStatus.ACTIVE,
            });
            await loanRepo.save(loan);
            logger_1.logger.info('ShipLoan record created', { loanId: loan.id, shipId, activityId });
        }
        catch (err) {
            logger_1.logger.error('Failed to create ShipLoan record', {
                shipId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        return savedShip;
    }
    async returnLoanedShip(organizationId, shipId) {
        const ship = await this.getUserShipById(shipId);
        if (ship?.status !== UserShip_1.ShipOwnershipStatus.LOANED) {
            return null;
        }
        ship.status = UserShip_1.ShipOwnershipStatus.OWNED;
        ship.loanedTo = undefined;
        ship.loanExpires = undefined;
        const savedShip = await this.repository.save(ship);
        try {
            const loanRepo = data_source_1.AppDataSource.getRepository(ShipLoan_1.ShipLoan);
            const activeLoan = await loanRepo.findOne({
                where: { shipId, status: ShipLoan_1.LoanStatus.ACTIVE },
                order: { startDate: 'DESC' },
            });
            if (activeLoan) {
                activeLoan.status = ShipLoan_1.LoanStatus.RETURNED;
                activeLoan.actualReturnDate = new Date();
                await loanRepo.save(activeLoan);
                logger_1.logger.info('ShipLoan record closed', { loanId: activeLoan.id, shipId });
            }
        }
        catch (err) {
            logger_1.logger.error('Failed to close ShipLoan record', {
                shipId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        return savedShip;
    }
    async getShipsNeedingInsurance(userId, daysThreshold = 30) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
        const query = this.repository
            .createQueryBuilder('ship')
            .where('ship.insuranceExpires IS NOT NULL')
            .andWhere('ship.insuranceExpires <= :thresholdDate', { thresholdDate })
            .andWhere('ship.isActive = :isActive', { isActive: true });
        if (userId) {
            query.andWhere('ship.userId = :userId', { userId });
        }
        query.orderBy('ship.insuranceExpires', 'ASC');
        const ships = await query.getMany();
        const now = new Date();
        return ships.map((ship) => {
            const expirationTime = ship.insuranceExpires?.getTime() ?? now.getTime();
            return {
                ship,
                daysUntilExpiration: Math.floor((expirationTime - now.getTime()) / MS_PER_DAY),
            };
        });
    }
    static ALLOWED_SORT_FIELDS = [
        'shipName',
        'customName',
        'status',
        'condition',
        'location',
        'sharingLevel',
        'acquiredDate',
        'createdAt',
        'updatedAt',
    ];
    async getOrgMemberUserIds(organizationId) {
        const memberRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const members = await memberRepo.find({
            where: { organizationId, isActive: true },
            select: ['userId'],
        });
        return members.map(m => m.userId);
    }
    emptyPaginatedResponse(options) {
        return {
            data: [],
            pagination: {
                page: options?.page || 1,
                limit: options?.limit || 20,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
            },
        };
    }
    safeSortBy(sortBy) {
        return sortBy && UserShipService.ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'shipName';
    }
    async getOrgAvailableShips(organizationId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 100;
        const sortBy = this.safeSortBy(options?.sortBy);
        const sortOrder = options?.sortOrder || 'ASC';
        const query = this.repository
            .createQueryBuilder('ship')
            .innerJoin(OrganizationMembership_1.OrganizationMembership, 'm', 'm."userId" = ship."userId" AND m."organizationId" = :orgId AND m."isActive" = true', { orgId: organizationId })
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('ship.sharingLevel IN (:...sharingLevels)', {
            sharingLevels: [
                UserShip_1.ShipSharingLevel.ORGANIZATION,
                UserShip_1.ShipSharingLevel.ALLIANCE,
                UserShip_1.ShipSharingLevel.PUBLIC,
            ],
        })
            .andWhere('ship.status IN (:...statuses)', {
            statuses: [
                UserShip_1.ShipOwnershipStatus.OWNED,
                UserShip_1.ShipOwnershipStatus.PLEDGED,
                UserShip_1.ShipOwnershipStatus.GIFTED,
            ],
        })
            .orderBy(`ship.${sortBy}`, sortOrder)
            .skip((page - 1) * limit)
            .take(limit);
        const [ships, total] = await query.getManyAndCount();
        const ownerIds = [...new Set(ships.map(s => s.userId))];
        const ownerMap = new Map();
        if (ownerIds.length > 0) {
            const userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
            const users = await userRepo
                .createQueryBuilder('u')
                .select(['u.id', 'u.username'])
                .where('u.id IN (:...ownerIds)', { ownerIds })
                .getMany();
            for (const u of users) {
                ownerMap.set(u.id, u.username);
            }
        }
        const data = ships.map(ship => Object.assign(ship, { ownerName: ownerMap.get(ship.userId) }));
        return {
            data: await (0, OrganizationShipService_1.attachCatalogueMetadata)(data),
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
    async getUserShipSummary(organizationId, userId) {
        const statusRows = await this.repository
            .createQueryBuilder('s')
            .select('s.status', 'key')
            .addSelect('COUNT(*)::int', 'count')
            .where('s.userId = :userId', { userId })
            .andWhere('s.isActive = :isActive', { isActive: true })
            .groupBy('s.status')
            .getRawMany();
        const conditionRows = await this.repository
            .createQueryBuilder('s')
            .select('s.condition', 'key')
            .addSelect('COUNT(*)::int', 'count')
            .where('s.userId = :userId', { userId })
            .andWhere('s.isActive = :isActive', { isActive: true })
            .groupBy('s.condition')
            .getRawMany();
        const sharingRows = await this.repository
            .createQueryBuilder('s')
            .select('s.sharingLevel', 'key')
            .addSelect('COUNT(*)::int', 'count')
            .where('s.userId = :userId', { userId })
            .andWhere('s.isActive = :isActive', { isActive: true })
            .groupBy('s.sharingLevel')
            .getRawMany();
        const totals = await this.repository
            .createQueryBuilder('s')
            .select('COUNT(*)::int', 'totalShips')
            .addSelect('COALESCE(SUM(s.acquiredPrice), 0)', 'totalValue')
            .addSelect(`COALESCE(SUM(CASE WHEN s.insuranceExpires IS NOT NULL AND s.insuranceExpires <= NOW() + INTERVAL '30 days' THEN 1 ELSE 0 END), 0)::int`, 'needsInsurance')
            .where('s.userId = :userId', { userId })
            .andWhere('s.isActive = :isActive', { isActive: true })
            .getRawOne();
        const summary = {
            totalShips: totals?.totalShips ?? 0,
            byStatus: Object.fromEntries(statusRows.map(r => [r.key, r.count])),
            byCondition: Object.fromEntries(conditionRows.map(r => [r.key, r.count])),
            bySharingLevel: Object.fromEntries(sharingRows.map(r => [r.key, r.count])),
            bySize: {},
            byRole: {},
            byCareer: {},
            byManufacturer: {},
            totalValue: Number(totals?.totalValue ?? 0),
            needsInsurance: totals?.needsInsurance ?? 0,
        };
        const ships = await this.repository.find({
            where: { userId, isActive: true },
            select: ['shipId', 'shipName'],
        });
        const shipCatalogRepo = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
        const shipsWithId = ships.filter((s) => !!s.shipId);
        const nameOnlyShips = ships.filter(s => !s.shipId);
        if (shipsWithId.length > 0) {
            const uniqueIds = [...new Set(shipsWithId.map(s => s.shipId))];
            const catalogById = await shipCatalogRepo
                .createQueryBuilder('s')
                .select(['s.id', 's.size', 's.role', 's.career', 's.manufacturer'])
                .where('s.id IN (:...ids)', { ids: uniqueIds })
                .getMany();
            const catalogMap = new Map(catalogById.map(c => [c.id, c]));
            for (const ship of shipsWithId) {
                this.incrementCatalogBreakdown(summary, catalogMap.get(ship.shipId));
            }
        }
        if (nameOnlyShips.length > 0) {
            const names = [...new Set(nameOnlyShips.map(s => s.shipName.toLowerCase()))];
            const catalogByName = await shipCatalogRepo
                .createQueryBuilder('s')
                .select(['s.id', 's.name', 's.size', 's.role', 's.career', 's.manufacturer'])
                .where('LOWER(s.name) IN (:...names)', { names })
                .getMany();
            const catalogMap = new Map(catalogByName.map(c => [c.name.toLowerCase(), c]));
            for (const ship of nameOnlyShips) {
                const cat = catalogMap.get(ship.shipName.toLowerCase());
                this.incrementCatalogBreakdown(summary, cat);
            }
        }
        return summary;
    }
    async enrichWithCatalogStatus(ships) {
        if (ships.length === 0) {
            return ships;
        }
        const shipCatalogRepo = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
        const shipsWithId = ships.filter((s) => !!s.shipId);
        const nameOnlyShips = ships.filter(s => !s.shipId);
        const catalogMap = new Map();
        if (shipsWithId.length > 0) {
            const uniqueIds = [...new Set(shipsWithId.map(s => s.shipId))];
            const catalog = await shipCatalogRepo
                .createQueryBuilder('s')
                .select(['s.id', 's.status', 's.manufacturer'])
                .where('s.id IN (:...ids)', { ids: uniqueIds })
                .getMany();
            for (const c of catalog) {
                catalogMap.set(`id:${c.id}`, {
                    status: c.status ?? '',
                    manufacturer: c.manufacturer ?? '',
                });
            }
        }
        if (nameOnlyShips.length > 0) {
            const names = [...new Set(nameOnlyShips.map(s => s.shipName.toLowerCase()))];
            const catalog = await shipCatalogRepo
                .createQueryBuilder('s')
                .select(['s.id', 's.name', 's.status', 's.manufacturer'])
                .where('LOWER(s.name) IN (:...names)', { names })
                .getMany();
            for (const c of catalog) {
                catalogMap.set(`name:${c.name.toLowerCase()}`, {
                    status: c.status ?? '',
                    manufacturer: c.manufacturer ?? '',
                });
            }
        }
        return ships.map(ship => {
            const key = ship.shipId ? `id:${ship.shipId}` : `name:${ship.shipName.toLowerCase()}`;
            const catalogEntry = catalogMap.get(key);
            return Object.assign(ship, {
                productionStatus: catalogEntry?.status ?? undefined,
                manufacturer: catalogEntry?.manufacturer ?? undefined,
            });
        });
    }
    incrementCatalogBreakdown(summary, catalog) {
        if (!catalog) {
            return;
        }
        if (catalog.size) {
            summary.bySize[catalog.size] = (summary.bySize[catalog.size] ?? 0) + 1;
        }
        if (catalog.role) {
            summary.byRole[catalog.role] = (summary.byRole[catalog.role] ?? 0) + 1;
        }
        if (catalog.career) {
            summary.byCareer[catalog.career] = (summary.byCareer[catalog.career] ?? 0) + 1;
        }
        if (catalog.manufacturer) {
            summary.byManufacturer[catalog.manufacturer] =
                (summary.byManufacturer[catalog.manufacturer] ?? 0) + 1;
        }
    }
    async deleteUserShip(organizationId, shipId) {
        const ship = await this.getUserShipById(shipId);
        if (!ship) {
            return false;
        }
        ship.isActive = false;
        await this.repository.softRemove(ship);
        return true;
    }
    async bulkDeleteAllUserShips(userId) {
        const ships = await this.repository.find({ where: { userId, isActive: true } });
        if (ships.length === 0) {
            logger_1.logger.info('UserShipService.bulkDeleteAllUserShips', { userId, deleted: 0 });
            return 0;
        }
        for (const ship of ships) {
            ship.isActive = false;
        }
        await this.repository.softRemove(ships);
        logger_1.logger.info('UserShipService.bulkDeleteAllUserShips', {
            userId,
            deleted: ships.length,
        });
        return ships.length;
    }
    async updateSharingLevel(organizationId, shipId, sharingLevel, sharedWithUsers) {
        logger_1.logger.info('UserShipService.updateSharingLevel', {
            organizationId,
            shipId,
            sharingLevel,
        });
        const ship = await this.getUserShipById(shipId);
        if (!ship) {
            return null;
        }
        ship.sharingLevel = sharingLevel;
        if (sharedWithUsers !== undefined) {
            ship.sharedWithUsers = sharedWithUsers;
        }
        if (sharingLevel !== UserShip_1.ShipSharingLevel.SHARED_USERS) {
            ship.sharedWithUsers = undefined;
        }
        return this.repository.save(ship);
    }
    async shareWithUsers(organizationId, shipId, userIds) {
        logger_1.logger.info('UserShipService.shareWithUsers', {
            organizationId,
            shipId,
            userCount: userIds.length,
        });
        const ship = await this.getUserShipById(shipId);
        if (!ship) {
            return null;
        }
        ship.sharingLevel = UserShip_1.ShipSharingLevel.SHARED_USERS;
        const existingUsers = ship.sharedWithUsers || [];
        ship.sharedWithUsers = [...new Set([...existingUsers, ...userIds])];
        return this.repository.save(ship);
    }
    async unshareFromUser(organizationId, shipId, userId) {
        const ship = await this.getUserShipById(shipId);
        if (!ship) {
            return null;
        }
        ship.sharedWithUsers = (ship.sharedWithUsers || []).filter(id => id !== userId);
        if (ship.sharedWithUsers.length === 0 && ship.sharingLevel === UserShip_1.ShipSharingLevel.SHARED_USERS) {
            ship.sharingLevel = UserShip_1.ShipSharingLevel.PRIVATE;
        }
        return this.repository.save(ship);
    }
    async shareWithOrganizations(shipId, targetOrgIds) {
        logger_1.logger.info('UserShipService.shareWithOrganizations', {
            shipId,
            orgCount: targetOrgIds.length,
        });
        const ship = await this.getUserShipById(shipId);
        if (!ship) {
            return null;
        }
        ship.visibleToOrganization = true;
        return this.repository.save(ship);
    }
    async getShipsSharedWithOrg(userIds, options) {
        if (userIds.length === 0) {
            return this.emptyPaginatedResponse(options);
        }
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const sortBy = this.safeSortBy(options?.sortBy);
        const sortOrder = options?.sortOrder || 'ASC';
        const query = this.repository
            .createQueryBuilder('ship')
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('ship.userId IN (:...userIds)', { userIds })
            .andWhere('ship.visibleToOrganization = :visible', { visible: true })
            .orderBy(`ship.${sortBy}`, sortOrder)
            .skip((page - 1) * limit)
            .take(limit);
        const [data, total] = await query.getManyAndCount();
        return {
            data,
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
    async getAccessibleShips(userId, options) {
        return (0, pagination_1.paginateRepository)(this.repository, options || {}, { userId, isActive: true });
    }
    async getAllianceSharedShips(organizationId, options) {
        const memberUserIds = await this.getOrgMemberUserIds(organizationId);
        if (memberUserIds.length === 0) {
            return this.emptyPaginatedResponse(options);
        }
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const sortBy = this.safeSortBy(options?.sortBy);
        const sortOrder = options?.sortOrder || 'ASC';
        const query = this.repository
            .createQueryBuilder('ship')
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('ship.userId IN (:...memberUserIds)', { memberUserIds })
            .andWhere('ship.sharingLevel = :sharingLevel', {
            sharingLevel: UserShip_1.ShipSharingLevel.ALLIANCE,
        })
            .orderBy(`ship.${sortBy}`, sortOrder)
            .skip((page - 1) * limit)
            .take(limit);
        const [data, total] = await query.getManyAndCount();
        return {
            data,
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
    async updateErkulLoadoutUrl(organizationId, shipId, erkulLoadoutUrl) {
        logger_1.logger.info('UserShipService.updateErkulLoadoutUrl', {
            shipId,
        });
        const ship = await this.getUserShipById(shipId);
        if (!ship) {
            return null;
        }
        ship.erkulLoadoutUrl = erkulLoadoutUrl;
        return this.repository.save(ship);
    }
    async getOrgFleetSummary(organizationId) {
        const memberUserIds = await this.getOrgMemberUserIds(organizationId);
        if (memberUserIds.length === 0) {
            return {
                totalShips: 0,
                byStatus: {},
                byCondition: {},
                bySharingLevel: {},
                totalValue: 0,
                sharedWithOrg: 0,
                sharedWithAlliance: 0,
            };
        }
        const ships = await this.repository
            .createQueryBuilder('ship')
            .where('ship.isActive = :isActive', { isActive: true })
            .andWhere('ship.userId IN (:...memberUserIds)', { memberUserIds })
            .getMany();
        const summary = {
            totalShips: ships.length,
            byStatus: {},
            byCondition: {},
            bySharingLevel: {},
            totalValue: 0,
            sharedWithOrg: 0,
            sharedWithAlliance: 0,
        };
        ships.forEach((ship) => {
            summary.byStatus[ship.status] = (summary.byStatus[ship.status] || 0) + 1;
            summary.byCondition[ship.condition] = (summary.byCondition[ship.condition] || 0) + 1;
            summary.bySharingLevel[ship.sharingLevel] =
                (summary.bySharingLevel[ship.sharingLevel] || 0) + 1;
            if (ship.acquiredPrice) {
                summary.totalValue += Number(ship.acquiredPrice);
            }
            if (ship.isSharedWithOrg()) {
                summary.sharedWithOrg++;
            }
            if (ship.isSharedWithAlliance()) {
                summary.sharedWithAlliance++;
            }
        });
        return summary;
    }
}
exports.UserShipService = UserShipService;
//# sourceMappingURL=UserShipService.js.map