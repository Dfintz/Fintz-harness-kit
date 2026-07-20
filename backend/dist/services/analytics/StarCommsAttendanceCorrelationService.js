"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarCommsAttendanceCorrelationService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const EventAttendanceConfirmation_1 = require("../../models/EventAttendanceConfirmation");
const ExternalIntegration_1 = require("../../models/ExternalIntegration");
const logger_1 = require("../../utils/logger");
const StarCommsAdapter_1 = require("../communication/starcomms/StarCommsAdapter");
const ExternalIntegrationService_1 = require("../external/ExternalIntegrationService");
const FleetService_1 = require("../fleet/FleetService");
class StarCommsAttendanceCorrelationService {
    activityRepository;
    confirmationRepository;
    participantRepository;
    fleetService;
    integrationService;
    starCommsAdapter;
    constructor(fleetService = new FleetService_1.FleetService(), integrationService = new ExternalIntegrationService_1.ExternalIntegrationService(), starCommsAdapter = new StarCommsAdapter_1.StarCommsAdapter()) {
        this.activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
        this.confirmationRepository = data_source_1.AppDataSource.getRepository(EventAttendanceConfirmation_1.EventAttendanceConfirmation);
        this.participantRepository = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
        this.fleetService = fleetService;
        this.integrationService = integrationService;
        this.starCommsAdapter = starCommsAdapter;
    }
    async getReport(organizationId, filters = {}) {
        const { activities, startDate, endDate } = await this.loadActivities(organizationId, filters);
        const activityIds = activities.map(activity => activity.id);
        const [confirmations, participants, starComms] = await Promise.all([
            this.loadConfirmations(organizationId, activityIds),
            this.loadParticipants(activityIds),
            this.resolveStarCommsSnapshot(organizationId, startDate, endDate),
        ]);
        const confirmationMap = this.groupConfirmations(confirmations);
        const participantMap = this.groupParticipants(participants);
        const rows = activities.map(activity => {
            const activityConfirmations = confirmationMap.get(activity.id) ?? [];
            const stats = this.calculateAttendanceStats(activityConfirmations);
            const participantRows = participantMap.get(activity.id) ?? [];
            const topRoles = this.summarizeRoles(participantRows);
            return {
                activityId: activity.id,
                activityTitle: activity.title,
                activityType: activity.activityType,
                activityStatus: activity.status,
                activityAnchorDate: this.resolveActivityAnchorDate(activity).toISOString(),
                scheduledStartDate: activity.scheduledStartDate?.toISOString(),
                scheduledEndDate: activity.scheduledEndDate?.toISOString(),
                totalConfirmations: stats.total,
                attended: stats.attended,
                late: stats.late,
                earlyDeparture: stats.earlyDeparture,
                noShow: stats.noShow,
                pending: stats.pending,
                attendanceRate: stats.attendanceRate,
                participantCount: participantRows.length,
                topRoles,
                starCommsMetrics: starComms.metrics,
            };
        });
        const totals = rows.reduce((accumulator, row) => {
            accumulator.totalConfirmations += row.totalConfirmations;
            accumulator.attended += row.attended;
            accumulator.late += row.late;
            accumulator.earlyDeparture += row.earlyDeparture;
            accumulator.noShow += row.noShow;
            accumulator.pending += row.pending;
            return accumulator;
        }, {
            totalConfirmations: 0,
            attended: 0,
            late: 0,
            earlyDeparture: 0,
            noShow: 0,
            pending: 0,
        });
        const effectiveAttendance = totals.attended + totals.late + totals.earlyDeparture;
        return {
            organizationId,
            generatedAt: new Date().toISOString(),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalActivities: rows.length,
            totalConfirmations: totals.totalConfirmations,
            attended: totals.attended,
            late: totals.late,
            earlyDeparture: totals.earlyDeparture,
            noShow: totals.noShow,
            pending: totals.pending,
            attendanceRate: totals.totalConfirmations > 0
                ? Math.round((effectiveAttendance / totals.totalConfirmations) * 100)
                : 0,
            starComms,
            activities: rows,
        };
    }
    async getActivityReport(organizationId, activityId) {
        return this.getReport(organizationId, { activityId });
    }
    toCsv(report) {
        const lines = [
            ['organizationId', report.organizationId],
            ['generatedAt', report.generatedAt],
            ['startDate', report.startDate],
            ['endDate', report.endDate],
            ['totalActivities', String(report.totalActivities)],
            ['totalConfirmations', String(report.totalConfirmations)],
            ['attendanceRate', String(report.attendanceRate)],
            ['starCommsAvailable', String(report.starComms.available)],
        ].map(([key, value]) => `${this.escapeCsvValue(key)},${this.escapeCsvValue(value)}`);
        lines.push('', [
            'activityId',
            'activityTitle',
            'activityType',
            'activityStatus',
            'activityAnchorDate',
            'totalConfirmations',
            'attended',
            'late',
            'earlyDeparture',
            'noShow',
            'pending',
            'attendanceRate',
            'participantCount',
            'topRoles',
            'starCommsAttendanceRate',
            'starCommsActiveParticipants',
            'starCommsAvgSessionMinutes',
        ].join(','));
        for (const row of report.activities) {
            lines.push([
                row.activityId,
                row.activityTitle,
                row.activityType,
                row.activityStatus,
                row.activityAnchorDate,
                row.totalConfirmations,
                row.attended,
                row.late,
                row.earlyDeparture,
                row.noShow,
                row.pending,
                row.attendanceRate,
                row.participantCount,
                row.topRoles.map(role => `${role.role}:${role.count}`).join('|'),
                row.starCommsMetrics?.attendanceRate ?? '',
                row.starCommsMetrics?.activeParticipants ?? '',
                row.starCommsMetrics?.avgSessionMinutes ?? '',
            ]
                .map(value => this.escapeCsvValue(String(value)))
                .join(','));
        }
        return `${lines.join('\n')}\n`;
    }
    async loadActivities(organizationId, filters) {
        const endDate = filters.endDate ?? new Date();
        const startDate = filters.startDate ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        const query = this.activityRepository
            .createQueryBuilder('activity')
            .where('activity."organizationId" = :organizationId', { organizationId })
            .orderBy('COALESCE(activity."scheduledEndDate", activity."scheduledStartDate", activity."createdAt")', 'ASC');
        if (filters.activityId) {
            query.andWhere('activity.id = :activityId', { activityId: filters.activityId });
        }
        else {
            query
                .andWhere('COALESCE(activity."scheduledEndDate", activity."scheduledStartDate", activity."createdAt") >= :startDate', {
                startDate,
            })
                .andWhere('COALESCE(activity."scheduledEndDate", activity."scheduledStartDate", activity."createdAt") <= :endDate', {
                endDate,
            });
        }
        const activities = await query.getMany();
        return {
            activities: activities.map(activity => ({
                id: activity.id,
                title: activity.title,
                activityType: activity.activityType,
                status: activity.status,
                scheduledStartDate: activity.scheduledStartDate,
                scheduledEndDate: activity.scheduledEndDate,
                createdAt: activity.createdAt,
            })),
            startDate,
            endDate,
        };
    }
    async loadConfirmations(organizationId, activityIds) {
        if (activityIds.length === 0) {
            return [];
        }
        return this.confirmationRepository
            .createQueryBuilder('confirmation')
            .select('confirmation.eventId', 'eventId')
            .addSelect('confirmation.status', 'status')
            .addSelect('confirmation.userId', 'userId')
            .where('confirmation.organizationId = :organizationId', { organizationId })
            .andWhere('confirmation.eventId IN (:...activityIds)', { activityIds })
            .getRawMany();
    }
    async loadParticipants(activityIds) {
        if (activityIds.length === 0) {
            return [];
        }
        return this.participantRepository
            .createQueryBuilder('participant')
            .select('participant.activityId', 'activityId')
            .addSelect('participant.role', 'role')
            .addSelect('participant.status', 'status')
            .where('participant.activityId IN (:...activityIds)', { activityIds })
            .andWhere('participant.status = :status', { status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED })
            .getRawMany();
    }
    async resolveStarCommsSnapshot(organizationId, startDate, endDate) {
        try {
            const integration = await this.findStarCommsIntegration(organizationId);
            if (!integration) {
                return { available: false };
            }
            const config = this.starCommsAdapter.buildConnectionConfig(integration);
            const windowMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
            const metrics = await this.starCommsAdapter.getMetricsWindow(config, {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                windowMinutes,
            });
            return {
                available: true,
                integration: {
                    integrationId: integration.id,
                    fleetId: integration.fleetId,
                    fleetName: integration.fleetName,
                    integrationName: integration.name,
                },
                metrics,
            };
        }
        catch (error) {
            logger_1.logger.warn('StarComms attendance correlation metrics unavailable', {
                error,
                organizationId,
            });
            return {
                available: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async findStarCommsIntegration(organizationId) {
        const fleets = await this.fleetService.getAllFleets(organizationId);
        for (const fleet of fleets) {
            const integrations = await this.integrationService.getIntegrations(fleet.id);
            const starCommsIntegration = integrations.find(integration => integration.enabled &&
                integration.type === ExternalIntegration_1.IntegrationType.STARCOMMS &&
                Boolean(integration.starCommsConfig?.baseUrl));
            if (starCommsIntegration) {
                return Object.assign(starCommsIntegration, { fleetName: fleet.name });
            }
        }
        return null;
    }
    groupConfirmations(confirmations) {
        const groups = new Map();
        for (const confirmation of confirmations) {
            const rows = groups.get(confirmation.eventId) ?? [];
            rows.push(confirmation);
            groups.set(confirmation.eventId, rows);
        }
        return groups;
    }
    groupParticipants(participants) {
        const groups = new Map();
        for (const participant of participants) {
            const rows = groups.get(participant.activityId) ?? [];
            rows.push(participant);
            groups.set(participant.activityId, rows);
        }
        return groups;
    }
    calculateAttendanceStats(confirmations) {
        const stats = {
            total: confirmations.length,
            attended: 0,
            late: 0,
            earlyDeparture: 0,
            noShow: 0,
            pending: 0,
            attendanceRate: 0,
        };
        for (const confirmation of confirmations) {
            if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.ATTENDED) {
                stats.attended++;
            }
            else if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.LATE) {
                stats.late++;
            }
            else if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.EARLY_DEPARTURE) {
                stats.earlyDeparture++;
            }
            else if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.NO_SHOW) {
                stats.noShow++;
            }
            else {
                stats.pending++;
            }
        }
        const actuallyAttended = stats.attended + stats.late + stats.earlyDeparture;
        stats.attendanceRate = stats.total > 0 ? Math.round((actuallyAttended / stats.total) * 100) : 0;
        return stats;
    }
    summarizeRoles(participants) {
        const roleCounts = new Map();
        for (const participant of participants) {
            const role = participant.role || 'member';
            roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
        }
        return Array.from(roleCounts.entries())
            .map(([role, count]) => ({ role, count }))
            .sort((left, right) => right.count - left.count || left.role.localeCompare(right.role));
    }
    resolveActivityAnchorDate(activity) {
        return activity.scheduledEndDate ?? activity.scheduledStartDate ?? activity.createdAt;
    }
    escapeCsvValue(value) {
        if (value.includes('"') ||
            value.includes(',') ||
            value.includes('\n') ||
            value.includes('\r')) {
            return `"${value.replaceAll('"', '""')}"`;
        }
        return value;
    }
}
exports.StarCommsAttendanceCorrelationService = StarCommsAttendanceCorrelationService;
//# sourceMappingURL=StarCommsAttendanceCorrelationService.js.map