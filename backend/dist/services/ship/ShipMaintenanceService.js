"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipMaintenanceService = void 0;
const data_source_1 = require("../../data-source");
const ShipMaintenance_1 = require("../../models/ShipMaintenance");
const logger_1 = require("../../utils/logger");
class ShipMaintenanceService {
    maintenanceRepository;
    constructor() {
        this.maintenanceRepository = data_source_1.AppDataSource.getRepository(ShipMaintenance_1.ShipMaintenance);
    }
    async scheduleMaintenance(data) {
        logger_1.logger.info('ShipMaintenanceService.scheduleMaintenance', {
            shipId: data.shipId,
            type: data.maintenanceType
        });
        const maintenance = this.maintenanceRepository.create({
            id: `maintenance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...data,
            status: ShipMaintenance_1.MaintenanceStatus.SCHEDULED
        });
        return this.maintenanceRepository.save(maintenance);
    }
    async getMaintenanceById(id) {
        return this.maintenanceRepository.findOne({ where: { id } });
    }
    async getMaintenanceSchedules(filters, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const sortBy = options?.sortBy || 'scheduledDate';
        const sortOrder = options?.sortOrder || 'ASC';
        const query = this.maintenanceRepository.createQueryBuilder('maintenance');
        if (filters.shipId) {
            query.andWhere('maintenance.shipId = :shipId', { shipId: filters.shipId });
        }
        if (filters.ownerId) {
            query.andWhere('maintenance.ownerId = :ownerId', { ownerId: filters.ownerId });
        }
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                query.andWhere('maintenance.status IN (:...statuses)', { statuses: filters.status });
            }
            else {
                query.andWhere('maintenance.status = :status', { status: filters.status });
            }
        }
        if (filters.maintenanceType) {
            if (Array.isArray(filters.maintenanceType)) {
                query.andWhere('maintenance.maintenanceType IN (:...types)', { types: filters.maintenanceType });
            }
            else {
                query.andWhere('maintenance.maintenanceType = :type', { type: filters.maintenanceType });
            }
        }
        if (filters.scheduledDateFrom && filters.scheduledDateTo) {
            query.andWhere('maintenance.scheduledDate BETWEEN :from AND :to', {
                from: filters.scheduledDateFrom,
                to: filters.scheduledDateTo
            });
        }
        else if (filters.scheduledDateFrom) {
            query.andWhere('maintenance.scheduledDate >= :from', { from: filters.scheduledDateFrom });
        }
        else if (filters.scheduledDateTo) {
            query.andWhere('maintenance.scheduledDate <= :to', { to: filters.scheduledDateTo });
        }
        if (filters.isOverdue) {
            const now = new Date();
            query.andWhere('maintenance.scheduledDate < :now', { now });
            query.andWhere('maintenance.status = :scheduledStatus', { scheduledStatus: ShipMaintenance_1.MaintenanceStatus.SCHEDULED });
        }
        if (filters.search) {
            query.andWhere('(maintenance.description ILIKE :search OR maintenance.notes ILIKE :search)', { search: `%${filters.search}%` });
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
    async updateMaintenance(id, updates) {
        logger_1.logger.info('ShipMaintenanceService.updateMaintenance', { id });
        const maintenance = await this.getMaintenanceById(id);
        if (!maintenance) {
            return null;
        }
        if (updates.status === ShipMaintenance_1.MaintenanceStatus.COMPLETED &&
            maintenance.status !== ShipMaintenance_1.MaintenanceStatus.COMPLETED) {
            maintenance.completedDate = new Date();
        }
        Object.assign(maintenance, updates);
        return this.maintenanceRepository.save(maintenance);
    }
    async startMaintenance(id, performedBy) {
        return this.updateMaintenance(id, {
            status: ShipMaintenance_1.MaintenanceStatus.IN_PROGRESS,
            performedBy
        });
    }
    async completeMaintenance(id, performedBy, notes, actualCost) {
        const updates = {
            status: ShipMaintenance_1.MaintenanceStatus.COMPLETED,
            performedBy,
            notes
        };
        if (actualCost !== undefined) {
            updates.cost = actualCost;
        }
        return this.updateMaintenance(id, updates);
    }
    async cancelMaintenance(id, reason) {
        return this.updateMaintenance(id, {
            status: ShipMaintenance_1.MaintenanceStatus.CANCELLED,
            notes: reason
        });
    }
    async getUpcomingMaintenance(daysAhead = 30, shipId) {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        const query = this.maintenanceRepository.createQueryBuilder('maintenance')
            .where('maintenance.scheduledDate BETWEEN :now AND :future', { now, future: futureDate })
            .andWhere('maintenance.status = :status', { status: ShipMaintenance_1.MaintenanceStatus.SCHEDULED });
        if (shipId) {
            query.andWhere('maintenance.shipId = :shipId', { shipId });
        }
        return query.orderBy('maintenance.scheduledDate', 'ASC').getMany();
    }
    async getOverdueMaintenance(shipId) {
        const now = new Date();
        const query = this.maintenanceRepository.createQueryBuilder('maintenance')
            .where('maintenance.scheduledDate < :now', { now })
            .andWhere('maintenance.status = :status', { status: ShipMaintenance_1.MaintenanceStatus.SCHEDULED });
        if (shipId) {
            query.andWhere('maintenance.shipId = :shipId', { shipId });
        }
        return query.orderBy('maintenance.scheduledDate', 'ASC').getMany();
    }
    async getMaintenanceReminders(shipId, daysAhead = 30) {
        const upcoming = await this.getUpcomingMaintenance(daysAhead, shipId);
        const overdue = await this.getOverdueMaintenance(shipId);
        const now = new Date();
        const reminders = [];
        for (const maintenance of overdue) {
            const daysPastDue = Math.ceil((now.getTime() - maintenance.scheduledDate.getTime()) / (1000 * 60 * 60 * 24));
            reminders.push({
                maintenance,
                daysUntilDue: -daysPastDue,
                urgency: 'critical',
                message: `Maintenance overdue by ${daysPastDue} day(s)!`
            });
        }
        for (const maintenance of upcoming) {
            const daysUntilDue = Math.ceil((maintenance.scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            let urgency;
            let message;
            if (daysUntilDue <= 3) {
                urgency = 'high';
                message = `Maintenance due in ${daysUntilDue} day(s)`;
            }
            else if (daysUntilDue <= 7) {
                urgency = 'medium';
                message = `Maintenance due in ${daysUntilDue} day(s)`;
            }
            else {
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
        return reminders.sort((a, b) => {
            const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            }
            return a.daysUntilDue - b.daysUntilDue;
        });
    }
    async getMaintenanceStats(ownerId, shipId, dateFrom, dateTo) {
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
        const stats = {
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
            switch (m.status) {
                case ShipMaintenance_1.MaintenanceStatus.SCHEDULED:
                    stats.totalScheduled++;
                    if (m.scheduledDate < now) {
                        stats.totalOverdue++;
                    }
                    else {
                        stats.upcomingCount++;
                    }
                    break;
                case ShipMaintenance_1.MaintenanceStatus.IN_PROGRESS:
                    stats.totalInProgress++;
                    break;
                case ShipMaintenance_1.MaintenanceStatus.COMPLETED:
                    stats.totalCompleted++;
                    break;
                case ShipMaintenance_1.MaintenanceStatus.CANCELLED:
                    stats.totalCancelled++;
                    break;
            }
            stats.byType[m.maintenanceType] = (stats.byType[m.maintenanceType] || 0) + 1;
            if (m.cost) {
                stats.totalCost += Number(m.cost);
                costCount++;
            }
        }
        if (costCount > 0) {
            stats.averageCost = stats.totalCost / costCount;
        }
        const completableTotal = stats.totalCompleted + stats.totalCancelled + stats.totalOverdue;
        if (completableTotal > 0) {
            stats.completionRate = (stats.totalCompleted / completableTotal) * 100;
        }
        return stats;
    }
    async getMaintenanceCostSummary(ownerId, dateFrom, dateTo) {
        const query = this.maintenanceRepository.createQueryBuilder('maintenance')
            .where('maintenance.cost IS NOT NULL')
            .andWhere('maintenance.status = :status', { status: ShipMaintenance_1.MaintenanceStatus.COMPLETED });
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
        const summary = {
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
    async getShipMaintenanceHistory(shipId, options) {
        return this.getMaintenanceSchedules({ shipId, status: [ShipMaintenance_1.MaintenanceStatus.COMPLETED, ShipMaintenance_1.MaintenanceStatus.CANCELLED] }, options);
    }
    async scheduleRecurringMaintenance(data, intervalDays, occurrences) {
        logger_1.logger.info('ShipMaintenanceService.scheduleRecurringMaintenance', {
            shipId: data.shipId,
            intervalDays,
            occurrences
        });
        const schedules = [];
        const currentDate = new Date(data.scheduledDate);
        for (let i = 0; i < occurrences; i++) {
            const maintenance = await this.scheduleMaintenance({
                ...data,
                scheduledDate: new Date(currentDate)
            });
            schedules.push(maintenance);
            currentDate.setDate(currentDate.getDate() + intervalDays);
        }
        return schedules;
    }
    async deleteMaintenance(id) {
        const maintenance = await this.getMaintenanceById(id);
        if (!maintenance) {
            return false;
        }
        if (maintenance.status === ShipMaintenance_1.MaintenanceStatus.IN_PROGRESS ||
            maintenance.status === ShipMaintenance_1.MaintenanceStatus.COMPLETED ||
            maintenance.status === ShipMaintenance_1.MaintenanceStatus.OVERDUE) {
            logger_1.logger.warn('ShipMaintenanceService.deleteMaintenance: Cannot delete in-progress, completed, or overdue maintenance', { id, status: maintenance.status });
            return false;
        }
        await this.maintenanceRepository.delete(id);
        return true;
    }
    async updateOverdueStatuses() {
        const now = new Date();
        const result = await this.maintenanceRepository
            .createQueryBuilder()
            .update(ShipMaintenance_1.ShipMaintenance)
            .set({ status: ShipMaintenance_1.MaintenanceStatus.OVERDUE })
            .where('scheduledDate < :now', { now })
            .andWhere('status = :scheduled', { scheduled: ShipMaintenance_1.MaintenanceStatus.SCHEDULED })
            .execute();
        if (result.affected && result.affected > 0) {
            logger_1.logger.info('ShipMaintenanceService.updateOverdueStatuses', {
                count: result.affected
            });
        }
        return result.affected || 0;
    }
}
exports.ShipMaintenanceService = ShipMaintenanceService;
//# sourceMappingURL=ShipMaintenanceService.js.map