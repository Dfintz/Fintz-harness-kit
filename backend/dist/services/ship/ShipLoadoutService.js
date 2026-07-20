"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipLoadoutService = void 0;
const data_source_1 = require("../../data-source");
const ShipLoadout_1 = require("../../models/ShipLoadout");
class ShipLoadoutService {
    loadoutRepository;
    constructor() {
        this.loadoutRepository = data_source_1.AppDataSource.getRepository(ShipLoadout_1.ShipLoadout);
    }
    async createLoadout(loadoutData) {
        const loadout = this.loadoutRepository.create({
            ...loadoutData,
            version: 1,
            isLatestVersion: true,
        });
        return this.loadoutRepository.save(loadout);
    }
    async getLoadoutById(id) {
        return this.loadoutRepository.findOne({ where: { id } });
    }
    async getLoadoutsByOwner(ownerId, paginationOptions, filters) {
        const page = paginationOptions.page || 1;
        const limit = paginationOptions.limit || 10;
        const skip = (page - 1) * limit;
        const sortBy = paginationOptions.sortBy || 'createdAt';
        const sortOrder = paginationOptions.sortOrder || 'DESC';
        const query = this.loadoutRepository
            .createQueryBuilder('loadout')
            .where('loadout.ownerId = :ownerId', { ownerId });
        if (filters?.shipName) {
            query.andWhere('loadout.shipName = :shipName', { shipName: filters.shipName });
        }
        if (filters?.latestOnly) {
            query.andWhere('loadout.isLatestVersion = :latest', { latest: true });
        }
        const [data, total] = await query
            .orderBy(`loadout.${sortBy}`, sortOrder)
            .skip(skip)
            .take(limit)
            .getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async getSharedLoadouts(userId, paginationOptions) {
        const page = paginationOptions.page || 1;
        const limit = paginationOptions.limit || 10;
        const skip = (page - 1) * limit;
        const sortBy = paginationOptions.sortBy || 'createdAt';
        const sortOrder = paginationOptions.sortOrder || 'DESC';
        const [data, total] = await this.loadoutRepository
            .createQueryBuilder('loadout')
            .where('loadout.sharedWithFleet = :shared', { shared: true })
            .orWhere('loadout.sharedWithOrg = :shared', { shared: true })
            .orWhere('loadout.sharedWithAlliance = :shared', { shared: true })
            .orWhere('loadout.sharedWithUsers @> ARRAY[:userId]::text[]', { userId })
            .andWhere('loadout.ownerId != :userId', { userId })
            .orderBy(`loadout.${sortBy}`, sortOrder)
            .skip(skip)
            .take(limit)
            .getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async updateLoadout(id, updates) {
        const loadout = await this.getLoadoutById(id);
        if (!loadout) {
            return null;
        }
        Object.assign(loadout, updates);
        return this.loadoutRepository.save(loadout);
    }
    async deleteLoadout(id) {
        const result = await this.loadoutRepository.delete(id);
        return (result.affected || 0) > 0;
    }
    async createVersion(parentLoadoutId, updates) {
        const parentLoadout = await this.getLoadoutById(parentLoadoutId);
        if (!parentLoadout) {
            return null;
        }
        parentLoadout.isLatestVersion = false;
        await this.loadoutRepository.save(parentLoadout);
        const newVersion = this.loadoutRepository.create({
            ...parentLoadout,
            id: undefined,
            ...updates,
            version: parentLoadout.version + 1,
            parentLoadoutId: parentLoadout.id,
            isLatestVersion: true,
            createdAt: undefined,
            updatedAt: undefined,
        });
        return this.loadoutRepository.save(newVersion);
    }
    async getVersionHistory(loadoutId) {
        const loadout = await this.getLoadoutById(loadoutId);
        if (!loadout) {
            return [];
        }
        let rootLoadoutId = loadoutId;
        if (loadout.parentLoadoutId) {
            let current = loadout;
            while (current.parentLoadoutId) {
                const parent = await this.getLoadoutById(current.parentLoadoutId);
                if (!parent) {
                    break;
                }
                current = parent;
            }
            rootLoadoutId = current.id;
        }
        const versions = await this.loadoutRepository
            .createQueryBuilder('loadout')
            .where('loadout.id = :rootId', { rootId: rootLoadoutId })
            .orWhere('loadout.parentLoadoutId = :rootId', { rootId: rootLoadoutId })
            .orderBy('loadout.version', 'ASC')
            .getMany();
        return versions;
    }
    compareLoadouts(loadout1, loadout2) {
        const componentDifferences = [];
        const allSlots = new Set([
            ...loadout1.components.map(c => c.slot),
            ...loadout2.components.map(c => c.slot),
        ]);
        allSlots.forEach(slot => {
            const comp1 = loadout1.components.find(c => c.slot === slot);
            const comp2 = loadout2.components.find(c => c.slot === slot);
            if (comp1?.componentName !== comp2?.componentName) {
                componentDifferences.push({
                    slot,
                    loadout1Component: comp1?.componentName || null,
                    loadout2Component: comp2?.componentName || null,
                });
            }
        });
        const statisticsDifferences = {};
        const stats1 = loadout1.statistics || {};
        const stats2 = loadout2.statistics || {};
        const allStatKeys = new Set([...Object.keys(stats1), ...Object.keys(stats2)]);
        allStatKeys.forEach(key => {
            if (stats1[key] !== stats2[key]) {
                statisticsDifferences[key] = {
                    loadout1: stats1[key],
                    loadout2: stats2[key],
                };
            }
        });
        return { componentDifferences, statisticsDifferences };
    }
    async shareWithUsers(loadoutId, userIds) {
        const loadout = await this.getLoadoutById(loadoutId);
        if (!loadout) {
            return null;
        }
        const existingUsers = loadout.sharedWithUsers || [];
        loadout.sharedWithUsers = [...new Set([...existingUsers, ...userIds])];
        return this.loadoutRepository.save(loadout);
    }
    async updateSharingSettings(loadoutId, settings) {
        return this.updateLoadout(loadoutId, settings);
    }
    generateErkulGamesUrl(loadout) {
        const baseUrl = 'https://www.erkul.games/live/calculator';
        const params = new URLSearchParams();
        const erkulShipName = loadout.shipName.toUpperCase().replace(/\s+/g, '_');
        params.append('ship', erkulShipName);
        loadout.components.forEach(component => {
            const erkulName = component.componentName.toUpperCase().replace(/\s+/g, '_');
            params.append(component.slot, erkulName);
        });
        return `${baseUrl}?${params.toString()}`;
    }
    async updateErkulGamesUrl(loadoutId, url) {
        return this.updateLoadout(loadoutId, { erkulGamesUrl: url });
    }
    async getLoadoutsByShip(shipName, paginationOptions) {
        const page = paginationOptions.page || 1;
        const limit = paginationOptions.limit || 10;
        const skip = (page - 1) * limit;
        const sortBy = paginationOptions.sortBy || 'createdAt';
        const sortOrder = paginationOptions.sortOrder || 'DESC';
        const [data, total] = await this.loadoutRepository
            .createQueryBuilder('loadout')
            .where('loadout.shipName = :shipName', { shipName })
            .andWhere('loadout.isLatestVersion = :latest', { latest: true })
            .orderBy(`loadout.${sortBy}`, sortOrder)
            .skip(skip)
            .take(limit)
            .getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async getPopularLoadouts(paginationOptions) {
        const page = paginationOptions.page || 1;
        const limit = paginationOptions.limit || 10;
        const skip = (page - 1) * limit;
        const [data, total] = await this.loadoutRepository
            .createQueryBuilder('loadout')
            .where('loadout.isLatestVersion = :latest', { latest: true })
            .andWhere('(loadout.sharedWithFleet = true OR loadout.sharedWithOrg = true OR loadout.sharedWithAlliance = true)')
            .orderBy('loadout.createdAt', 'DESC')
            .skip(skip)
            .take(limit)
            .getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async shareWithOrganizations(loadoutId, organizationIds) {
        const loadout = await this.getLoadoutById(loadoutId);
        if (!loadout) {
            return null;
        }
        const existingOrgs = loadout.sharedWithOrgs || [];
        loadout.sharedWithOrgs = [...new Set([...existingOrgs, ...organizationIds])];
        return this.loadoutRepository.save(loadout);
    }
    async unshareFromOrganizations(loadoutId, organizationIds) {
        const loadout = await this.getLoadoutById(loadoutId);
        if (!loadout) {
            return null;
        }
        loadout.sharedWithOrgs = (loadout.sharedWithOrgs || []).filter(orgId => !organizationIds.includes(orgId));
        return this.loadoutRepository.save(loadout);
    }
    async getLoadoutsForUser(userId, userOrgIds, paginationOptions) {
        const page = paginationOptions.page || 1;
        const limit = paginationOptions.limit || 10;
        const skip = (page - 1) * limit;
        const queryBuilder = this.loadoutRepository
            .createQueryBuilder('loadout')
            .where('loadout.isLatestVersion = :latest', { latest: true });
        const conditions = [];
        const parameters = {};
        conditions.push('loadout.ownerId = :userId');
        parameters.userId = userId;
        if (userOrgIds.length > 0) {
            userOrgIds.forEach((orgId, index) => {
                const paramName = `orgId${index}`;
                conditions.push(`loadout.sharedWithOrgs LIKE :${paramName}`);
                parameters[paramName] = `%${orgId}%`;
            });
        }
        conditions.push('loadout.sharedWithFleet = true');
        conditions.push('loadout.sharedWithOrg = true');
        conditions.push('loadout.sharedWithAlliance = true');
        queryBuilder.andWhere(`(${conditions.join(' OR ')})`, parameters);
        const sortBy = paginationOptions.sortBy || 'createdAt';
        const sortOrder = paginationOptions.sortOrder || 'DESC';
        queryBuilder.orderBy(`loadout.${sortBy}`, sortOrder).skip(skip).take(limit);
        const [data, total] = await queryBuilder.getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
}
exports.ShipLoadoutService = ShipLoadoutService;
//# sourceMappingURL=ShipLoadoutService.js.map