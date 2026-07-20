import { StarCommsAttendanceCorrelationFilters, StarCommsAttendanceCorrelationReport } from './StarCommsAttendanceCorrelationService';
interface TrendDataPoint {
    date: string;
    count: number;
}
interface CrewFormationTrends {
    period: AnalyticsPeriod;
    trends: TrendDataPoint[];
    totalFormations: number;
    averagePerPeriod: number;
}
interface FormationSpeedStats {
    averageMinutes: number;
    medianMinutes: number;
    fastestMinutes: number;
    slowestMinutes: number;
    distribution: Array<{
        bucket: string;
        count: number;
    }>;
}
interface PlacementMetrics {
    totalJobs: number;
    completedJobs: number;
    placementRate: number;
    averagePlacementDays: number;
    byType: Array<{
        type: string;
        total: number;
        completed: number;
        rate: number;
    }>;
    trend: TrendDataPoint[];
}
interface LfgConversionMetrics {
    totalLfg: number;
    converted: number;
    conversionRate: number;
    averageGroupSize: number;
    trend: TrendDataPoint[];
    byActivity: Array<{
        activity: string;
        total: number;
        converted: number;
        rate: number;
    }>;
}
export interface CrossSystemAnalytics {
    crewFormation: CrewFormationTrends;
    formationSpeed: FormationSpeedStats;
    jobPlacement: PlacementMetrics;
    lfgConversion: LfgConversionMetrics;
    generatedAt: string;
}
type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';
export declare class CrossSystemAnalyticsService {
    private readonly activityRepo;
    private readonly attendanceCorrelationService;
    private resolveTimeBucket;
    getAnalytics(period?: AnalyticsPeriod, orgId?: string, startDate?: Date, endDate?: Date): Promise<CrossSystemAnalytics>;
    getAttendanceCorrelationReport(organizationId: string, filters?: StarCommsAttendanceCorrelationFilters): Promise<StarCommsAttendanceCorrelationReport>;
    getActivityAttendanceCorrelationReport(organizationId: string, activityId: string): Promise<StarCommsAttendanceCorrelationReport>;
    formatAttendanceCorrelationCsv(report: StarCommsAttendanceCorrelationReport): string;
    getCrewFormationTrends(period: AnalyticsPeriod, orgId?: string, from?: Date, to?: Date): Promise<CrewFormationTrends>;
    getFormationSpeedStats(orgId?: string, from?: Date, to?: Date): Promise<FormationSpeedStats>;
    getJobPlacementMetrics(orgId?: string, from?: Date, to?: Date, period?: AnalyticsPeriod): Promise<PlacementMetrics>;
    getLfgConversionMetrics(orgId?: string, from?: Date, to?: Date, period?: AnalyticsPeriod): Promise<LfgConversionMetrics>;
}
export {};
//# sourceMappingURL=CrossSystemAnalyticsService.d.ts.map