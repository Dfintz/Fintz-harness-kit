import { Organization } from '../../models/Organization';
import { ActivityFilter, ActivitySeverity, OrgActivityAction, OrganizationActivity } from '../../models/OrganizationActivity';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface ActivitySummary {
    totalActivities: number;
    activitiesByAction: Record<string, number>;
    activitiesBySeverity: Record<string, number>;
    topActors: Array<{
        actorId: string;
        actorName: string;
        count: number;
    }>;
    recentCritical: OrganizationActivity[];
    needsReview: number;
}
export interface ActivityAnalytics {
    period: string;
    totalActivities: number;
    activitiesByDay: Record<string, number>;
    mostCommonActions: Array<{
        action: string;
        count: number;
    }>;
    errorRate: number;
    reviewedRate: number;
}
export declare class OrganizationActivityService {
    private activityRepository;
    private organizationRepository;
    private userRepository;
    logActivity(activityData: Partial<OrganizationActivity>): Promise<OrganizationActivity>;
    logOrgCreated(orgId: string, actorId: string, orgData: Partial<Organization>): Promise<OrganizationActivity>;
    logOrgUpdated(orgId: string, actorId: string, before: Partial<Organization>, after: Partial<Organization>): Promise<OrganizationActivity>;
    logOrgDeleted(orgId: string, actorId: string, orgData: Partial<Organization>): Promise<OrganizationActivity>;
    logMemberAdded(orgId: string, actorId: string, userId: string, role: string): Promise<OrganizationActivity>;
    logMemberRemoved(orgId: string, actorId: string, userId: string): Promise<OrganizationActivity>;
    logMemberRoleChanged(orgId: string, actorId: string, userId: string, oldRole: string, newRole: string): Promise<OrganizationActivity>;
    logPermissionGranted(orgId: string, actorId: string, userId: string, permission: Record<string, unknown>): Promise<OrganizationActivity>;
    logSettingsUpdated(orgId: string, actorId: string, before: unknown, after: unknown): Promise<OrganizationActivity>;
    logSecurityEvent(orgId: string, action: OrgActivityAction, actorId: string, description: string, severity?: ActivitySeverity): Promise<OrganizationActivity>;
    getActivityById(id: string): Promise<OrganizationActivity | null>;
    getOrganizationActivities(orgId: string, filters?: ActivityFilter, pagination?: PaginationOptions): Promise<PaginatedResponse<OrganizationActivity>>;
    getActivitiesByActor(actorId: string, pagination?: PaginationOptions): Promise<PaginatedResponse<OrganizationActivity>>;
    getActivitiesRequiringReview(orgId?: string, pagination?: PaginationOptions): Promise<PaginatedResponse<OrganizationActivity>>;
    getRecentActivities(orgId: string, limit?: number): Promise<OrganizationActivity[]>;
    getCriticalActivities(orgId: string, daysBack?: number): Promise<OrganizationActivity[]>;
    markAsReviewed(activityId: string, reviewerId: string): Promise<OrganizationActivity>;
    bulkMarkAsReviewed(activityIds: string[], reviewerId: string): Promise<number>;
    addTags(activityId: string, tags: string[]): Promise<OrganizationActivity>;
    deleteOldActivities(orgId: string, daysToKeep?: number): Promise<number>;
    getActivitySummary(orgId: string, daysBack?: number): Promise<ActivitySummary>;
    getActivityAnalytics(orgId: string, daysBack?: number): Promise<ActivityAnalytics>;
    exportActivities(orgId: string, filters?: ActivityFilter): Promise<string>;
}
//# sourceMappingURL=OrganizationActivityService.d.ts.map