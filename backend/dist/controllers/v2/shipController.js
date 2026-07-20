"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const Ship_1 = require("../../models/Ship");
const UserShip_1 = require("../../models/UserShip");
const ship_1 = require("../../services/ship");
const api_1 = require("../../types/api");
const authHelpers_1 = require("../../utils/authHelpers");
const csvExport_1 = require("../../utils/csvExport");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
class ShipControllerV2 {
    shipService;
    shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
    constructor() {
        this.shipService = new ship_1.ShipService();
    }
    async listShips(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const rawQuery = (req.query || {});
        const limit = Number.parseInt(rawQuery.limit, 10) || 20;
        const offset = Number.parseInt(rawQuery.offset, 10) || 0;
        const filters = (rawQuery.filters || {});
        const parseBooleanFilter = (value) => {
            if (value === 'true') {
                return true;
            }
            if (value === 'false') {
                return false;
            }
            return undefined;
        };
        const filtersObj = filters;
        const shipFilters = {
            manufacturer: filtersObj?.manufacturer,
            size: filtersObj?.size,
            role: filtersObj?.role,
            status: filtersObj?.status,
            isVehicle: parseBooleanFilter(filtersObj?.isVehicle),
            isActive: parseBooleanFilter(filtersObj?.isActive),
            search: filtersObj?.search,
        };
        const cleanFilters = Object.fromEntries(Object.entries(shipFilters).filter(([_, value]) => value !== undefined));
        try {
            const allShips = await this.shipService.findWithFilters(organizationId, cleanFilters);
            const total = allShips.length;
            const ships = allShips.slice(offset, offset + limit);
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/ships', offset, limit, total);
            logger_1.logger.info('Ships retrieved', {
                organizationId,
                count: ships.length,
                total,
                filters: cleanFilters,
            });
            res.paginated(ships, {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching ships', { error, organizationId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch ships'), 500);
        }
    }
    applySelectableCatalogueFilters(queryBuilder) {
        queryBuilder.andWhere('ship.name NOT LIKE :bundlePattern', { bundlePattern: '% with %' });
    }
    async getShip(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { id } = req.params;
        try {
            const ship = await this.shipService.findById(organizationId, id, {
                relations: ['owner'],
            });
            if (!ship) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
            }
            logger_1.logger.info('Ship retrieved', { organizationId, shipId: id });
            res.success(ship);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error fetching ship', { error, organizationId, shipId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch ship'), 500);
        }
    }
    async createShip(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const shipData = req.body;
        if (!shipData.name || !shipData.manufacturer) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'Name and manufacturer are required', 400);
        }
        try {
            const ship = await this.shipService.create(organizationId, shipData);
            logger_1.logger.info('Ship created', {
                organizationId,
                shipId: ship.id,
                name: ship.name,
            });
            res.status(201);
            res.success(ship);
        }
        catch (error) {
            logger_1.logger.error('Error creating ship', { error, organizationId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create ship'), 500);
        }
    }
    async updateShip(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { id } = req.params;
        const updateData = req.body;
        try {
            const ship = await this.shipService.update(organizationId, id, updateData);
            if (!ship) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
            }
            logger_1.logger.info('Ship updated', { organizationId, shipId: id });
            res.success(ship);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error updating ship', { error, organizationId, shipId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update ship'), 500);
        }
    }
    async deleteShip(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { id } = req.params;
        try {
            const ship = await this.shipService.deactivate(organizationId, id);
            if (!ship) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
            }
            logger_1.logger.info('Ship deactivated', { organizationId, shipId: id });
            res.status(204).send();
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error deactivating ship', { error, organizationId, shipId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to deactivate ship'), 500);
        }
    }
    async getStatistics(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        try {
            const stats = await this.shipService.getStatistics(organizationId);
            logger_1.logger.info('Ship statistics retrieved', { organizationId });
            res.success(stats);
        }
        catch (error) {
            logger_1.logger.error('Error fetching ship statistics', { error, organizationId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch ship statistics'), 500);
        }
    }
    async searchShips(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const searchTerm = req.query.q;
        if (!searchTerm) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Search term required (use ?q=term)', 400);
        }
        try {
            const ships = await this.shipService.search(organizationId, searchTerm);
            logger_1.logger.info('Ship search completed', {
                organizationId,
                searchTerm,
                count: ships.length,
            });
            res.success(ships);
        }
        catch (error) {
            logger_1.logger.error('Error searching ships', { error, organizationId, searchTerm });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to search ships'), 500);
        }
    }
    async reactivateShip(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { id } = req.params;
        try {
            const ship = await this.shipService.reactivate(organizationId, id);
            if (!ship) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
            }
            logger_1.logger.info('Ship reactivated', { organizationId, shipId: id });
            res.success(ship);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error reactivating ship', { error, organizationId, shipId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to reactivate ship'), 500);
        }
    }
    async shareShip(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { id } = req.params;
        const { targetOrganizationId } = req.body;
        if (!targetOrganizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'Target organization ID required', 400);
        }
        try {
            const ship = await this.shipService.shareWith(organizationId, id, targetOrganizationId);
            if (!ship) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
            }
            logger_1.logger.info('Ship shared', {
                organizationId,
                shipId: id,
                targetOrganizationId,
            });
            res.success(ship);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error sharing ship', { error, organizationId, shipId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to share ship'), 500);
        }
    }
    async unshareShip(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { id, targetOrgId } = req.params;
        try {
            const ship = await this.shipService.unshareWith(organizationId, id, [targetOrgId]);
            if (!ship) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
            }
            logger_1.logger.info('Ship unshared', {
                organizationId,
                shipId: id,
                targetOrgId,
            });
            res.success(ship);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error unsharing ship', { error, organizationId, shipId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to unshare ship'), 500);
        }
    }
    async getCatalogue(req, res) {
        const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
        const rawLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : Number.NaN;
        if (Number.isFinite(rawLimit) && rawLimit > 0) {
            paginationOptions.limit = Math.min(rawLimit, 500);
        }
        const { manufacturer, size, role, search, isVehicle, status } = req.query;
        try {
            const queryBuilder = this.shipRepository.createQueryBuilder('ship');
            if (manufacturer) {
                queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
            }
            if (size) {
                queryBuilder.andWhere('ship.size = :size', { size });
            }
            if (role) {
                queryBuilder.andWhere('LOWER(ship.role) LIKE LOWER(:role)', { role: `%${role}%` });
            }
            if (search) {
                queryBuilder.andWhere('(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))', { search: `%${search}%` });
            }
            if (isVehicle !== undefined) {
                queryBuilder.andWhere('ship.isVehicle = :isVehicle', {
                    isVehicle: isVehicle === 'true',
                });
            }
            if (status) {
                queryBuilder.andWhere('ship.status = :status', { status });
            }
            queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
            this.applySelectableCatalogueFilters(queryBuilder);
            const ALLOWED_SORT_FIELDS = [
                'name',
                'manufacturer',
                'size',
                'role',
                'status',
                'crewSize',
                'cargoCapacity',
                'price',
                'updatedAt',
                'createdAt',
            ];
            const rawSortBy = req.query.sortBy || 'name';
            const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy)
                ? rawSortBy
                : 'name';
            const rawSortOrder = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : '';
            const sortOrder = rawSortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            queryBuilder.orderBy(`ship.${sortBy}`, sortOrder);
            const result = await (0, pagination_1.paginateQueryBuilder)(queryBuilder, paginationOptions);
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/ships/catalogue', (paginationOptions.page - 1) * paginationOptions.limit, paginationOptions.limit, result.pagination.total);
            logger_1.logger.info('Ship catalogue retrieved', {
                count: result.data.length,
                total: result.pagination.total,
                filters: { manufacturer, size, role, search, isVehicle, status },
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit: result.pagination.limit,
                offset: (result.pagination.page - 1) * result.pagination.limit,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching ship catalogue', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch ship catalogue'), 500);
        }
    }
    async getManufacturers(req, res) {
        try {
            const manufacturers = this.shipRepository
                .createQueryBuilder('ship')
                .select('DISTINCT ship.manufacturer', 'manufacturer')
                .where('ship.isActive = :isActive', { isActive: true });
            this.applySelectableCatalogueFilters(manufacturers);
            const manufacturerRows = await manufacturers.orderBy('ship.manufacturer', 'ASC').getRawMany();
            const manufacturerList = manufacturerRows.map(m => m.manufacturer).filter(Boolean);
            logger_1.logger.info('Ship manufacturers retrieved', { count: manufacturerList.length });
            res.success(manufacturerList);
        }
        catch (error) {
            logger_1.logger.error('Error fetching ship manufacturers', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch ship manufacturers'), 500);
        }
    }
    async getRoles(req, res) {
        try {
            const roles = this.shipRepository
                .createQueryBuilder('ship')
                .select('DISTINCT ship.role', 'role')
                .where('ship.isActive = :isActive', { isActive: true });
            this.applySelectableCatalogueFilters(roles);
            const roleRows = await roles
                .andWhere('ship.role IS NOT NULL')
                .orderBy('ship.role', 'ASC')
                .getRawMany();
            const roleList = roleRows.map(r => r.role).filter(Boolean);
            logger_1.logger.info('Ship roles retrieved', { count: roleList.length });
            res.success(roleList);
        }
        catch (error) {
            logger_1.logger.error('Error fetching ship roles', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch ship roles'), 500);
        }
    }
    async getVehicles(req, res) {
        const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
        const { manufacturer, search } = req.query;
        try {
            const queryBuilder = this.shipRepository.createQueryBuilder('ship');
            queryBuilder.where('ship.isVehicle = :isVehicle', { isVehicle: true });
            queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
            if (manufacturer) {
                queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
            }
            if (search) {
                queryBuilder.andWhere('(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))', { search: `%${search}%` });
            }
            queryBuilder.orderBy('ship.name', 'ASC');
            const result = await (0, pagination_1.paginateQueryBuilder)(queryBuilder, paginationOptions);
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/ships/catalogue/vehicles', (paginationOptions.page - 1) * paginationOptions.limit, paginationOptions.limit, result.pagination.total);
            logger_1.logger.info('Ship vehicles retrieved', {
                count: result.data.length,
                total: result.pagination.total,
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit: result.pagination.limit,
                offset: (result.pagination.page - 1) * result.pagination.limit,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching vehicles', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch vehicles'), 500);
        }
    }
    async getSpacecraft(req, res) {
        const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
        const { manufacturer, size, role, search } = req.query;
        try {
            const queryBuilder = this.shipRepository.createQueryBuilder('ship');
            queryBuilder.where('ship.isVehicle = :isVehicle', { isVehicle: false });
            queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
            if (manufacturer) {
                queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
            }
            if (size) {
                queryBuilder.andWhere('ship.size = :size', { size });
            }
            if (role) {
                queryBuilder.andWhere('LOWER(ship.role) LIKE LOWER(:role)', { role: `%${role}%` });
            }
            if (search) {
                queryBuilder.andWhere('(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))', { search: `%${search}%` });
            }
            queryBuilder.orderBy('ship.name', 'ASC');
            const result = await (0, pagination_1.paginateQueryBuilder)(queryBuilder, paginationOptions);
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/ships/catalogue/spacecraft', (paginationOptions.page - 1) * paginationOptions.limit, paginationOptions.limit, result.pagination.total);
            logger_1.logger.info('Ship spacecraft retrieved', {
                count: result.data.length,
                total: result.pagination.total,
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit: result.pagination.limit,
                offset: (result.pagination.page - 1) * result.pagination.limit,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching spacecraft', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch spacecraft'), 500);
        }
    }
    async exportShipsCSV(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        try {
            const qb = database_1.AppDataSource.getRepository(UserShip_1.UserShip)
                .createQueryBuilder('ship')
                .innerJoin(OrganizationMembership_1.OrganizationMembership, 'm', 'm."userId" = ship."userId" AND m."organizationId" = :orgId AND m."isActive" = true', { orgId: organizationId })
                .where('ship.isActive = :isActive', { isActive: true })
                .orderBy('ship.shipName', 'ASC');
            const columns = [
                { key: 'shipName', header: 'Ship Name' },
                { key: 'shipType', header: 'Ship Type' },
                { key: 'manufacturer', header: 'Manufacturer' },
                { key: 'size', header: 'Size' },
                { key: 'status', header: 'Status' },
                { key: 'condition', header: 'Condition' },
                { key: 'sharingLevel', header: 'Sharing Level' },
                { key: 'pledgeType', header: 'Pledge Type' },
                { key: 'userId', header: 'Owner ID' },
                { key: 'createdAt', header: 'Added', value: row => row.createdAt?.toISOString?.() ?? '' },
            ];
            await (0, csvExport_1.streamCSV)(res, qb, columns, `ships-${organizationId}.csv`);
        }
        catch (error) {
            logger_1.logger.error('Error exporting ships CSV', { organizationId, error });
            if (!res.headersSent) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to export ships'), 500);
            }
        }
    }
}
exports.ShipControllerV2 = ShipControllerV2;
//# sourceMappingURL=shipController.js.map