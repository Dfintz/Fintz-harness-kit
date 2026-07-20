"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const CargoManifest_1 = require("../../models/CargoManifest");
const Ship_1 = require("../../models/Ship");
const OrganizationInventoryService_1 = require("../../services/organization/OrganizationInventoryService");
const UEXPriceFeed_1 = require("../../services/trade/trading/UEXPriceFeed");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const _safeParseInt = (value) => {
    if (!value) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
};
class InventoryControllerV2 {
    inventoryService;
    cargoManifestRepository = database_1.AppDataSource.getRepository(CargoManifest_1.CargoManifest);
    shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
    uexPriceFeed;
    constructor() {
        this.inventoryService = new OrganizationInventoryService_1.OrganizationInventoryService();
        this.uexPriceFeed = new UEXPriceFeed_1.UEXPriceFeed();
    }
    resolveOrganizationId(req) {
        const authReq = req;
        return (req.params.orgId ||
            authReq.tenantContext?.organizationId ||
            authReq.user?.currentOrganizationId ||
            null);
    }
    async findManifestForOrg(id, orgId) {
        return this.cargoManifestRepository
            .createQueryBuilder('manifest')
            .innerJoin(Ship_1.Ship, 'ship', 'ship.id = manifest.shipId')
            .where('manifest.id = :id', { id })
            .andWhere('ship.organizationId = :orgId', { orgId })
            .getOne();
    }
    async getInventory(req, res) {
        try {
            const { orgId } = req.params;
            const { limit = 20, offset = 0, sort, filters: queryFilters } = req.queryParams || {};
            const filterObj = (queryFilters || {});
            const filters = {
                category: filterObj.category,
                searchTerm: filterObj.searchTerm,
                assignedTo: filterObj.assignedTo,
                page: Math.floor(offset / limit) + 1,
                limit,
                sortBy: sort?.field,
                sortOrder: sort?.order === 'ASC' ? 'ASC' : 'DESC',
            };
            const result = await this.inventoryService.getInventory(orgId, filters);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/inventory`, offset, limit, result.pagination.total);
            res.paginated(result.items, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: offset + limit < result.pagination.total,
            }, links);
        }
        catch (error) {
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
        }
    }
    async getInventoryStatistics(req, res) {
        try {
            const { orgId } = req.params;
            const stats = await this.inventoryService.getInventoryStatistics(orgId);
            res.success(stats);
        }
        catch (error) {
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
        }
    }
    async getInventoryItem(req, res) {
        try {
            const { orgId, id } = req.params;
            const item = await this.inventoryService.getInventoryItemById(orgId, id);
            if (!item) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Inventory item not found', 404, {
                    orgId,
                    itemId: id,
                });
            }
            res.success(item);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, {
                orgId: req.params.orgId,
                itemId: req.params.id,
            });
        }
    }
    async createInventoryItem(req, res) {
        try {
            const { orgId } = req.params;
            const dto = req.body;
            const item = await this.inventoryService.createInventoryItem(orgId, dto);
            res.status(201).success(item);
        }
        catch (error) {
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
        }
    }
    async updateInventoryItem(req, res) {
        try {
            const { orgId, id } = req.params;
            const dto = req.body;
            const updated = await this.inventoryService.updateInventoryItem(orgId, id, dto);
            res.success(updated);
        }
        catch (error) {
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, {
                orgId: req.params.orgId,
                itemId: req.params.id,
            });
        }
    }
    async deleteInventoryItem(req, res) {
        try {
            const { orgId, id } = req.params;
            await this.inventoryService.deleteInventoryItem(orgId, id);
            res.status(204).send();
        }
        catch (error) {
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, {
                orgId: req.params.orgId,
                itemId: req.params.id,
            });
        }
    }
    async getMarketPrices(req, res) {
        try {
            const { itemName } = req.params;
            if (!itemName || itemName.trim().length === 0) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Item name is required', 400);
            }
            const item = await this.uexPriceFeed.getItemDetails(decodeURIComponent(itemName));
            if (!item) {
                res.success({
                    itemName: decodeURIComponent(itemName),
                    minPrice: null,
                    avgPrice: null,
                    maxPrice: null,
                    locations: [],
                    source: 'uexcorp',
                    available: false,
                });
                return;
            }
            const locations = item.locations.map(loc => ({
                location: loc.location,
                system: loc.system ?? null,
                planet: loc.planet ?? null,
                type: loc.type,
                price: loc.price ?? 0,
                inStock: loc.inStock ?? true,
            }));
            res.success({
                itemName: item.name,
                minPrice: item.minPrice ?? null,
                avgPrice: item.averagePrice ?? null,
                maxPrice: item.maxPrice ?? null,
                locations,
                source: 'uexcorp',
                available: true,
                lastUpdated: item.lastUpdated ?? null,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, {
                itemName: req.params.itemName,
            });
        }
    }
    async getCargoManifests(req, res) {
        try {
            const { orgId } = req.params;
            const { limit = 20, offset = 0 } = req.queryParams || {};
            const [manifests, total] = await this.cargoManifestRepository
                .createQueryBuilder('manifest')
                .innerJoin(Ship_1.Ship, 'ship', 'ship.id = manifest.shipId')
                .where('ship.organizationId = :orgId', { orgId })
                .take(limit)
                .skip(offset)
                .getManyAndCount();
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/cargo-manifests`, offset, limit, total);
            res.paginated(manifests, {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
        }
    }
    async getCargoManifest(req, res) {
        try {
            const { id } = req.params;
            const orgId = this.resolveOrganizationId(req);
            if (!orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
                    requiresOrgSelection: true,
                });
            }
            const manifest = await this.findManifestForOrg(id, orgId);
            if (!manifest) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Cargo manifest not found', 404, {
                    manifestId: id,
                    orgId,
                });
            }
            res.success(manifest);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { manifestId: req.params.id });
        }
    }
    async createCargoManifest(req, res) {
        try {
            const orgId = this.resolveOrganizationId(req);
            if (!orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
                    requiresOrgSelection: true,
                });
            }
            const ownerId = req.user?.id;
            if (!ownerId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const { shipId, cargo, origin, destination, sharedWithFleet, sharedWithAlliance, notes } = req.body;
            const shipExists = await this.shipRepository
                .createQueryBuilder('ship')
                .select('ship.id')
                .where('ship.id = :shipId', { shipId })
                .andWhere('ship.organizationId = :orgId', { orgId })
                .getRawOne();
            if (!shipExists) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship not found', 404, {
                    shipId,
                    orgId,
                });
            }
            const manifest = this.cargoManifestRepository.create({
                id: crypto.randomUUID(),
                shipId,
                ownerId,
                cargo: cargo || [],
                origin,
                destination,
                sharedWithFleet: sharedWithFleet || false,
                sharedWithAlliance: sharedWithAlliance || false,
                notes,
                status: CargoManifest_1.ManifestStatus.LOADING,
            });
            await this.cargoManifestRepository.save(manifest);
            res.status(201).success(manifest);
        }
        catch (error) {
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
        }
    }
    async updateCargoManifestStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const orgId = this.resolveOrganizationId(req);
            if (!orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
                    requiresOrgSelection: true,
                });
            }
            const manifest = await this.findManifestForOrg(id, orgId);
            if (!manifest) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Cargo manifest not found', 404, {
                    manifestId: id,
                    orgId,
                });
            }
            manifest.status = status;
            const updated = await this.cargoManifestRepository.save(manifest);
            res.success(updated);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { manifestId: req.params.id });
        }
    }
    async addCargoItem(req, res) {
        try {
            const { id } = req.params;
            const cargoData = req.body;
            const orgId = this.resolveOrganizationId(req);
            if (!orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
                    requiresOrgSelection: true,
                });
            }
            const manifest = await this.findManifestForOrg(id, orgId);
            if (!manifest) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Cargo manifest not found', 404, {
                    manifestId: id,
                    orgId,
                });
            }
            manifest.cargo = [...(manifest.cargo || []), cargoData];
            const updated = await this.cargoManifestRepository.save(manifest);
            res.success(updated);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { manifestId: req.params.id });
        }
    }
    async updateCargoManifestSharing(req, res) {
        try {
            const { id } = req.params;
            const { sharedWithFleet, sharedWithAlliance } = req.body;
            const orgId = this.resolveOrganizationId(req);
            if (!orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
                    requiresOrgSelection: true,
                });
            }
            const manifest = await this.findManifestForOrg(id, orgId);
            if (!manifest) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Cargo manifest not found', 404, {
                    manifestId: id,
                    orgId,
                });
            }
            if (sharedWithFleet !== undefined) {
                manifest.sharedWithFleet = sharedWithFleet;
            }
            if (sharedWithAlliance !== undefined) {
                manifest.sharedWithAlliance = sharedWithAlliance;
            }
            const updated = await this.cargoManifestRepository.save(manifest);
            res.success(updated);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500, { manifestId: req.params.id });
        }
    }
}
exports.InventoryControllerV2 = InventoryControllerV2;
//# sourceMappingURL=inventoryController.js.map