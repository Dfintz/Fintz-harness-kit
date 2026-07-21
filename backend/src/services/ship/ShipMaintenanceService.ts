import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { MaintenanceStatus, MaintenanceType, ShipMaintenance } from '../../models/ShipMaintenance';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';

export interface MaintenanceFilters {
    shipId?: string;
    ownerId?: string;
    status?: MaintenanceStatus | MaintenanceStatus[];
    maintenanceType?: MaintenanceType | MaintenanceType[];
    scheduledDateFrom?: Date;
    scheduledDateTo?: Date;
    isOverdue?: boolean;
    search?: string;
}

export interface CreateMaintenanceDto {
    shipId: string;
    ownerId: string;
    maintenanceType: MaintenanceType;
    scheduledDate: Date;
    description?: string;
    cost?: number;
    notes?: string;
}

export interface UpdateMaintenanceDto {
    maintenanceType?: MaintenanceType;
    scheduledDate?: Date;
    status?: MaintenanceStatus;
    description?: string;
    cost?: number;
    performedBy?: string;
    notes?: string;
}

export interface MaintenanceReminder {
    maintenance: ShipMaintenance;
    daysUntilDue: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    message: string;
}

export interface MaintenanceStats {
    totalScheduled: number;
    totalInProgress: number;
    totalCompleted: number;
    totalCancelled: number;
    totalOverdue: number;
    totalCost: number;
    averageCost: number;
    completionRate: number;
    byType: Record<string, number>;
    upcomingCount: number;
}

export interface MaintenanceCostSummary {
    totalCost: number;
    byShip: Record<string, number>;
    byType: Record<string, number>;
    averagePerMaintenance: number;
    maintenanceCount: number;
}

/**
 * ShipMaintenanceService - Comprehensive ship maintenance scheduling and tracking
 * 
 * Features:
 * - Schedule and manage maintenance activities
 * - Automated reminders for upcoming maintenance
 * - Cost tracking and analytics
 * - Overdue maintenance detection
 * - Maintenance history and statistics
 */
export class ShipMaintenanceService {
    private maintenanceRepository: Repository<ShipMaintenance>;

    constructor() {
        this.maintenanceRepository = AppDataSource.getRepository(ShipMaintenance);
    }

