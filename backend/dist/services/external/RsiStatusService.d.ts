export interface RsiComponentStatus {
    name: string;
    status: string;
}
export interface RsiIncident {
    title: string;
    link: string;
    pubDate: string;
    description: string;
    resolved: boolean;
    category?: string;
}
export interface RsiStatusSnapshot {
    components: RsiComponentStatus[];
    overallStatus: string;
    latestIncident: RsiIncident | null;
    fetchedAt: Date;
}
export declare class RsiStatusService {
    private static instance;
    private cache;
    private constructor();
    static getInstance(): RsiStatusService;
    getStatus(): Promise<RsiStatusSnapshot>;
    invalidateCache(): void;
    private fetchComponentStatuses;
    private parseComponentStatuses;
    private extractStatusFromTextSummary;
    private extractStatusNearComponentName;
    private extractStatusToken;
    private toCanonicalStatus;
    private fetchLatestIncident;
    private parseLatestIncident;
}
export declare const rsiStatusService: RsiStatusService;
//# sourceMappingURL=RsiStatusService.d.ts.map