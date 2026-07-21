/**
 * Ship Maintenance Controller V2
 * Handles ship maintenance scheduling and tracking with standardized responses
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { ShipMaintenance, MaintenanceStatus } from '../../models/ShipMaintenance';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { paginateRepository } from '../../utils/pagination';

export class ShipMaintenanceControllerV2 {
    private maintenanceRepository = AppDataSource.getRepository(ShipMaintenance);

    // ==================== MAINTENANCE CRUD ====================

    /**
     * POST /api/v2/ship-maintenance
     * Schedule a new ship maintenance
     */
    async scheduleMaintenance(req: Request, res: Response): Promise<void> {
        const { shipId, ownerId, maintenanceType, scheduledDate, description, cost, notes } = req.body;

        // Validate required fields
        if (!shipId || !ownerId || !maintenanceType || !scheduledDate) {
            throw new ApiError(
                ApiErrorCode.MISSING_REQUIRED_FIELD,
                'shipId, ownerId, maintenanceType, and scheduledDate are required',
                400
            );
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
                status: MaintenanceStatus.SCHEDULED
            });

            await this.maintenanceRepository.save(maintenance);

            logger.info('Ship maintenance scheduled', { 
                maintenanceId: maintenance.id,
                shipId,
                ownerId,
                maintenanceType
            });

            res.status(201);
            res.success(maintenance);
        } catch (error: unknown) {
            logger.error('Error scheduling maintenance', { error });
            throw new ApiError(
                ApiErrorCode.INTERNAL_ERROR,
                getErrorMessage(error, 'Failed to schedule maintenance'),
                500
            );
        }
    }

    /**
     * GET /api/v2/ship-maintenance
     * Get all maintenance schedules with pagination
     */
    async getMaintenanceSchedules(req: Request, res: Response): Promise<void> {
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };

        try {
            const page = Math.floor(offset / limit) + 1;
            const paginationOptions = {
                page,
                limit,
                sortBy: 'scheduledDate',
                sortOrder: 'ASC' as const
            };

            const result = await paginateRepository(
                this.maintenanceRepository,
                paginationOptions,
                undefined,
                'scheduledDate'
            );

            const links = buildHateoasLinks(
                '/api/v2/ship-maintenance',
                offset,
                limit,
                result.pagination.total
            );

            logger.info('Maintenance schedules retrieved', { 
                count: result.data.length,
                total: result.pagination.total
            });

            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext
            }, links);
        } catch (error: unknown) {
            logger.error('Error fetching maintenance schedules', { error });
            throw new ApiError(
                ApiErrorCode.INTERNAL_ERROR,
                getErrorMessage(error, 'Failed to fetch maintenance schedules'),
                500
            );
        }
    }

    /**
     * GET /api/v2/ship-maintenance/:id
     * Get a specific maintenance schedule by ID
     */
    async getMaintenanceById(req: Request, res: Response): Promise<void> {
        const { id } = req.params;

        try {
            const maintenance = await this.maintenanceRepository.findOne({ where: { id } });

            if (!maintenance) {
                throw new ApiError(
                    ApiErrorCode.RESOURCE_NOT_FOUND,
                    'Maintenance schedule not found',
                    404
                );
            }

            logger.info('Maintenance schedule retrieved', { maintenanceId: id });

            res.success(maintenance);
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Error fetching maintenance schedule', { error, maintenanceId: id });
            throw new ApiError(
                ApiErrorCode.INTERNAL_ERROR,
                getErrorMessage(error, 'Failed to fetch maintenance schedule'),
                500
            );
        }
    }

    /**
     * PUT /api/v2/ship-maintenance/:id/status
     * Update maintenance status
     */
    async updateMaintenanceStatus(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const { status, performedBy, notes } = req.body;

        if (!status) {
            throw new ApiError(
                ApiErrorCode.MISSING_REQUIRED_FIELD,
                'Status is required',
                400
            );
        }

        try {
            const maintenance = await this.maintenanceRepository.findOne({ where: { id } });

            if (!maintenance) {
                throw new ApiError(
                    ApiErrorCode.RESOURCE_NOT_FOUND,
                    'Maintenance schedule not found',
                    404
                );
            }

            maintenance.status = status;
            if (performedBy) {
                maintenance.performedBy = performedBy;
            }
            if (notes) {
                maintenance.notes = notes;
            }

            if (status === MaintenanceStatus.COMPLETED) {
                maintenance.completedDate = new Date();
            }

            await this.maintenanceRepository.save(maintenance);

            logger.info('Maintenance status updated', { maintenanceId: id, status });

            res.success(maintenance);
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Error updating maintenance status', { error, maintenanceId: id });
            throw new ApiError(
                ApiErrorCode.INTERNAL_ERROR,
                getErrorMessage(error, 'Failed to update maintenance status'),
                500
            );
        }
    }

    // ==================== MAINTENANCE QUERIES ====================

    /**
     * GET /api/v2/ship-maintenance/upcoming
     * Get upcoming maintenance schedules
     */
    async getUpcomingMaintenance(req: Request, res: Response): Promise<void> {
        try {
            const now = new Date();
            const upcoming = await this.maintenanceRepository
                .createQueryBuilder('maintenance')
                .where('maintenance.scheduledDate > :now', { now })
                .andWhere('maintenance.status = :status', { status: MaintenanceStatus.SCHEDULED })
                .orderBy('maintenance.scheduledDate', 'ASC')
                .getMany();

            logger.info('Upcoming maintenance retrieved', { count: upcoming.length });

            res.success(upcoming);
        } catch (error: unknown) {
            logger.error('Error fetching upcoming maintenance', { error });
            throw new ApiError(
                ApiErrorCode.INTERNAL_ERROR,
                getErrorMessage(error, 'Failed to fetch upcoming maintenance'),
                500
            );
        }
    }

    /**
     * GET /api/v2/ship-maintenance/overdue
     * Get overdue maintenance schedules
     */
    async getOverdueMaintenance(req: Request, res: Response): Promise<void> {
        try {
            const now = new Date();
            const overdue = await this.maintenanceRepository
                .createQueryBuilder('maintenance')
                .where('maintenance.scheduledDate < :now', { now })
                .andWhere('maintenance.status = :status', { status: MaintenanceStatus.SCHEDULED })
                .getMany();

            logger.info('Overdue maintenance retrieved', { count: overdue.length });

            res.success(overdue);
        } catch (error: unknown) {
            logger.error('Error fetching overdue maintenance', { error });
            throw new ApiError(
                ApiErrorCode.INTERNAL_ERROR,
                getErrorMessage(error, 'Failed to fetch overdue maintenance'),
                500
            );
        }
    }
}
