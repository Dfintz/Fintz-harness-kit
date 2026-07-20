import type { OrgSCStatsAnalytics } from '@sc-fleet-manager/shared-types';
export type { OrgSCStatsAnalytics } from '@sc-fleet-manager/shared-types';
export declare class SCStatsOrgAnalyticsService {
    private readonly preferencesRepo;
    private readonly membershipRepo;
    constructor();
    getOrgAnalytics(organizationId: string): Promise<OrgSCStatsAnalytics>;
    private calculateCareerAnalytics;
    private aggregateCareerEntries;
    private bucketFlightHours;
    private emptyAnalytics;
}
//# sourceMappingURL=SCStatsOrgAnalyticsService.d.ts.map