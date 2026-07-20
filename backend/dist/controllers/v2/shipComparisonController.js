"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipComparisonController = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const FleetShip_1 = require("../../models/FleetShip");
const Ship_1 = require("../../models/Ship");
const ShipComparisonService_1 = require("../../services/ship/ShipComparisonService");
const api_1 = require("../../types/api");
const authHelpers_1 = require("../../utils/authHelpers");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
class ShipComparisonController {
    shipComparisonService;
    shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
    fleetShipRepository = database_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
    constructor() {
        this.shipComparisonService = new ShipComparisonService_1.ShipComparisonService();
    }
    async compareShips(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { shipIds } = req.body;
        try {
            const uniqueShipIds = Array.from(new Set(shipIds));
            await this.assertShipsBelongToOrganization(uniqueShipIds, organizationId);
            const comparison = await this.shipComparisonService.compareShips(uniqueShipIds);
            res.success(comparison);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error comparing ships', { error, organizationId, shipCount: shipIds?.length });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to compare ships'), 500);
        }
    }
    async quickCompare(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { shipId1, shipId2 } = req.body;
        try {
            await this.assertShipsBelongToOrganization([shipId1, shipId2], organizationId);
            const quickResult = await this.shipComparisonService.quickCompare(shipId1, shipId2);
            res.success(quickResult);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error quick-comparing ships', { error, organizationId, shipId1, shipId2 });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to compare ships'), 500);
        }
    }
    async analyzeShipRoles(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { id } = req.params;
        try {
            await this.assertShipsBelongToOrganization([id], organizationId);
            const roleAnalysis = await this.shipComparisonService.analyzeShipRoles(id);
            res.success(roleAnalysis);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error analyzing ship roles', { error, organizationId, shipId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to analyze ship roles'), 500);
        }
    }
    async getSimilarShips(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { id } = req.params;
        const { limit } = req.query;
        try {
            await this.assertShipsBelongToOrganization([id], organizationId);
            const parsedLimit = Math.min(limit ? Number.parseInt(limit, 10) : 5, 200);
            const similarShips = await this.shipComparisonService.getSimilarShips(id, parsedLimit);
            const orgFiltered = similarShips.filter(ship => ship.organizationId === organizationId);
            res.success(orgFiltered);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error getting similar ships', { error, organizationId, shipId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get similar ships'), 500);
        }
    }
    async analyzeFleetShipComposition(req, res) {
        const { id } = req.params;
        try {
            const fleetShips = await this.fleetShipRepository.find({
                where: { fleetId: id },
                select: ['shipId'],
            });
            const shipIds = fleetShips.map(item => item.shipId);
            if (shipIds.length === 0) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Fleet has no ships assigned', 400);
            }
            const analysis = await this.shipComparisonService.analyzeFleetComposition(shipIds);
            res.success(analysis);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error analyzing fleet composition', { error, fleetId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to analyze fleet composition'), 500);
        }
    }
    async assertShipsBelongToOrganization(shipIds, organizationId) {
        const matches = await this.shipRepository
            .createQueryBuilder('ship')
            .where('ship.id IN (:...ids)', { ids: shipIds })
            .andWhere('ship.organizationId = :organizationId', { organizationId })
            .getCount();
        if (matches !== shipIds.length) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'One or more ships were not found in your organization', 400);
        }
    }
}
exports.ShipComparisonController = ShipComparisonController;
//# sourceMappingURL=shipComparisonController.js.map