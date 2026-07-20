import { StarCommsAdapter } from '../communication/starcomms/StarCommsAdapter';
import { StarCommsMetricsSnapshot } from '../communication/starcomms/StarCommsTypes';
import { ExternalIntegrationService } from '../external/ExternalIntegrationService';
import { FleetService } from '../fleet/FleetService';
export interface StarCommsAttendanceCorrelationFilters {
    activityId?: string;
    startDate?: Date;
    endDate?: Date;
}
export interface CorrelationIntegrationSnapshot {
    integrationId: string;
    fleetId: string;
    fleetName: string;
    integrationName: string;
}
export interface CorrelationActivityRow {
    activityId: string;
    activityTitle: string;
    activityType: string;
    activityStatus: string;
    activityAnchorDate: string;
    scheduledStartDate?: string;
    scheduledEndDate?: string;
    totalConfirmations: number;
    attended: number;
    late: number;
    earlyDeparture: number;
    noShow: number;
    pending: number;
    attendanceRate: number;
    participantCount: number;
    topRoles: Array<{
        role: string;
        count: number;
    }>;
    starCommsMetrics?: StarCommsMetricsSnapshot;
}
export interface StarCommsAttendanceCorrelationReport {
    organizationId: string;
    generatedAt: string;
    startDate: string;
    endDate: string;
    totalActivities: number;
    totalConfirmations: number;
    attended: number;
    late: number;
    earlyDeparture: number;
    noShow: number;
    pending: number;
    attendanceRate: number;
    starComms: {
        available: boolean;
        integration?: CorrelationIntegrationSnapshot;
        metrics?: StarCommsMetricsSnapshot;
        error?: string;
    };
    activities: CorrelationActivityRow[];
}
export declare class StarCommsAttendanceCorrelationService {
    private readonly activityRepository;
    private readonly confirmationRepository;
    private readonly participantRepository;
    private readonly fleetService;
    private readonly integrationService;
    private readonly starCommsAdapter;
    constructor(fleetService?: FleetService, integrationService?: ExternalIntegrationService, starCommsAdapter?: StarCommsAdapter);
    getReport(organizationId: string, filters?: StarCommsAttendanceCorrelationFilters): Promise<StarCommsAttendanceCorrelationReport>;
    getActivityReport(organizationId: string, activityId: string): Promise<StarCommsAttendanceCorrelationReport>;
    toCsv(report: StarCommsAttendanceCorrelationReport): string;
    private loadActivities;
    private loadConfirmations;
    private loadParticipants;
    private resolveStarCommsSnapshot;
    private findStarCommsIntegration;
    private groupConfirmations;
    private groupParticipants;
    private calculateAttendanceStats;
    private summarizeRoles;
    private resolveActivityAnchorDate;
    private escapeCsvValue;
}
//# sourceMappingURL=StarCommsAttendanceCorrelationService.d.ts.map