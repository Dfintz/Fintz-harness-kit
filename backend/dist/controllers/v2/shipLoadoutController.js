"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipLoadoutControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const ErkulGamesService_1 = require("../../services/external/ErkulGamesService");
const ship_1 = require("../../services/ship");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const queryUtils_1 = require("../../utils/queryUtils");
class ShipLoadoutControllerV2 {
    loadoutService;
    erkulService;
    constructor() {
        this.loadoutService = new ship_1.ShipLoadoutService();
        this.erkulService = new ErkulGamesService_1.ErkulGamesService();
    }
    async createLoadout(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const { name, shipName, shipId, description, erkulGamesUrl, spViewerUrl, components } = req.body;
            const loadout = await this.loadoutService.createLoadout({
                name: name,
                shipName: shipName,
                shipId: shipId,
                description: description,
                erkulGamesUrl: erkulGamesUrl,
                spViewerUrl: spViewerUrl,
                components: (Array.isArray(components) ? components : []),
                ownerId: userId,
            });
            logger_1.logger.info('Loadout created', {
                loadoutId: loadout.id,
                shipName: loadout.shipName,
                ownerId: loadout.ownerId,
            });
            res.status(201);
            res.success(loadout);
        }
        catch (error) {
            logger_1.logger.error('Error creating loadout', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create loadout'), 500);
        }
    }
    async getLoadout(req, res) {
        const { id } = req.params;
        try {
            const loadout = await this.loadoutService.getLoadoutById(id);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            logger_1.logger.info('Loadout retrieved', { loadoutId: id });
            res.success(loadout);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error fetching loadout', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch loadout'), 500);
        }
    }
    async getLoadoutsByOwner(req, res) {
        const { ownerId } = req.params;
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
        const filters = {
            shipName: req.query.shipName,
            latestOnly: (0, queryUtils_1.parseBooleanQuery)(req.query.latestOnly),
        };
        try {
            const page = Math.floor(offset / limit) + 1;
            const paginationOptions = {
                page,
                limit,
                sortBy: 'createdAt',
                sortOrder: 'DESC',
            };
            const result = await this.loadoutService.getLoadoutsByOwner(ownerId, paginationOptions, filters);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/loadouts/owner/${ownerId}`, offset, limit, result.pagination.total);
            logger_1.logger.info('Loadouts by owner retrieved', {
                ownerId,
                count: result.data.length,
                total: result.pagination.total,
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching loadouts by owner', { error, ownerId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch loadouts'), 500);
        }
    }
    async getLoadoutsByShip(req, res) {
        const { shipName } = req.params;
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
        try {
            const page = Math.floor(offset / limit) + 1;
            const paginationOptions = {
                page,
                limit,
                sortBy: 'createdAt',
                sortOrder: 'DESC',
            };
            const result = await this.loadoutService.getLoadoutsByShip(shipName, paginationOptions);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/loadouts/ship/${shipName}`, offset, limit, result.pagination.total);
            logger_1.logger.info('Loadouts by ship retrieved', {
                shipName,
                count: result.data.length,
                total: result.pagination.total,
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching loadouts by ship', { error, shipName });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch loadouts'), 500);
        }
    }
    async getPopularLoadouts(req, res) {
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
        try {
            const page = Math.floor(offset / limit) + 1;
            const paginationOptions = {
                page,
                limit,
                sortBy: 'createdAt',
                sortOrder: 'DESC',
            };
            const result = await this.loadoutService.getPopularLoadouts(paginationOptions);
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/loadouts/popular', offset, limit, result.pagination.total);
            logger_1.logger.info('Popular loadouts retrieved', {
                count: result.data.length,
                total: result.pagination.total,
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching popular loadouts', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch popular loadouts'), 500);
        }
    }
    async getSharedLoadouts(req, res) {
        const { userId } = req.params;
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
        try {
            const page = Math.floor(offset / limit) + 1;
            const paginationOptions = {
                page,
                limit,
                sortBy: 'createdAt',
                sortOrder: 'DESC',
            };
            const result = await this.loadoutService.getSharedLoadouts(userId, paginationOptions);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/loadouts/shared/${userId}`, offset, limit, result.pagination.total);
            logger_1.logger.info('Shared loadouts retrieved', {
                userId,
                count: result.data.length,
                total: result.pagination.total,
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching shared loadouts', { error, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch shared loadouts'), 500);
        }
    }
    async updateLoadout(req, res) {
        const { id } = req.params;
        try {
            const loadout = await this.loadoutService.updateLoadout(id, req.body);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            logger_1.logger.info('Loadout updated', { loadoutId: id });
            res.success(loadout);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error updating loadout', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update loadout'), 500);
        }
    }
    async deleteLoadout(req, res) {
        const { id } = req.params;
        try {
            const success = await this.loadoutService.deleteLoadout(id);
            if (!success) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            logger_1.logger.info('Loadout deleted', { loadoutId: id });
            res.status(204).send();
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error deleting loadout', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to delete loadout'), 500);
        }
    }
    async createVersion(req, res) {
        const { id } = req.params;
        try {
            const loadout = await this.loadoutService.createVersion(id, req.body);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Parent loadout not found', 404);
            }
            logger_1.logger.info('Loadout version created', {
                parentId: id,
                newVersionId: loadout.id,
            });
            res.status(201);
            res.success(loadout);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error creating loadout version', { error, parentId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create loadout version'), 500);
        }
    }
    async getVersionHistory(req, res) {
        const { id } = req.params;
        try {
            const history = await this.loadoutService.getVersionHistory(id);
            logger_1.logger.info('Loadout version history retrieved', {
                loadoutId: id,
                versionCount: history.length,
            });
            res.success(history);
        }
        catch (error) {
            logger_1.logger.error('Error fetching version history', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch version history'), 500);
        }
    }
    async compareLoadouts(req, res) {
        const { id1, id2 } = req.params;
        try {
            const loadout1 = await this.loadoutService.getLoadoutById(id1);
            const loadout2 = await this.loadoutService.getLoadoutById(id2);
            if (!loadout1 || !loadout2) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'One or both loadouts not found', 404);
            }
            const comparison = this.loadoutService.compareLoadouts(loadout1, loadout2);
            logger_1.logger.info('Loadouts compared', { id1, id2 });
            res.success(comparison);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error comparing loadouts', { error, id1, id2 });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to compare loadouts'), 500);
        }
    }
    async shareWithUsers(req, res) {
        const { id } = req.params;
        const { userIds } = req.body;
        if (!Array.isArray(userIds)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'userIds must be an array', 400);
        }
        try {
            const loadout = await this.loadoutService.shareWithUsers(id, userIds);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            logger_1.logger.info('Loadout shared with users', {
                loadoutId: id,
                userCount: userIds.length,
            });
            res.success(loadout);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error sharing loadout', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to share loadout'), 500);
        }
    }
    async updateSharingSettings(req, res) {
        const { id } = req.params;
        try {
            const loadout = await this.loadoutService.updateSharingSettings(id, req.body);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            logger_1.logger.info('Loadout sharing settings updated', { loadoutId: id });
            res.success(loadout);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error updating sharing settings', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update sharing settings'), 500);
        }
    }
    async shareWithOrganizations(req, res) {
        const { id } = req.params;
        const { organizationIds } = req.body;
        if (!Array.isArray(organizationIds)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'organizationIds must be an array', 400);
        }
        try {
            const loadout = await this.loadoutService.shareWithOrganizations(id, organizationIds);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            logger_1.logger.info('Loadout shared with organizations', {
                loadoutId: id,
                orgCount: organizationIds.length,
            });
            res.success(loadout);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error sharing loadout with orgs', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to share loadout with organizations'), 500);
        }
    }
    async unshareFromOrganizations(req, res) {
        const { id } = req.params;
        const { organizationIds } = req.body;
        if (!Array.isArray(organizationIds)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'organizationIds must be an array', 400);
        }
        try {
            const loadout = await this.loadoutService.unshareFromOrganizations(id, organizationIds);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            logger_1.logger.info('Loadout unshared from organizations', {
                loadoutId: id,
                orgCount: organizationIds.length,
            });
            res.success(loadout);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error unsharing loadout from orgs', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to unshare loadout from organizations'), 500);
        }
    }
    async getLoadoutsForUser(req, res) {
        const { userId } = req.params;
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
        let userOrgIds = [];
        const { organizationIds } = req.query;
        if (typeof organizationIds === 'string') {
            userOrgIds = organizationIds.split(',');
        }
        else if (Array.isArray(organizationIds)) {
            userOrgIds = organizationIds;
        }
        try {
            const page = Math.floor(offset / limit) + 1;
            const paginationOptions = {
                page,
                limit,
                sortBy: 'createdAt',
                sortOrder: 'DESC',
            };
            const result = await this.loadoutService.getLoadoutsForUser(userId, userOrgIds, paginationOptions);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/users/${userId}/loadouts`, offset, limit, result.pagination.total);
            logger_1.logger.info('User loadouts retrieved', {
                userId,
                count: result.data.length,
                total: result.pagination.total,
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching user loadouts', { error, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch user loadouts'), 500);
        }
    }
    async parseErkulUrl(req, res) {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'URL is required', 400);
        }
        try {
            const result = await this.erkulService.parseErkulUrl(url);
            if (!result.success || !result.loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, result.error || 'Failed to parse Erkul URL', 400);
            }
            logger_1.logger.info('Erkul URL parsed', {
                shipName: result.loadout.shipName,
                componentCount: result.loadout.components.length,
            });
            res.success({
                shipName: result.loadout.shipName,
                components: result.loadout.components,
                statistics: result.loadout.statistics,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error parsing Erkul URL', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to parse Erkul URL'), 500);
        }
    }
    async generateErkulUrl(req, res) {
        const { id } = req.params;
        try {
            const loadout = await this.loadoutService.getLoadoutById(id);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            const url = this.loadoutService.generateErkulGamesUrl(loadout);
            logger_1.logger.info('Erkul URL generated', { loadoutId: id });
            res.success({ url });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error generating Erkul URL', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to generate Erkul URL'), 500);
        }
    }
    async updateErkulUrl(req, res) {
        const { id } = req.params;
        const { url } = req.body;
        if (!url) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'URL is required', 400);
        }
        try {
            const loadout = await this.loadoutService.updateErkulGamesUrl(id, url);
            if (!loadout) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
            }
            logger_1.logger.info('Erkul URL updated', { loadoutId: id });
            res.success(loadout);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error updating Erkul URL', { error, loadoutId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update Erkul URL'), 500);
        }
    }
}
exports.ShipLoadoutControllerV2 = ShipLoadoutControllerV2;
//# sourceMappingURL=shipLoadoutController.js.map