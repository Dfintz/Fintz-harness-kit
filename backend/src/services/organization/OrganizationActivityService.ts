import { In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import { ActivityFilter, ActivitySeverity, OrgActivityAction, OrganizationActivity } from '../../models/OrganizationActivity';
import { User } from '../../models/User';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';

/**
 * Activity summary for dashboard/reporting
 */
export interface ActivitySummary {
    totalActivities: number;
    activitiesByAction: Record<string, number>;
    activitiesBySeverity: Record<string, number>;
    topActors: Array<{ actorId: string; actorName: string; count: number }>;
    recentCritical: OrganizationActivity[];
    needsReview: number;
}

/**
 * Activity analytics for trends
 */
export interface ActivityAnalytics {
    period: string;
    totalActivities: number;
    activitiesByDay: Record<string, number>;
    mostCommonActions: Array<{ action: string; count: number }>;
    errorRate: number;
    reviewedRate: number;
}

/**
 * Service for managing organization activity logging
 * Handles audit trail, activity tracking, and analytics
 */
export class OrganizationActivityService {
    private activityRepository = AppDataSource.getRepository(OrganizationActivity);
    private organizationRepository = AppDataSource.getRepository(Organization);
    private userRepository = AppDataSource.getRepository(User);

    // ==================== ACTIVITY LOGGING ====================

    /**
     * Log an activity
     * @param activityData Activity data
     * @returns Created activity
     */
    async logActivity(
        activityData: Partial<OrganizationActivity>
    ): Promise<OrganizationActivity> {
        // Fetch actor name if not provided
        if (activityData.actorId && !activityData.actorName) {
            const actor = await this.userRepository.findOne({
                where: { id: activityData.actorId }
            });
            if (actor) {
                activityData.actorName = actor.username || actor.email;
            }
        }

        // Fetch target user name if not provided
        if (activityData.targetUserId && !activityData.targetUserName) {
            const targetUser = await this.userRepository.findOne({
                where: { id: activityData.targetUserId }
            });
            if (targetUser) {
                activityData.targetUserName = targetUser.username || targetUser.email;
            }
        }

        // Fetch target org name if not provided
        if (activityData.targetOrgId && !activityData.targetOrgName) {
            const targetOrg = await this.organizationRepository.findOne({
                where: { id: activityData.targetOrgId }
            });
            if (targetOrg) {
                activityData.targetOrgName = targetOrg.name;
            }
        }

        const activity = this.activityRepository.create({
            ...activityData,
            timestamp: activityData.timestamp || new Date(),
            severity: activityData.severity || ActivitySeverity.INFO,
            actorType: activityData.actorType || 'user',
            requiresReview: activityData.requiresReview || false,
            reviewed: activityData.reviewed || false
        });

        return this.activityRepository.save(activity);
    }

    /**
     * Log organization created
     * @param orgId Organization ID
     * @param actorId User who created
     * @param orgData Organization data
     */
    async logOrgCreated(
        orgId: string,
        actorId: string,
        orgData: Partial<Organization>
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action: OrgActivityAction.ORG_CREATED,
            actorId,
            actorType: 'user',
            description: `Organization "${orgData.name}" created`,
            severity: ActivitySeverity.INFO,
            after: orgData
        });
    }

    /**
     * Log organization updated
     * @param orgId Organization ID
     * @param actorId User who updated
     * @param before State before update
     * @param after State after update
     */
    async logOrgUpdated(
        orgId: string,
        actorId: string,
        before: Partial<Organization>,
        after: Partial<Organization>
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action: OrgActivityAction.ORG_UPDATED,
            actorId,
            actorType: 'user',
            description: 'Organization updated',
            severity: ActivitySeverity.INFO,
            before,
            after
        });
    }

    /**
     * Log organization deleted
     * @param orgId Organization ID
     * @param actorId User who deleted
     * @param orgData Organization data
     */
    async logOrgDeleted(
        orgId: string,
        actorId: string,
        orgData: Partial<Organization>
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action: OrgActivityAction.ORG_DELETED,
            actorId,
            actorType: 'user',
            description: `Organization "${orgData.name}" deleted`,
            severity: ActivitySeverity.WARNING,
            before: orgData
        });
    }

    /**
     * Log member added
     * @param orgId Organization ID
     * @param actorId User who added member
     * @param userId User being added
     * @param role Role assigned
     */
    async logMemberAdded(
        orgId: string,
        actorId: string,
        userId: string,
        role: string
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action: OrgActivityAction.MEMBER_ADDED,
            actorId,
            actorType: 'user',
            targetUserId: userId,
            description: `Member added with role: ${role}`,
            severity: ActivitySeverity.INFO,
            metadata: { role }
        });
    }

    /**
     * Log member removed
     * @param orgId Organization ID
     * @param actorId User who removed member
     * @param userId User being removed
     */
    async logMemberRemoved(
        orgId: string,
        actorId: string,
        userId: string
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action: OrgActivityAction.MEMBER_REMOVED,
            actorId,
            actorType: 'user',
            targetUserId: userId,
            description: 'Member removed from organization',
            severity: ActivitySeverity.INFO
        });
    }

    /**
     * Log member role changed
     * @param orgId Organization ID
     * @param actorId User who changed role
     * @param userId User whose role changed
     * @param oldRole Previous role
     * @param newRole New role
     */
    async logMemberRoleChanged(
        orgId: string,
        actorId: string,
        userId: string,
        oldRole: string,
        newRole: string
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action: OrgActivityAction.MEMBER_ROLE_CHANGED,
            actorId,
            actorType: 'user',
            targetUserId: userId,
            description: `Role changed from ${oldRole} to ${newRole}`,
            severity: ActivitySeverity.INFO,
            before: { role: oldRole },
            after: { role: newRole }
        });
    }

    /**
     * Log permission granted
     * @param orgId Organization ID
     * @param actorId User who granted permission
     * @param userId User receiving permission
     * @param permission Permission details
     */
    async logPermissionGranted(
        orgId: string,
        actorId: string,
        userId: string,
        permission: Record<string, unknown>
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action: OrgActivityAction.PERMISSION_GRANTED,
            actorId,
            actorType: 'user',
            targetUserId: userId,
            description: 'Permission granted',
            severity: ActivitySeverity.INFO,
            after: permission
        });
    }

    /**
     * Log settings updated
     * @param orgId Organization ID
     * @param actorId User who updated settings
     * @param before Settings before
     * @param after Settings after
     */
    async logSettingsUpdated(
        orgId: string,
        actorId: string,
        before: unknown,
        after: unknown
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action: OrgActivityAction.SETTINGS_UPDATED,
            actorId,
            actorType: 'user',
            description: 'Organization settings updated',
            severity: ActivitySeverity.INFO,
            before: before as Record<string, unknown> | undefined,
            after: after as Record<string, unknown> | undefined
        });
    }

    /**
     * Log security event
     * @param orgId Organization ID
     * @param action Security action
     * @param actorId User involved
     * @param description Event description
     * @param severity Event severity
     */
    async logSecurityEvent(
        orgId: string,
        action: OrgActivityAction,
        actorId: string,
        description: string,
        severity: ActivitySeverity = ActivitySeverity.WARNING
    ): Promise<OrganizationActivity> {
        return this.logActivity({
            organizationId: orgId,
            action,
            actorId,
            actorType: 'user',
            description,
            severity,
            requiresReview: severity === ActivitySeverity.CRITICAL || severity === ActivitySeverity.ERROR
        });
    }

    // ==================== ACTIVITY RETRIEVAL ====================

    /**
     * Get activity by ID
     * @param id Activity ID
     * @returns Activity or null
     */
    async getActivityById(id: string): Promise<OrganizationActivity | null> {
        return this.activityRepository.findOne({
            where: { id },
            relations: ['organization', 'actor']
        });
    }

    /**
     * Get organization activities
     * @param orgId Organization ID
     * @param filters Activity filters
     * @param pagination Pagination options
     * @returns Paginated activities
     */
    async getOrganizationActivities(
        orgId: string,
        filters?: ActivityFilter,
        pagination?: PaginationOptions
    ): Promise<PaginatedResponse<OrganizationActivity>> {
        const queryBuilder = this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.organizationId = :orgId', { orgId })
            .leftJoinAndSelect('activity.actor', 'actor');

        // Apply filters
        if (filters) {
            if (filters.actions && filters.actions.length > 0) {
                queryBuilder.andWhere('activity.action IN (:...actions)', {
                    actions: filters.actions
                });
            }

            if (filters.actorIds && filters.actorIds.length > 0) {
                queryBuilder.andWhere('activity.actorId IN (:...actorIds)', {
                    actorIds: filters.actorIds
                });
            }

            if (filters.severity && filters.severity.length > 0) {
                queryBuilder.andWhere('activity.severity IN (:...severity)', {
                    severity: filters.severity
                });
            }

            if (filters.startDate) {
                queryBuilder.andWhere('activity.timestamp >= :startDate', {
                    startDate: filters.startDate
                });
            }

            if (filters.endDate) {
                queryBuilder.andWhere('activity.timestamp <= :endDate', {
                    endDate: filters.endDate
                });
            }

            if (filters.targetUserId) {
                queryBuilder.andWhere('activity.targetUserId = :targetUserId', {
                    targetUserId: filters.targetUserId
                });
            }

            if (filters.targetOrgId) {
                queryBuilder.andWhere('activity.targetOrgId = :targetOrgId', {
                    targetOrgId: filters.targetOrgId
                });
            }

            if (filters.resourceType) {
                queryBuilder.andWhere('activity.resourceType = :resourceType', {
                    resourceType: filters.resourceType
                });
            }

            if (filters.requiresReview !== undefined) {
                queryBuilder.andWhere('activity.requiresReview = :requiresReview', {
                    requiresReview: filters.requiresReview
                });
            }

            if (filters.reviewed !== undefined) {
                queryBuilder.andWhere('activity.reviewed = :reviewed', {
                    reviewed: filters.reviewed
                });
            }

            if (filters.tags && filters.tags.length > 0) {
                queryBuilder.andWhere('activity.tags && :tags', {
                    tags: filters.tags
                });
            }
        }

        // Apply pagination
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        queryBuilder.skip((page - 1) * limit).take(limit);

        // Sort by timestamp descending (newest first)
        const sortBy = pagination?.sortBy || 'timestamp';
        const sortOrder = pagination?.sortOrder || 'DESC';
        queryBuilder.orderBy(`activity.${sortBy}`, sortOrder);

        const [data, total] = await queryBuilder.getManyAndCount();

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    }

    /**
     * Get activities by actor
     * @param actorId Actor user ID
     * @param pagination Pagination options
     * @returns Paginated activities
     */
    async getActivitiesByActor(
        actorId: string,
        pagination?: PaginationOptions
    ): Promise<PaginatedResponse<OrganizationActivity>> {
        const queryBuilder = this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.actorId = :actorId', { actorId })
            .leftJoinAndSelect('activity.organization', 'organization');

        // Apply pagination
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        queryBuilder.skip((page - 1) * limit).take(limit);

        queryBuilder.orderBy('activity.timestamp', 'DESC');

        const [data, total] = await queryBuilder.getManyAndCount();

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    }

    /**
     * Get activities requiring review
     * @param orgId Organization ID (optional)
     * @param pagination Pagination options
     * @returns Paginated activities
     */
    async getActivitiesRequiringReview(
        orgId?: string,
        pagination?: PaginationOptions
    ): Promise<PaginatedResponse<OrganizationActivity>> {
        const queryBuilder = this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.requiresReview = true')
            .andWhere('activity.reviewed = false')
            .leftJoinAndSelect('activity.organization', 'organization')
            .leftJoinAndSelect('activity.actor', 'actor');

        if (orgId) {
            queryBuilder.andWhere('activity.organizationId = :orgId', { orgId });
        }

        // Apply pagination
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        queryBuilder.skip((page - 1) * limit).take(limit);

        queryBuilder.orderBy('activity.timestamp', 'DESC');

        const [data, total] = await queryBuilder.getManyAndCount();

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    }

    /**
     * Get recent activities
     * @param orgId Organization ID
     * @param limit Number of activities to retrieve
     * @returns Array of recent activities
     */
    async getRecentActivities(
        orgId: string,
        limit: number = 10
    ): Promise<OrganizationActivity[]> {
        return this.activityRepository.find({
            where: { organizationId: orgId },
            order: { timestamp: 'DESC' },
            take: limit,
            relations: ['actor']
        });
    }

    /**
     * Get critical activities
     * @param orgId Organization ID
     * @param daysBack Days to look back
     * @returns Array of critical activities
     */
    async getCriticalActivities(
        orgId: string,
        daysBack: number = 7
    ): Promise<OrganizationActivity[]> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        return this.activityRepository.find({
            where: {
                organizationId: orgId,
                severity: ActivitySeverity.CRITICAL,
                timestamp: MoreThanOrEqual(cutoffDate)
            },
            order: { timestamp: 'DESC' },
            relations: ['actor']
        });
    }

    // ==================== ACTIVITY MANAGEMENT ====================

    /**
     * Mark activity as reviewed
     * @param activityId Activity ID
     * @param reviewerId User who reviewed
     * @returns Updated activity
     */
    async markAsReviewed(
        activityId: string,
        reviewerId: string
    ): Promise<OrganizationActivity> {
        const activity = await this.activityRepository.findOne({
            where: { id: activityId }
        });

        if (!activity) {
            throw new Error('Activity not found');
        }

        activity.reviewed = true;
        activity.reviewedBy = reviewerId;
        activity.reviewedAt = new Date();

        return this.activityRepository.save(activity);
    }

    /**
     * Bulk mark activities as reviewed
     * @param activityIds Array of activity IDs
     * @param reviewerId User who reviewed
     * @returns Number of activities updated
     */
    async bulkMarkAsReviewed(
        activityIds: string[],
        reviewerId: string
    ): Promise<number> {
        const result = await this.activityRepository
            .createQueryBuilder()
            .update(OrganizationActivity)
            .set({
                reviewed: true,
                reviewedBy: reviewerId,
                reviewedAt: new Date()
            })
            .where('id IN (:...activityIds)', { activityIds })
            .execute();

        return result.affected || 0;
    }

    /**
     * Add tags to activity
     * @param activityId Activity ID
     * @param tags Tags to add
     * @returns Updated activity
     */
    async addTags(
        activityId: string,
        tags: string[]
    ): Promise<OrganizationActivity> {
        const activity = await this.activityRepository.findOne({
            where: { id: activityId }
        });

        if (!activity) {
            throw new Error('Activity not found');
        }

        const currentTags = activity.tags || [];
        const uniqueTags = Array.from(new Set([...currentTags, ...tags]));
        activity.tags = uniqueTags;

        return this.activityRepository.save(activity);
    }

    /**
     * Delete old activities
     * @param orgId Organization ID
     * @param daysToKeep Days of activities to keep
     * @returns Number of deleted activities
     */
    async deleteOldActivities(
        orgId: string,
        daysToKeep: number = 365
    ): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await this.activityRepository.delete({
            organizationId: orgId,
            timestamp: LessThanOrEqual(cutoffDate),
            severity: In([ActivitySeverity.INFO]) // Only delete info-level activities
        });

        return result.affected || 0;
    }

    // ==================== ACTIVITY ANALYTICS ====================

    /**
     * Get activity summary for organization
     * @param orgId Organization ID
     * @param daysBack Days to analyze
     * @returns Activity summary
     */
    async getActivitySummary(
        orgId: string,
        daysBack: number = 30
    ): Promise<ActivitySummary> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                timestamp: MoreThanOrEqual(cutoffDate)
            },
            relations: ['actor']
        });

        // Count by action
        const activitiesByAction: Record<string, number> = {};
        for (const activity of activities) {
            activitiesByAction[activity.action] =
                (activitiesByAction[activity.action] || 0) + 1;
        }

        // Count by severity
        const activitiesBySeverity: Record<string, number> = {};
        for (const activity of activities) {
            activitiesBySeverity[activity.severity] =
                (activitiesBySeverity[activity.severity] || 0) + 1;
        }

        // Top actors
        const actorCounts: Record<string, { name: string; count: number }> = {};
        for (const activity of activities) {
            if (activity.actorId) {
                if (!actorCounts[activity.actorId]) {
                    actorCounts[activity.actorId] = {
                        name: activity.actorName || 'Unknown',
                        count: 0
                    };
                }
                actorCounts[activity.actorId].count++;
            }
        }

        const topActors = Object.entries(actorCounts)
            .map(([actorId, data]) => ({
                actorId,
                actorName: data.name,
                count: data.count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Recent critical
        const recentCritical = activities
            .filter(a => a.severity === ActivitySeverity.CRITICAL)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 5);

        // Activities needing review
        const needsReview = activities.filter(
            a => a.requiresReview && !a.reviewed
        ).length;

        return {
            totalActivities: activities.length,
            activitiesByAction,
            activitiesBySeverity,
            topActors,
            recentCritical,
            needsReview
        };
    }

    /**
     * Get activity analytics
     * @param orgId Organization ID
     * @param daysBack Days to analyze
     * @returns Activity analytics
     */
    async getActivityAnalytics(
        orgId: string,
        daysBack: number = 30
    ): Promise<ActivityAnalytics> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                timestamp: MoreThanOrEqual(cutoffDate)
            }
        });

        // Activities by day
        const activitiesByDay: Record<string, number> = {};
        for (const activity of activities) {
            const day = activity.timestamp.toISOString().split('T')[0];
            activitiesByDay[day] = (activitiesByDay[day] || 0) + 1;
        }

        // Most common actions
        const actionCounts: Record<string, number> = {};
        for (const activity of activities) {
            actionCounts[activity.action] = (actionCounts[activity.action] || 0) + 1;
        }

        const mostCommonActions = Object.entries(actionCounts)
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Error rate
        const errors = activities.filter(
            a => a.severity === ActivitySeverity.ERROR || a.severity === ActivitySeverity.CRITICAL
        ).length;
        const errorRate = activities.length > 0 ? (errors / activities.length) * 100 : 0;

        // Reviewed rate
        const reviewable = activities.filter(a => a.requiresReview).length;
        const reviewed = activities.filter(a => a.requiresReview && a.reviewed).length;
        const reviewedRate = reviewable > 0 ? (reviewed / reviewable) * 100 : 100;

        return {
            period: `${daysBack} days`,
            totalActivities: activities.length,
            activitiesByDay,
            mostCommonActions,
            errorRate,
            reviewedRate
        };
    }

    /**
     * Export activities to CSV format
     * @param orgId Organization ID
     * @param filters Activity filters
     * @returns CSV string
     */
    async exportActivities(
        orgId: string,
        filters?: ActivityFilter
    ): Promise<string> {
        const response = await this.getOrganizationActivities(orgId, filters, {
            page: 1,
            limit: 10000 // Large limit for export
        });

        const activities = response.data;

        // Create CSV header
        const headers = [
            'Timestamp',
            'Action',
            'Severity',
            'Actor',
            'Target User',
            'Description',
            'Reviewed'
        ];

        // Create CSV rows
        const rows = activities.map(activity => [
            activity.timestamp.toISOString(),
            activity.action,
            activity.severity,
            activity.actorName || 'System',
            activity.targetUserName || '',
            activity.description || activity.getSummary(),
            activity.reviewed ? 'Yes' : 'No'
        ]);

        // Combine header and rows
        const csvLines = [headers, ...rows].map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        );

        return csvLines.join('\n');
    }
}

