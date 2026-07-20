"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const FleetShip_1 = require("../../models/FleetShip");
const Ship_1 = require("../../models/Ship");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
const fullTextSearch_1 = require("../../utils/query/fullTextSearch");
const TenantService_1 = require("../base/TenantService");
const FleetAuditLogger_1 = require("./FleetAuditLogger");
const FleetTeamService_1 = require("./FleetTeamService");
class FleetService extends TenantService_1.TenantService {
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Fleet_1.Fleet), {
            enableCache: true,
            cacheTTL: 600,
            cacheCheckPeriod: 120,
        });
    }
    static VALID_FLEET_TYPES = Object.values(Fleet_1.FleetType);
    async createFleet(organizationId, fleetData) {
        const { name, description, type, members = [], ...rest } = fleetData;
        if (!name?.trim()) {
            throw new apiErrors_1.ValidationError('Fleet name is required');
        }
        logger_1.logger.info('FleetService.createFleet', { organizationId, fleetName: name });
        const existing = await this.repository.findOne({
            where: { organizationId, name },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('A fleet with this name already exists');
        }
        const fleetType = type && FleetService.VALID_FLEET_TYPES.includes(type)
            ? type
            : Fleet_1.FleetType.MIXED;
        const fleet = this.repository.create({
            id: node_crypto_1.default.randomUUID(),
            shipIds: [],
            tags: [],
            allowedOrganizations: [],
            ...rest,
            name,
            description: description || undefined,
            type: fleetType,
            members,
            organizationId,
        });
        return this.repository.save(fleet);
    }
    async postCreateFleet(organizationId, fleet) {
        FleetAuditLogger_1.fleetAuditLogger.log({
            action: FleetAuditLogger_1.FleetAuditAction.FLEET_CREATED,
            fleetId: fleet.id,
            fleetName: fleet.name,
            organizationId,
            details: { type: fleet.type },
        });
        const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
        return fleetTeamService.autoCreateTeamForFleet(organizationId, fleet);
    }
    async getFleetById(organizationId, fleetId, options) {
        logger_1.logger.debug('FleetService.getFleetById', { organizationId, fleetId });
        return this.findById(organizationId, fleetId, options);
    }
    async getFleets(organizationId, options) {
        logger_1.logger.debug('FleetService.getFleets', { organizationId });
        return (0, pagination_1.paginateRepository)(this.repository, options || {}, { organizationId }, 'name');
    }
    async getAllFleets(organizationId, options) {
        logger_1.logger.debug('FleetService.getAllFleets', { organizationId });
        return this.findAll(organizationId, options);
    }
    async getFleetSnapshot(organizationId) {
        const fleets = await this.getAllFleets(organizationId, {
            order: { name: 'ASC' },
        });
        if (fleets.length === 0 || !data_source_1.AppDataSource.isInitialized) {
            return {
                fleets,
                shipCounts: new Map(),
            };
        }
        const fleetIds = fleets.map(fleet => fleet.id);
        const rows = await data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip)
            .createQueryBuilder('fs')
            .select('fs.fleetId', 'fleetId')
            .addSelect('COUNT(fs.shipId)', 'count')
            .where('fs.organizationId = :organizationId', { organizationId })
            .andWhere('fs.fleetId IN (:...fleetIds)', { fleetIds })
            .groupBy('fs.fleetId')
            .getRawMany();
        const shipCounts = new Map(rows.map(row => [row.fleetId, Number(row.count)]));
        return { fleets, shipCounts };
    }
    async updateFleet(organizationId, fleetId, updates) {
        logger_1.logger.info('FleetService.updateFleet', { organizationId, fleetId });
        return this.update(organizationId, fleetId, updates);
    }
    async deleteFleet(organizationId, fleetId) {
        logger_1.logger.info('FleetService.deleteFleet', { organizationId, fleetId });
        const fleet = await this.findById(organizationId, fleetId);
        if (fleet) {
            FleetAuditLogger_1.fleetAuditLogger.log({
                action: FleetAuditLogger_1.FleetAuditAction.FLEET_DELETED,
                fleetId,
                fleetName: fleet.name,
                organizationId,
                details: {},
            });
        }
        await this.delete(organizationId, fleetId);
    }
    async addShipToFleet(organizationId, fleetId, shipId, options = {}) {
        logger_1.logger.info('FleetService.addShipToFleet', { organizationId, fleetId, shipId });
        const fleet = await this.findById(organizationId, fleetId);
        if (!fleet) {
            throw new apiErrors_1.FleetNotFoundError(fleetId);
        }
        const shipRepo = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
        const ship = await shipRepo.findOne({ where: { id: shipId } });
        if (!ship) {
            throw new apiErrors_1.ShipNotFoundError(shipId);
        }
        if (ship.organizationId !== fleet.organizationId) {
            throw new apiErrors_1.ValidationError('Ship does not belong to the same organization as the fleet');
        }
        const fleetShipRepo = data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const existingAssignment = await fleetShipRepo.findOne({
            where: { fleetId, shipId },
        });
        if (existingAssignment) {
            throw new apiErrors_1.ConflictError('Ship is already assigned to this fleet');
        }
        const fleetShip = fleetShipRepo.create({
            fleetId,
            shipId,
            organizationId: fleet.organizationId,
            role: options.role,
            notes: options.notes,
            assignedBy: options.performedById,
        });
        await fleetShipRepo.save(fleetShip);
        const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
        if (!fleet.teamId) {
            await fleetTeamService.autoCreateTeamForFleet(organizationId, fleet);
        }
        await fleetTeamService.syncTeamCapacity(organizationId, fleetId);
        FleetAuditLogger_1.fleetAuditLogger.logShipAdded(organizationId, fleetId, fleet.name, shipId, ship.name, options.performedById);
        return { fleet, fleetShip, ship };
    }
    async removeShipFromFleet(organizationId, fleetId, shipId, options = {}) {
        logger_1.logger.info('FleetService.removeShipFromFleet', { organizationId, fleetId, shipId });
        const fleet = await this.findById(organizationId, fleetId);
        if (!fleet) {
            throw new apiErrors_1.FleetNotFoundError(fleetId);
        }
        const fleetShipRepo = data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const assignment = await fleetShipRepo.findOne({
            where: { fleetId, shipId },
        });
        if (!assignment) {
            throw new apiErrors_1.ShipNotFoundError(shipId);
        }
        const shipRepo = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
        const ship = await shipRepo.findOne({ where: { id: shipId } });
        const shipName = ship?.name ?? shipId;
        await fleetShipRepo.remove(assignment);
        const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
        await fleetTeamService.syncTeamCapacity(organizationId, fleetId);
        FleetAuditLogger_1.fleetAuditLogger.logShipRemoved({
            organizationId,
            fleetId,
            fleetName: fleet.name,
            shipId,
            shipName,
            performedById: options.performedById,
        });
        return { fleet };
    }
    async addShipIdsToFleet(organizationId, fleetId, shipIdsToAdd) {
        logger_1.logger.info('FleetService.addShipIdsToFleet', {
            organizationId,
            fleetId,
            count: shipIdsToAdd.length,
        });
        const fleet = await this.withEntityLock(fleetId, async (locked, queryRunner) => {
            if (locked.organizationId !== organizationId) {
                throw new apiErrors_1.FleetNotFoundError(fleetId);
            }
            const existing = locked.shipIds ?? [];
            const merged = [...new Set([...existing, ...shipIdsToAdd])];
            if (merged.length !== existing.length) {
                locked.shipIds = merged;
                await queryRunner.manager.getRepository(Fleet_1.Fleet).save(locked);
            }
            return locked;
        }, { onNotFound: () => new apiErrors_1.FleetNotFoundError(fleetId) });
        this.invalidateCache(this.getCacheKey(organizationId, fleetId));
        return fleet;
    }
    async removeShipIdsFromFleet(organizationId, fleetId, shipIdsToRemove) {
        logger_1.logger.info('FleetService.removeShipIdsFromFleet', {
            organizationId,
            fleetId,
            count: shipIdsToRemove.length,
        });
        const removalSet = new Set(shipIdsToRemove);
        const fleet = await this.withEntityLock(fleetId, async (locked, queryRunner) => {
            if (locked.organizationId !== organizationId) {
                throw new apiErrors_1.FleetNotFoundError(fleetId);
            }
            const existing = locked.shipIds ?? [];
            const filtered = existing.filter(id => !removalSet.has(id));
            if (filtered.length !== existing.length) {
                locked.shipIds = filtered;
                await queryRunner.manager.getRepository(Fleet_1.Fleet).save(locked);
            }
            return locked;
        }, { onNotFound: () => new apiErrors_1.FleetNotFoundError(fleetId) });
        this.invalidateCache(this.getCacheKey(organizationId, fleetId));
        return fleet;
    }
    async searchFleetsByName(organizationId, searchTerm) {
        logger_1.logger.debug('FleetService.searchFleetsByName', { organizationId, searchTerm });
        const qb = this.repository
            .createQueryBuilder('fleet')
            .where('fleet.organizationId = :organizationId', { organizationId });
        (0, fullTextSearch_1.addFullTextSearch)(qb, 'fleet', searchTerm, ['name']);
        qb.addOrderBy('fleet.name', 'ASC');
        const fleets = await qb.getMany();
        return fleets;
    }
    async getFleetCount(organizationId) {
        logger_1.logger.debug('FleetService.getFleetCount', { organizationId });
        return this.repository.count({
            where: { organizationId },
        });
    }
    async getSharedFleets(organizationId) {
        logger_1.logger.debug('FleetService.getSharedFleets', { organizationId });
        return this.findAllIncludingShared(organizationId);
    }
    async getSharedFleetsPaginated(organizationId, options) {
        const limit = Math.min(Math.max(Math.trunc(options.limit), 1), 100);
        const offset = Math.max(Math.trunc(options.offset), 0);
        logger_1.logger.debug('FleetService.getSharedFleetsPaginated', {
            organizationId,
            limit,
            offset,
        });
        const query = this.repository
            .createQueryBuilder('fleet')
            .where('fleet.organizationId = :organizationId', { organizationId })
            .orWhere(':organizationId = ANY(fleet.sharedWithOrgs)', { organizationId })
            .orderBy('fleet.name', 'ASC')
            .skip(offset)
            .take(limit);
        const [data, total] = await query.getManyAndCount();
        return {
            data,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + data.length < total,
            },
        };
    }
    async shareFleetWith(organizationId, fleetId, targetOrganizationId) {
        return this.shareFleetWithMany(organizationId, fleetId, [targetOrganizationId]);
    }
    async shareFleetWithMany(organizationId, fleetId, targetOrganizationIds) {
        const normalizedTargets = this.normalizeTargetOrganizationIds(organizationId, targetOrganizationIds);
        logger_1.logger.info('FleetService.shareFleetWithMany', {
            organizationId,
            fleetId,
            targetCount: normalizedTargets.length,
        });
        if (normalizedTargets.length === 0) {
            return this.getFleetById(organizationId, fleetId);
        }
        return this.shareWith(organizationId, fleetId, normalizedTargets);
    }
    async unshareFleetWith(organizationId, fleetId, targetOrganizationId) {
        return this.unshareFleetWithMany(organizationId, fleetId, [targetOrganizationId]);
    }
    async unshareFleetWithMany(organizationId, fleetId, targetOrganizationIds) {
        const normalizedTargets = this.normalizeTargetOrganizationIds(organizationId, targetOrganizationIds);
        logger_1.logger.info('FleetService.unshareFleetWithMany', {
            organizationId,
            fleetId,
            targetCount: normalizedTargets.length,
        });
        if (normalizedTargets.length === 0) {
            return this.getFleetById(organizationId, fleetId);
        }
        return this.unshareWith(organizationId, fleetId, normalizedTargets);
    }
    normalizeTargetOrganizationIds(organizationId, targetOrganizationIds) {
        const normalized = targetOrganizationIds
            .map(id => id.trim())
            .filter(id => id.length > 0 && id !== organizationId);
        return [...new Set(normalized)];
    }
    async isFleetOwnedBy(organizationId, fleetId) {
        const fleet = await this.getFleetById(organizationId, fleetId);
        return fleet !== null && fleet.organizationId === organizationId;
    }
    async getFleetStatistics(organizationId) {
        logger_1.logger.debug('FleetService.getFleetStatistics', { organizationId });
        const [ownedFleets, sharedFleets] = await Promise.all([
            this.getAllFleets(organizationId),
            this.getSharedFleets(organizationId),
        ]);
        return {
            totalFleets: ownedFleets.length,
            sharedFleets: sharedFleets.length,
            fleetsWithMembers: ownedFleets.map(f => f.members?.length || 0),
        };
    }
    async bulkCreateFleets(organizationId, fleetsData) {
        if (fleetsData.length === 0) {
            throw new apiErrors_1.ValidationError('No fleet data provided for bulk create');
        }
        if (fleetsData.length > 100) {
            throw new apiErrors_1.ValidationError('Cannot create more than 100 fleets in a single bulk operation');
        }
        const result = {
            successful: [],
            failed: [],
            totalProcessed: fleetsData.length,
            successCount: 0,
            failureCount: 0,
        };
        try {
            const created = await this.withTransaction(async (queryRunner) => {
                const saved = [];
                for (const fleetData of fleetsData) {
                    const fleet = this.repository.create({
                        ...fleetData,
                        organizationId,
                    });
                    saved.push(await queryRunner.manager.save(fleet));
                }
                return saved;
            });
            result.successful = created;
            result.successCount = created.length;
            logger_1.logger.info(`Bulk created ${result.successCount} fleets`, { organizationId });
        }
        catch (error) {
            logger_1.logger.error('Bulk create fleets failed, transaction rolled back', {
                error,
                organizationId,
                count: fleetsData.length,
            });
            result.failureCount = fleetsData.length;
            const primaryError = error instanceof Error ? error.message : 'Transaction failed';
            result.failed = fleetsData.map((fd, i) => ({
                id: fd.id,
                error: i === 0 ? primaryError : 'Rolled back due to earlier failure',
            }));
        }
        return result;
    }
    async bulkUpdateFleets(organizationId, updates) {
        if (updates.length === 0) {
            throw new apiErrors_1.ValidationError('No updates provided for bulk update');
        }
        if (updates.length > 100) {
            throw new apiErrors_1.ValidationError('Cannot update more than 100 fleets in a single bulk operation');
        }
        const result = {
            successful: [],
            failed: [],
            totalProcessed: updates.length,
            successCount: 0,
            failureCount: 0,
        };
        try {
            const updated = await this.withTransaction(async (queryRunner) => {
                const saved = [];
                for (const { id, data } of updates) {
                    const fleet = await queryRunner.manager.findOne(Fleet_1.Fleet, {
                        where: { id, organizationId },
                    });
                    if (!fleet) {
                        throw new Error(`Fleet ${id} not found or not accessible`);
                    }
                    Object.assign(fleet, data);
                    saved.push(await queryRunner.manager.save(fleet));
                }
                return saved;
            });
            result.successful = updated;
            result.successCount = updated.length;
            logger_1.logger.info(`Bulk updated ${result.successCount} fleets`, { organizationId });
        }
        catch (error) {
            logger_1.logger.error('Bulk update fleets failed, transaction rolled back', {
                error,
                organizationId,
                count: updates.length,
            });
            result.failureCount = updates.length;
            const primaryError = error instanceof Error ? error.message : 'Transaction failed';
            result.failed = updates.map((u, i) => ({
                id: u.id,
                error: i === 0 ? primaryError : 'Rolled back due to earlier failure',
            }));
        }
        return result;
    }
    async bulkDeleteFleets(organizationId, fleetIds) {
        if (fleetIds.length === 0) {
            throw new apiErrors_1.ValidationError('No fleet IDs provided for bulk delete');
        }
        if (fleetIds.length > 100) {
            throw new apiErrors_1.ValidationError('Cannot delete more than 100 fleets in a single bulk operation');
        }
        try {
            const deletedCount = await this.withTransaction(async (queryRunner) => {
                const fleets = await queryRunner.manager.find(Fleet_1.Fleet, {
                    where: {
                        id: (0, typeorm_1.In)(fleetIds),
                        organizationId,
                    },
                });
                if (fleets.length !== fleetIds.length) {
                    const foundIds = new Set(fleets.map(f => f.id));
                    const missingIds = fleetIds.filter(id => !foundIds.has(id));
                    throw new Error(`Fleets not found or not accessible: ${missingIds.join(', ')}`);
                }
                await queryRunner.manager.delete(Fleet_1.Fleet, {
                    id: (0, typeorm_1.In)(fleetIds),
                    organizationId,
                });
                return fleetIds.length;
            });
            logger_1.logger.info(`Bulk deleted ${deletedCount} fleets`, { organizationId });
            return { deletedCount, errors: [] };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
            logger_1.logger.error('Bulk delete fleets failed, transaction rolled back', {
                error,
                organizationId,
                count: fleetIds.length,
            });
            return { deletedCount: 0, errors: [errorMessage] };
        }
    }
    async bulkShareFleets(organizationId, fleetIds, targetOrganizationId) {
        if (fleetIds.length === 0) {
            throw new apiErrors_1.ValidationError('No fleet IDs provided for bulk share');
        }
        if (fleetIds.length > 100) {
            throw new apiErrors_1.ValidationError('Cannot share more than 100 fleets in a single bulk operation');
        }
        const result = {
            successful: [],
            failed: [],
            totalProcessed: fleetIds.length,
            successCount: 0,
            failureCount: 0,
        };
        try {
            const shared = await this.withTransaction(async (queryRunner) => {
                const results = [];
                for (const fleetId of fleetIds) {
                    const fleet = await queryRunner.manager.findOne(Fleet_1.Fleet, {
                        where: { id: fleetId, organizationId },
                    });
                    if (!fleet) {
                        throw new Error(`Fleet ${fleetId} not found or not accessible`);
                    }
                    const sharedWithOrgs = fleet.sharedWithOrgs || [];
                    if (sharedWithOrgs.includes(targetOrganizationId)) {
                        results.push(fleet);
                    }
                    else {
                        fleet.sharedWithOrgs = [...sharedWithOrgs, targetOrganizationId];
                        results.push(await queryRunner.manager.save(fleet));
                    }
                }
                return results;
            });
            result.successful = shared;
            result.successCount = shared.length;
            logger_1.logger.info(`Bulk shared ${result.successCount} fleets with ${targetOrganizationId}`, {
                organizationId,
            });
        }
        catch (error) {
            logger_1.logger.error('Bulk share fleets failed, transaction rolled back', {
                error,
                organizationId,
                targetOrganizationId,
                count: fleetIds.length,
            });
            result.failureCount = fleetIds.length;
            const primaryError = error instanceof Error ? error.message : 'Transaction failed';
            result.failed = fleetIds.map((id, i) => ({
                id,
                error: i === 0 ? primaryError : 'Rolled back due to earlier failure',
            }));
        }
        return result;
    }
    async getFleetTree(organizationId) {
        logger_1.logger.debug('FleetService.getFleetTree', { organizationId });
        const allFleets = await this.repository
            .createQueryBuilder('fleet')
            .where('fleet.organizationId = :organizationId', { organizationId })
            .orderBy('fleet.level', 'ASC')
            .addOrderBy('fleet.sortOrder', 'ASC')
            .addOrderBy('fleet.name', 'ASC')
            .getMany();
        await this.batchLoadShipCounts(allFleets);
        return this.buildFleetTree(allFleets);
    }
    async batchLoadShipCounts(fleets) {
        const fleetIds = fleets.map(f => f.id);
        if (fleetIds.length === 0) {
            return;
        }
        try {
            const rows = await data_source_1.AppDataSource.query(`SELECT "fleetId", COUNT(*)::int AS "count"
         FROM fleet_ships
         WHERE "fleetId" = ANY($1)
         GROUP BY "fleetId"`, [fleetIds]);
            for (const row of rows) {
                const fleet = fleets.find(f => f.id === row.fleetId);
                if (fleet) {
                    fleet.shipCount = row.count;
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error loading ship counts for fleet tree:', error);
        }
    }
    buildFleetTree(allFleets) {
        const fleetMap = new Map();
        const roots = [];
        for (const fleet of allFleets) {
            const enriched = (0, Fleet_1.enrichFleetCounts)(fleet);
            const node = Object.assign(fleet, {
                children: [],
                shipCount: enriched.shipCount,
                memberCount: enriched.memberCount,
            });
            fleetMap.set(fleet.id, node);
        }
        for (const fleet of allFleets) {
            const node = fleetMap.get(fleet.id);
            if (!node) {
                continue;
            }
            const parent = fleet.parentFleetId ? fleetMap.get(fleet.parentFleetId) : undefined;
            if (parent) {
                parent.children.push(node);
            }
            else {
                roots.push(node);
            }
        }
        return roots;
    }
    async validateMoveTarget(organizationId, fleetId, newParentId) {
        if (newParentId === fleetId) {
            throw new apiErrors_1.ValidationError('Cannot move a fleet under itself');
        }
        const parent = await this.findById(organizationId, newParentId);
        if (!parent) {
            throw new apiErrors_1.NotFoundError('Target parent fleet');
        }
        if (await this.isDescendantOf(organizationId, newParentId, fleetId)) {
            throw new apiErrors_1.ValidationError('Cannot move fleet under its own descendant');
        }
        if (parent.level >= 4) {
            throw new apiErrors_1.ValidationError('Maximum nesting depth of 5 levels exceeded');
        }
        return {
            parentLevel: parent.level,
            parentPath: parent.hierarchyPath || parent.id,
        };
    }
    async moveFleet(organizationId, fleetId, newParentId) {
        logger_1.logger.info('FleetService.moveFleet', { organizationId, fleetId, newParentId });
        const fleet = await this.findById(organizationId, fleetId);
        if (!fleet) {
            throw new apiErrors_1.FleetNotFoundError();
        }
        if ((fleet.parentFleetId || null) === newParentId) {
            return fleet;
        }
        const previousParentId = fleet.parentFleetId || null;
        let previousParent = null;
        if (previousParentId) {
            previousParent = await this.findById(organizationId, previousParentId);
        }
        let parentLevel = -1;
        let parentPath = '';
        if (newParentId) {
            const target = await this.validateMoveTarget(organizationId, fleetId, newParentId);
            parentLevel = target.parentLevel;
            parentPath = target.parentPath;
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            fleet.parentFleetId = newParentId || undefined;
            fleet.level = parentLevel + 1;
            fleet.hierarchyPath = newParentId ? `${parentPath}.${fleet.id}` : fleet.id;
            const maxSortResult = await queryRunner.manager
                .createQueryBuilder(Fleet_1.Fleet, 'f')
                .where('f.organizationId = :organizationId', { organizationId })
                .andWhere(newParentId ? 'f.parentFleetId = :parentId' : 'f.parentFleetId IS NULL', {
                parentId: newParentId,
            })
                .andWhere('f.id != :fleetId', { fleetId })
                .select('MAX(f.sortOrder)', 'max')
                .getRawOne();
            fleet.sortOrder = (maxSortResult?.max ?? -1) + 1;
            await queryRunner.manager.save(fleet);
            await this.updateDescendantPaths(queryRunner, organizationId, fleet);
            await queryRunner.commitTransaction();
            logger_1.logger.info('Fleet moved successfully', { fleetId, newParentId, newLevel: fleet.level });
            if (newParentId) {
                const parentFleet = await this.findById(organizationId, newParentId);
                FleetAuditLogger_1.fleetAuditLogger.logFleetNested(organizationId, fleet.id, fleet.name, newParentId, parentFleet?.name || 'Unknown');
            }
            else if (previousParentId) {
                FleetAuditLogger_1.fleetAuditLogger.logFleetUnnested(organizationId, fleet.id, fleet.name, previousParentId, previousParent?.name || 'Unknown');
            }
            const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
            const parentFleetForTeam = newParentId
                ? await this.findById(organizationId, newParentId)
                : null;
            await fleetTeamService.syncTeamHierarchy(organizationId, fleet, parentFleetForTeam, previousParent);
            return fleet;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Failed to move fleet', { error, fleetId, newParentId });
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async reorderFleets(organizationId, orderedIds, parentFleetId) {
        logger_1.logger.info('FleetService.reorderFleets', {
            organizationId,
            count: orderedIds.length,
            parentFleetId,
        });
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            for (let i = 0; i < orderedIds.length; i++) {
                await queryRunner.manager.update(Fleet_1.Fleet, { id: orderedIds[i], organizationId }, { sortOrder: i });
            }
            await queryRunner.commitTransaction();
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Failed to reorder fleets', { error, organizationId });
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async isDescendantOf(organizationId, potentialDescendantId, ancestorId) {
        const descendant = await this.findById(organizationId, potentialDescendantId);
        if (!descendant?.hierarchyPath) {
            return false;
        }
        const pathParts = descendant.hierarchyPath.split('.');
        return pathParts.includes(ancestorId);
    }
    async updateDescendantPaths(queryRunner, organizationId, parentFleet) {
        const children = await queryRunner.manager.find(Fleet_1.Fleet, {
            where: { organizationId, parentFleetId: parentFleet.id },
        });
        for (const child of children) {
            child.level = parentFleet.level + 1;
            child.hierarchyPath = `${parentFleet.hierarchyPath}.${child.id}`;
            await queryRunner.manager.save(child);
            await this.updateDescendantPaths(queryRunner, organizationId, child);
        }
    }
}
exports.FleetService = FleetService;
//# sourceMappingURL=FleetService.js.map