    /**
     * Schedule a new maintenance activity
     */
    async scheduleMaintenance(data: CreateMaintenanceDto): Promise<ShipMaintenance> {
        logger.info('ShipMaintenanceService.scheduleMaintenance', { 
            shipId: data.shipId, 
            type: data.maintenanceType 
        });

        const maintenance = this.maintenanceRepository.create({
            id: `maintenance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...data,
            status: MaintenanceStatus.SCHEDULED
        });

        return this.maintenanceRepository.save(maintenance);
    }

    /**
     * Get maintenance by ID
     */
    async getMaintenanceById(id: string): Promise<ShipMaintenance | null> {
        return this.maintenanceRepository.findOne({ where: { id } });
    }

    /**
     * Get all maintenance schedules with filters and pagination
     */
    async getMaintenanceSchedules(
        filters: MaintenanceFilters,
        options?: PaginationOptions
    ): Promise<PaginatedResponse<ShipMaintenance>> {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const sortBy = options?.sortBy || 'scheduledDate';
        const sortOrder = options?.sortOrder || 'ASC';

        const query = this.maintenanceRepository.createQueryBuilder('maintenance');

        // Apply filters
        if (filters.shipId) {
            query.andWhere('maintenance.shipId = :shipId', { shipId: filters.shipId });
        }

        if (filters.ownerId) {
            query.andWhere('maintenance.ownerId = :ownerId', { ownerId: filters.ownerId });
        }

        if (filters.status) {
            if (Array.isArray(filters.status)) {
                query.andWhere('maintenance.status IN (:...statuses)', { statuses: filters.status });
            } else {
                query.andWhere('maintenance.status = :status', { status: filters.status });
            }
        }

        if (filters.maintenanceType) {
            if (Array.isArray(filters.maintenanceType)) {
                query.andWhere('maintenance.maintenanceType IN (:...types)', { types: filters.maintenanceType });
            } else {
                query.andWhere('maintenance.maintenanceType = :type', { type: filters.maintenanceType });
            }
        }

        if (filters.scheduledDateFrom && filters.scheduledDateTo) {
            query.andWhere('maintenance.scheduledDate BETWEEN :from AND :to', {
                from: filters.scheduledDateFrom,
                to: filters.scheduledDateTo
            });
        } else if (filters.scheduledDateFrom) {
            query.andWhere('maintenance.scheduledDate >= :from', { from: filters.scheduledDateFrom });
        } else if (filters.scheduledDateTo) {
            query.andWhere('maintenance.scheduledDate <= :to', { to: filters.scheduledDateTo });
        }

        if (filters.isOverdue) {
            const now = new Date();
            query.andWhere('maintenance.scheduledDate < :now', { now });
            query.andWhere('maintenance.status = :scheduledStatus', { scheduledStatus: MaintenanceStatus.SCHEDULED });
        }

        if (filters.search) {
            query.andWhere(
                '(maintenance.description ILIKE :search OR maintenance.notes ILIKE :search)',
                { search: `%${filters.search}%` }
            );
        }

        query.orderBy(`maintenance.${sortBy}`, sortOrder)
            .skip(skip)
            .take(limit);

        const [data, total] = await query.getManyAndCount();
        const totalPages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }

    /**
     * Update maintenance schedule
     */
    async updateMaintenance(
        id: string, 
        updates: UpdateMaintenanceDto
    ): Promise<ShipMaintenance | null> {
        logger.info('ShipMaintenanceService.updateMaintenance', { id });

        const maintenance = await this.getMaintenanceById(id);
        if (!maintenance) {
            return null;
        }

        // If status is being set to completed, record completion date
        if (updates.status === MaintenanceStatus.COMPLETED && 
            maintenance.status !== MaintenanceStatus.COMPLETED) {
            (maintenance as unknown as Record<string, unknown>).completedDate = new Date();
        }

        Object.assign(maintenance, updates);
        return this.maintenanceRepository.save(maintenance);
    }

    /**
     * Start maintenance (change status to IN_PROGRESS)
     */
    async startMaintenance(
        id: string, 
        performedBy?: string
    ): Promise<ShipMaintenance | null> {
        return this.updateMaintenance(id, {
            status: MaintenanceStatus.IN_PROGRESS,
            performedBy
        });
    }

    /**
     * Complete maintenance
     */
    async completeMaintenance(
        id: string, 
        performedBy?: string, 
        notes?: string, 
        actualCost?: number
    ): Promise<ShipMaintenance | null> {
        const updates: UpdateMaintenanceDto = {
            status: MaintenanceStatus.COMPLETED,
            performedBy,
            notes
        };

        if (actualCost !== undefined) {
            updates.cost = actualCost;
        }

        return this.updateMaintenance(id, updates);
    }

    /**
     * Cancel maintenance
     */
    async cancelMaintenance(id: string, reason?: string): Promise<ShipMaintenance | null> {
        return this.updateMaintenance(id, {
            status: MaintenanceStatus.CANCELLED,
            notes: reason
        });
    }

    /**
     * Get upcoming maintenance (scheduled within the next N days)
     */
    async getUpcomingMaintenance(
        daysAhead: number = 30,
        shipId?: string
    ): Promise<ShipMaintenance[]> {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        const query = this.maintenanceRepository.createQueryBuilder('maintenance')
            .where('maintenance.scheduledDate BETWEEN :now AND :future', { now, future: futureDate })
            .andWhere('maintenance.status = :status', { status: MaintenanceStatus.SCHEDULED });

        if (shipId) {
            query.andWhere('maintenance.shipId = :shipId', { shipId });
        }

        return query.orderBy('maintenance.scheduledDate', 'ASC').getMany();
    }

    /**
     * Get overdue maintenance
     */
    async getOverdueMaintenance(shipId?: string): Promise<ShipMaintenance[]> {
        const now = new Date();

        const query = this.maintenanceRepository.createQueryBuilder('maintenance')
            .where('maintenance.scheduledDate < :now', { now })
            .andWhere('maintenance.status = :status', { status: MaintenanceStatus.SCHEDULED });

        if (shipId) {
            query.andWhere('maintenance.shipId = :shipId', { shipId });
        }

        return query.orderBy('maintenance.scheduledDate', 'ASC').getMany();
    }

    /**
     * Get maintenance reminders with urgency levels
     */
    async getMaintenanceReminders(
        shipId?: string,
        daysAhead: number = 30
    ): Promise<MaintenanceReminder[]> {
        const upcoming = await this.getUpcomingMaintenance(daysAhead, shipId);
        const overdue = await this.getOverdueMaintenance(shipId);
        const now = new Date();

        const reminders: MaintenanceReminder[] = [];

        // Add overdue items first (critical)
        for (const maintenance of overdue) {
            const daysPastDue = Math.ceil(
                (now.getTime() - maintenance.scheduledDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            reminders.push({
                maintenance,
                daysUntilDue: -daysPastDue,
                urgency: 'critical',
                message: `Maintenance overdue by ${daysPastDue} day(s)!`
            });
        }

        // Add upcoming items
        for (const maintenance of upcoming) {
            const daysUntilDue = Math.ceil(
                (maintenance.scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            let urgency: 'low' | 'medium' | 'high';
            let message: string;

            if (daysUntilDue <= 3) {
                urgency = 'high';
                message = `Maintenance due in ${daysUntilDue} day(s)`;
            } else if (daysUntilDue <= 7) {
                urgency = 'medium';
                message = `Maintenance due in ${daysUntilDue} day(s)`;
            } else {
                urgency = 'low';
                message = `Maintenance scheduled for ${maintenance.scheduledDate.toLocaleDateString()}`;
            }

            reminders.push({
                maintenance,
                daysUntilDue,
                urgency,
                message
            });
        }

        // Sort by urgency (critical first) then by date
        return reminders.sort((a, b) => {
            const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            }
            return a.daysUntilDue - b.daysUntilDue;
        });
    }

    /**
     * Get maintenance statistics
     */
    async getMaintenanceStats(
        ownerId?: string,
        shipId?: string,
        dateFrom?: Date,
        dateTo?: Date
    ): Promise<MaintenanceStats> {
        const query = this.maintenanceRepository.createQueryBuilder('maintenance');

        if (ownerId) {
            query.andWhere('maintenance.ownerId = :ownerId', { ownerId });
        }

        if (shipId) {
            query.andWhere('maintenance.shipId = :shipId', { shipId });
        }

        if (dateFrom) {
            query.andWhere('maintenance.scheduledDate >= :from', { from: dateFrom });
        }

        if (dateTo) {
            query.andWhere('maintenance.scheduledDate <= :to', { to: dateTo });
        }

        const maintenances = await query.getMany();
        const now = new Date();

        const stats: MaintenanceStats = {
            totalScheduled: 0,
            totalInProgress: 0,
            totalCompleted: 0,
            totalCancelled: 0,
            totalOverdue: 0,
            totalCost: 0,
            averageCost: 0,
            completionRate: 0,
            byType: {},
            upcomingCount: 0
        };

        let costCount = 0;

        for (const m of maintenances) {
            // Count by status
            switch (m.status) {
                case MaintenanceStatus.SCHEDULED:
                    stats.totalScheduled++;
                    if (m.scheduledDate < now) {
                        stats.totalOverdue++;
                    } else {
                        stats.upcomingCount++;
                    }
                    break;
                case MaintenanceStatus.IN_PROGRESS:
                    stats.totalInProgress++;
                    break;
                case MaintenanceStatus.COMPLETED:
                    stats.totalCompleted++;
                    break;
                case MaintenanceStatus.CANCELLED:
                    stats.totalCancelled++;
                    break;
            }

            // Count by type
            stats.byType[m.maintenanceType] = (stats.byType[m.maintenanceType] || 0) + 1;

            // Sum costs
            if (m.cost) {
                stats.totalCost += Number(m.cost);
                costCount++;
            }
        }

        // Calculate averages and rates
        if (costCount > 0) {
            stats.averageCost = stats.totalCost / costCount;
        }

        const completableTotal = stats.totalCompleted + stats.totalCancelled + stats.totalOverdue;
        if (completableTotal > 0) {
            stats.completionRate = (stats.totalCompleted / completableTotal) * 100;
        }

        return stats;
    }

    /**
     * Get maintenance cost summary
     */
    async getMaintenanceCostSummary(
        ownerId?: string,
        dateFrom?: Date,
        dateTo?: Date
    ): Promise<MaintenanceCostSummary> {
        const query = this.maintenanceRepository.createQueryBuilder('maintenance')
            .where('maintenance.cost IS NOT NULL')
            .andWhere('maintenance.status = :status', { status: MaintenanceStatus.COMPLETED });

        if (ownerId) {
            query.andWhere('maintenance.ownerId = :ownerId', { ownerId });
        }

        if (dateFrom) {
            query.andWhere('maintenance.completedDate >= :from', { from: dateFrom });
        }

        if (dateTo) {
            query.andWhere('maintenance.completedDate <= :to', { to: dateTo });
        }

        const maintenances = await query.getMany();

        const summary: MaintenanceCostSummary = {
            totalCost: 0,
            byShip: {},
            byType: {},
            averagePerMaintenance: 0,
            maintenanceCount: maintenances.length
        };

        for (const m of maintenances) {
            const cost = Number(m.cost);
            summary.totalCost += cost;

            summary.byShip[m.shipId] = (summary.byShip[m.shipId] || 0) + cost;
            summary.byType[m.maintenanceType] = (summary.byType[m.maintenanceType] || 0) + cost;
        }

        if (maintenances.length > 0) {
            summary.averagePerMaintenance = summary.totalCost / maintenances.length;
        }

        return summary;
    }

    /**
     * Get maintenance history for a ship
     */
    async getShipMaintenanceHistory(
        shipId: string,
        options?: PaginationOptions
    ): Promise<PaginatedResponse<ShipMaintenance>> {
        return this.getMaintenanceSchedules(
            { shipId, status: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED] },
            options
        );
    }

    /**
     * Schedule recurring maintenance
     * Creates multiple maintenance entries based on interval
     */
    async scheduleRecurringMaintenance(
        data: CreateMaintenanceDto,
        intervalDays: number,
        occurrences: number
    ): Promise<ShipMaintenance[]> {
        logger.info('ShipMaintenanceService.scheduleRecurringMaintenance', {
            shipId: data.shipId,
            intervalDays,
            occurrences
        });

        const schedules: ShipMaintenance[] = [];
        const currentDate = new Date(data.scheduledDate);

        for (let i = 0; i < occurrences; i++) {
            const maintenance = await this.scheduleMaintenance({
                ...data,
                scheduledDate: new Date(currentDate)
            });
            schedules.push(maintenance);

            // Advance to next occurrence
            currentDate.setDate(currentDate.getDate() + intervalDays);
        }

        return schedules;
    }

    /**
     * Delete maintenance schedule
     */
    async deleteMaintenance(id: string): Promise<boolean> {
        const maintenance = await this.getMaintenanceById(id);
        if (!maintenance) {
            return false;
        }

        // Only allow deletion of scheduled or cancelled maintenance
        // Protect in-progress, completed, and overdue maintenance from deletion
        if (maintenance.status === MaintenanceStatus.IN_PROGRESS || 
            maintenance.status === MaintenanceStatus.COMPLETED ||
            maintenance.status === MaintenanceStatus.OVERDUE) {
            logger.warn('ShipMaintenanceService.deleteMaintenance: Cannot delete in-progress, completed, or overdue maintenance', { id, status: maintenance.status });
            return false;
        }

        await this.maintenanceRepository.delete(id);
        return true;
    }

    /**
     * Mark overdue maintenance as overdue status
     */
    async updateOverdueStatuses(): Promise<number> {
        const now = new Date();

        const result = await this.maintenanceRepository
            .createQueryBuilder()
            .update(ShipMaintenance)
            .set({ status: MaintenanceStatus.OVERDUE })
            .where('scheduledDate < :now', { now })
            .andWhere('status = :scheduled', { scheduled: MaintenanceStatus.SCHEDULED })
            .execute();

        if (result.affected && result.affected > 0) {
            logger.info('ShipMaintenanceService.updateOverdueStatuses', { 
                count: result.affected 
            });
        }

        return result.affected || 0;
    }
}

