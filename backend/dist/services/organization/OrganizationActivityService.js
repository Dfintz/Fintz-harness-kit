"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationActivityService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationActivity_1 = require("../../models/OrganizationActivity");
const User_1 = require("../../models/User");
class OrganizationActivityService {
    activityRepository = data_source_1.AppDataSource.getRepository(OrganizationActivity_1.OrganizationActivity);
    organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    async logActivity(activityData) {
        if (activityData.actorId && !activityData.actorName) {
            const actor = await this.userRepository.findOne({
                where: { id: activityData.actorId }
            });
            if (actor) {
                activityData.actorName = actor.username || actor.email;
            }
        }
        if (activityData.targetUserId && !activityData.targetUserName) {
            const targetUser = await this.userRepository.findOne({
                where: { id: activityData.targetUserId }
            });
            if (targetUser) {
                activityData.targetUserName = targetUser.username || targetUser.email;
            }
        }
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
            severity: activityData.severity || OrganizationActivity_1.ActivitySeverity.INFO,
            actorType: activityData.actorType || 'user',
            requiresReview: activityData.requiresReview || false,
            reviewed: activityData.reviewed || false
        });
        return this.activityRepository.save(activity);
    }
    async logOrgCreated(orgId, actorId, orgData) {
        return this.logActivity({
            organizationId: orgId,
            action: OrganizationActivity_1.OrgActivityAction.ORG_CREATED,
            actorId,
            actorType: 'user',
            description: `Organization "${orgData.name}" created`,
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            after: orgData
        });
    }
    async logOrgUpdated(orgId, actorId, before, after) {
        return this.logActivity({
            organizationId: orgId,
            action: OrganizationActivity_1.OrgActivityAction.ORG_UPDATED,
            actorId,
            actorType: 'user',
            description: 'Organization updated',
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            before,
            after
        });
    }
    async logOrgDeleted(orgId, actorId, orgData) {
        return this.logActivity({
            organizationId: orgId,
            action: OrganizationActivity_1.OrgActivityAction.ORG_DELETED,
            actorId,
            actorType: 'user',
            description: `Organization "${orgData.name}" deleted`,
            severity: OrganizationActivity_1.ActivitySeverity.WARNING,
            before: orgData
        });
    }
    async logMemberAdded(orgId, actorId, userId, role) {
        return this.logActivity({
            organizationId: orgId,
            action: OrganizationActivity_1.OrgActivityAction.MEMBER_ADDED,
            actorId,
            actorType: 'user',
            targetUserId: userId,
            description: `Member added with role: ${role}`,
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            metadata: { role }
        });
    }
    async logMemberRemoved(orgId, actorId, userId) {
        return this.logActivity({
            organizationId: orgId,
            action: OrganizationActivity_1.OrgActivityAction.MEMBER_REMOVED,
            actorId,
            actorType: 'user',
            targetUserId: userId,
            description: 'Member removed from organization',
            severity: OrganizationActivity_1.ActivitySeverity.INFO
        });
    }
    async logMemberRoleChanged(orgId, actorId, userId, oldRole, newRole) {
        return this.logActivity({
            organizationId: orgId,
            action: OrganizationActivity_1.OrgActivityAction.MEMBER_ROLE_CHANGED,
            actorId,
            actorType: 'user',
            targetUserId: userId,
            description: `Role changed from ${oldRole} to ${newRole}`,
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            before: { role: oldRole },
            after: { role: newRole }
        });
    }
    async logPermissionGranted(orgId, actorId, userId, permission) {
        return this.logActivity({
            organizationId: orgId,
            action: OrganizationActivity_1.OrgActivityAction.PERMISSION_GRANTED,
            actorId,
            actorType: 'user',
            targetUserId: userId,
            description: 'Permission granted',
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            after: permission
        });
    }
    async logSettingsUpdated(orgId, actorId, before, after) {
        return this.logActivity({
            organizationId: orgId,
            action: OrganizationActivity_1.OrgActivityAction.SETTINGS_UPDATED,
            actorId,
            actorType: 'user',
            description: 'Organization settings updated',
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            before: before,
            after: after
        });
    }
    async logSecurityEvent(orgId, action, actorId, description, severity = OrganizationActivity_1.ActivitySeverity.WARNING) {
        return this.logActivity({
            organizationId: orgId,
            action,
            actorId,
            actorType: 'user',
            description,
            severity,
            requiresReview: severity === OrganizationActivity_1.ActivitySeverity.CRITICAL || severity === OrganizationActivity_1.ActivitySeverity.ERROR
        });
    }
    async getActivityById(id) {
        return this.activityRepository.findOne({
            where: { id },
            relations: ['organization', 'actor']
        });
    }
    async getOrganizationActivities(orgId, filters, pagination) {
        const queryBuilder = this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.organizationId = :orgId', { orgId })
            .leftJoinAndSelect('activity.actor', 'actor');
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
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        queryBuilder.skip((page - 1) * limit).take(limit);
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
    async getActivitiesByActor(actorId, pagination) {
        const queryBuilder = this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.actorId = :actorId', { actorId })
            .leftJoinAndSelect('activity.organization', 'organization');
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
    async getActivitiesRequiringReview(orgId, pagination) {
        const queryBuilder = this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.requiresReview = true')
            .andWhere('activity.reviewed = false')
            .leftJoinAndSelect('activity.organization', 'organization')
            .leftJoinAndSelect('activity.actor', 'actor');
        if (orgId) {
            queryBuilder.andWhere('activity.organizationId = :orgId', { orgId });
        }
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
    async getRecentActivities(orgId, limit = 10) {
        return this.activityRepository.find({
            where: { organizationId: orgId },
            order: { timestamp: 'DESC' },
            take: limit,
            relations: ['actor']
        });
    }
    async getCriticalActivities(orgId, daysBack = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        return this.activityRepository.find({
            where: {
                organizationId: orgId,
                severity: OrganizationActivity_1.ActivitySeverity.CRITICAL,
                timestamp: (0, typeorm_1.MoreThanOrEqual)(cutoffDate)
            },
            order: { timestamp: 'DESC' },
            relations: ['actor']
        });
    }
    async markAsReviewed(activityId, reviewerId) {
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
    async bulkMarkAsReviewed(activityIds, reviewerId) {
        const result = await this.activityRepository
            .createQueryBuilder()
            .update(OrganizationActivity_1.OrganizationActivity)
            .set({
            reviewed: true,
            reviewedBy: reviewerId,
            reviewedAt: new Date()
        })
            .where('id IN (:...activityIds)', { activityIds })
            .execute();
        return result.affected || 0;
    }
    async addTags(activityId, tags) {
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
    async deleteOldActivities(orgId, daysToKeep = 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await this.activityRepository.delete({
            organizationId: orgId,
            timestamp: (0, typeorm_1.LessThanOrEqual)(cutoffDate),
            severity: (0, typeorm_1.In)([OrganizationActivity_1.ActivitySeverity.INFO])
        });
        return result.affected || 0;
    }
    async getActivitySummary(orgId, daysBack = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                timestamp: (0, typeorm_1.MoreThanOrEqual)(cutoffDate)
            },
            relations: ['actor']
        });
        const activitiesByAction = {};
        for (const activity of activities) {
            activitiesByAction[activity.action] =
                (activitiesByAction[activity.action] || 0) + 1;
        }
        const activitiesBySeverity = {};
        for (const activity of activities) {
            activitiesBySeverity[activity.severity] =
                (activitiesBySeverity[activity.severity] || 0) + 1;
        }
        const actorCounts = {};
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
        const recentCritical = activities
            .filter(a => a.severity === OrganizationActivity_1.ActivitySeverity.CRITICAL)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 5);
        const needsReview = activities.filter(a => a.requiresReview && !a.reviewed).length;
        return {
            totalActivities: activities.length,
            activitiesByAction,
            activitiesBySeverity,
            topActors,
            recentCritical,
            needsReview
        };
    }
    async getActivityAnalytics(orgId, daysBack = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                timestamp: (0, typeorm_1.MoreThanOrEqual)(cutoffDate)
            }
        });
        const activitiesByDay = {};
        for (const activity of activities) {
            const day = activity.timestamp.toISOString().split('T')[0];
            activitiesByDay[day] = (activitiesByDay[day] || 0) + 1;
        }
        const actionCounts = {};
        for (const activity of activities) {
            actionCounts[activity.action] = (actionCounts[activity.action] || 0) + 1;
        }
        const mostCommonActions = Object.entries(actionCounts)
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const errors = activities.filter(a => a.severity === OrganizationActivity_1.ActivitySeverity.ERROR || a.severity === OrganizationActivity_1.ActivitySeverity.CRITICAL).length;
        const errorRate = activities.length > 0 ? (errors / activities.length) * 100 : 0;
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
    async exportActivities(orgId, filters) {
        const response = await this.getOrganizationActivities(orgId, filters, {
            page: 1,
            limit: 10000
        });
        const activities = response.data;
        const headers = [
            'Timestamp',
            'Action',
            'Severity',
            'Actor',
            'Target User',
            'Description',
            'Reviewed'
        ];
        const rows = activities.map(activity => [
            activity.timestamp.toISOString(),
            activity.action,
            activity.severity,
            activity.actorName || 'System',
            activity.targetUserName || '',
            activity.description || activity.getSummary(),
            activity.reviewed ? 'Yes' : 'No'
        ]);
        const csvLines = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
        return csvLines.join('\n');
    }
}
exports.OrganizationActivityService = OrganizationActivityService;
//# sourceMappingURL=OrganizationActivityService.js.map