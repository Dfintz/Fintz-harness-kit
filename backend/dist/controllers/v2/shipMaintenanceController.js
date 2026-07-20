"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipMaintenanceControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const ShipMaintenance_1 = require("../../models/ShipMaintenance");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
class ShipMaintenanceControllerV2 {
    maintenanceRepository = database_1.AppDataSource.getRepository(ShipMaintenance_1.ShipMaintenance);
    async scheduleMaintenance(req, res) {
        const { shipId, ownerId, maintenanceType, scheduledDate, description, cost, notes } = req.body;
        if (!shipId || !ownerId || !maintenanceType || !scheduledDate) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'shipId, ownerId, maintenanceType, and scheduledDate are required', 400);
        }
        try {
            const maintenance = this.maintenanceRepository.create({
                id: `maintenance-${Date.now()}`,
                shipId,
                ownerId,
                maintenanceType,
                scheduledDate: new Date(scheduledDate),
                description,
                cost,
                notes,
                status: ShipMaintenance_1.MaintenanceStatus.SCHEDULED
            });
            await this.maintenanceRepository.save(maintenance);
            logger_1.logger.info('Ship maintenance scheduled', {
                maintenanceId: maintenance.id,
                shipId,
                ownerId,
                maintenanceType
            });
            res.status(201);
            res.success(maintenance);
        }
        catch (error) {
            logger_1.logger.error('Error scheduling maintenance', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to schedule maintenance'), 500);
        }
    }
    async getMaintenanceSchedules(req, res) {
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
        try {
            const page = Math.floor(offset / limit) + 1;
            const paginationOptions = {
                page,
                limit,
                sortBy: 'scheduledDate',
                sortOrder: 'ASC'
            };
            const result = await (0, pagination_1.paginateRepository)(this.maintenanceRepository, paginationOptions, undefined, 'scheduledDate');
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/ship-maintenance', offset, limit, result.pagination.total);
            logger_1.logger.info('Maintenance schedules retrieved', {
                count: result.data.length,
                total: result.pagination.total
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching maintenance schedules', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch maintenance schedules'), 500);
        }
    }
    async getMaintenanceById(req, res) {
        const { id } = req.params;
        try {
            const maintenance = await this.maintenanceRepository.findOne({ where: { id } });
            if (!maintenance) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Maintenance schedule not found', 404);
            }
            logger_1.logger.info('Maintenance schedule retrieved', { maintenanceId: id });
            res.success(maintenance);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error fetching maintenance schedule', { error, maintenanceId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch maintenance schedule'), 500);
        }
    }
    async updateMaintenanceStatus(req, res) {
        const { id } = req.params;
        const { status, performedBy, notes } = req.body;
        if (!status) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'Status is required', 400);
        }
        try {
            const maintenance = await this.maintenanceRepository.findOne({ where: { id } });
            if (!maintenance) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Maintenance schedule not found', 404);
            }
            maintenance.status = status;
            if (performedBy) {
                maintenance.performedBy = performedBy;
            }
            if (notes) {
                maintenance.notes = notes;
            }
            if (status === ShipMaintenance_1.MaintenanceStatus.COMPLETED) {
                maintenance.completedDate = new Date();
            }
            await this.maintenanceRepository.save(maintenance);
            logger_1.logger.info('Maintenance status updated', { maintenanceId: id, status });
            res.success(maintenance);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error updating maintenance status', { error, maintenanceId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update maintenance status'), 500);
        }
    }
    async getUpcomingMaintenance(req, res) {
        try {
            const now = new Date();
            const upcoming = await this.maintenanceRepository
                .createQueryBuilder('maintenance')
                .where('maintenance.scheduledDate > :now', { now })
                .andWhere('maintenance.status = :status', { status: ShipMaintenance_1.MaintenanceStatus.SCHEDULED })
                .orderBy('maintenance.scheduledDate', 'ASC')
                .getMany();
            logger_1.logger.info('Upcoming maintenance retrieved', { count: upcoming.length });
            res.success(upcoming);
        }
        catch (error) {
            logger_1.logger.error('Error fetching upcoming maintenance', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch upcoming maintenance'), 500);
        }
    }
    async getOverdueMaintenance(req, res) {
        try {
            const now = new Date();
            const overdue = await this.maintenanceRepository
                .createQueryBuilder('maintenance')
                .where('maintenance.scheduledDate < :now', { now })
                .andWhere('maintenance.status = :status', { status: ShipMaintenance_1.MaintenanceStatus.SCHEDULED })
                .getMany();
            logger_1.logger.info('Overdue maintenance retrieved', { count: overdue.length });
            res.success(overdue);
        }
        catch (error) {
            logger_1.logger.error('Error fetching overdue maintenance', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch overdue maintenance'), 500);
        }
    }
}
exports.ShipMaintenanceControllerV2 = ShipMaintenanceControllerV2;
//# sourceMappingURL=shipMaintenanceController.js.map