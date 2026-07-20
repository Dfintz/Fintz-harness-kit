import { IncidentSeverity, IncidentStatus, IncidentType, ModerationIncident } from '../../models/ModerationIncident';
import { TenantService } from '../base/TenantService';
export declare const REPEAT_OFFENDER_THRESHOLDS: {
    minIncidents: number;
    windowDays: number;
    minSeverity: number;
    highRiskThreshold: number;
};
export interface AnalyticsPeriod {
    startDate: Date;
    endDate: Date;
    label: string;
}
export interface TrendDataPoint {
    date: string;
    count: number;
    label?: string;
}
export interface RepeatOffender {
    targetDiscordId: string;
    targetUsername?: string;
    totalIncidents: number;
    activeIncidents: number;
    highestSeverity: IncidentSeverity;
    firstIncident: Date;
    lastIncident: Date;
    incidentsByType: Record<IncidentType, number>;
    riskScore: number;
    isHighRisk: boolean;
}
export interface ModerationAnalytics {
    totalIncidents: number;
    activeIncidents: number;
    resolvedIncidents: number;
    sharedIncidents: number;
    autoDetectedIncidents: number;
    byType: Record<IncidentType, number>;
    bySeverity: Record<IncidentSeverity, number>;
    byStatus: Record<IncidentStatus, number>;
    dailyTrend: TrendDataPoint[];
    weeklyTrend: TrendDataPoint[];
    monthlyTrend: TrendDataPoint[];
    uniqueTargets: number;
    uniqueModerators: number;
    averageSeverity: number;
    repeatOffenders: RepeatOffender[];
    repeatOffenderCount: number;
    mirrorStats: {
        totalMirrors: number;
        confirmedMirrors: number;
        pendingMirrors: number;
        cancelledMirrors: number;
        failedMirrors: number;
    };
    incidentsLast24Hours: number;
    incidentsLast7Days: number;
    incidentsLast30Days: number;
    generatedAt: Date;
}
export declare class BlacklistAnalyticsService extends TenantService<ModerationIncident> {
    private static instance;
    private _mirrorRepository?;
    private get mirrorRepository();
    constructor();
    static getInstance(): BlacklistAnalyticsService;
    getAnalytics(organizationId: string): Promise<ModerationAnalytics>;
    private emptyAnalytics;
    private analyzeTargetIncidents;
    getRepeatOffenders(organizationId: string): Promise<RepeatOffender[]>;
    isRepeatOffender(organizationId: string, targetDiscordId: string): Promise<{
        isRepeatOffender: boolean;
        details?: RepeatOffender;
    }>;
    private calculateRiskScore;
    private calculateDailyTrend;
    private calculateWeeklyTrend;
    private calculateMonthlyTrend;
    private getWeekStart;
    private getMirrorStatistics;
    private initializeByType;
    private initializeBySeverity;
    private initializeByStatus;
}
//# sourceMappingURL=BlacklistAnalyticsService.d.ts.map