"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchActivitiesHandler = searchActivitiesHandler;
exports.getMyActivitiesHandler = getMyActivitiesHandler;
exports.getActivityStatisticsHandler = getActivityStatisticsHandler;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const Activity_1 = require("../../models/Activity");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
function applyVisibilityFilter(queryBuilder, filters, userId, userOrgId) {
    if (filters.visibility) {
        queryBuilder.andWhere('activity.visibility = :visFilter', {
            visFilter: filters.visibility,
        });
        return;
    }
    const visConds = ["activity.visibility IN ('public', 'listed')"];
    const visParams = {};
    if (userId) {
        visConds.push('activity.creatorId = :visUserId');
        visParams.visUserId = userId;
    }
    if (userOrgId) {
        visConds.push('activity.organizationId = :visOrgId', 'activity.participatingOrgs::text LIKE :visOrgPattern');
        visParams.visOrgId = userOrgId;
        visParams.visOrgPattern = `%${userOrgId}%`;
    }
    queryBuilder.andWhere(`(${visConds.join(' OR ')})`, visParams);
}
async function searchActivitiesHandler(req, res) {
    const { limit, offset, sort, filters, search, fields } = req.queryParams ?? {
        limit: 20,
        offset: 0,
        sort: null,
        filters: {},
        search: null,
        fields: null,
    };
    const userId = req.user?.id;
    const userOrgId = req.user?.currentOrganizationId;
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const queryBuilder = activityRepo.createQueryBuilder('activity');
    queryBuilder.andWhere('activity.activityType != :excludedType', {
        excludedType: Activity_1.ActivityType.RECRUITMENT,
    });
    applyVisibilityFilter(queryBuilder, filters, userId, userOrgId);
    if (filters.status) {
        queryBuilder.andWhere('activity.status = :status', { status: filters.status });
    }
    if (filters.type) {
        queryBuilder.andWhere('activity.activityType = :type', { type: filters.type });
    }
    if (filters.organizationId) {
        queryBuilder.andWhere('activity.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (search) {
        queryBuilder.andWhere('(activity.title ILIKE :search OR activity.description ILIKE :search)', {
            search: `%${search}%`,
        });
    }
    const SEARCH_SORT_FIELDS = new Set([
        'createdAt',
        'updatedAt',
        'scheduledStartDate',
        'title',
        'status',
        'activityType',
    ]);
    if (sort && 'field' in sort && 'order' in sort) {
        const safeField = SEARCH_SORT_FIELDS.has(sort.field) ? sort.field : 'scheduledStartDate';
        queryBuilder.orderBy(`activity.${safeField}`, sort.order);
    }
    else {
        queryBuilder.orderBy('activity.scheduledStartDate', 'DESC');
    }
    const total = await queryBuilder.getCount();
    queryBuilder.skip(offset).take(limit);
    const activities = await queryBuilder.getMany();
    const filteredActivities = fields && Array.isArray(fields) && fields.length > 0
        ? (0, queryParser_1.selectFieldsFromArray)(activities, fields)
        : activities;
    const links = (0, queryParser_1.buildHateoasLinks)(req.path, offset, limit, total);
    res.paginated(filteredActivities, {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
    }, links);
}
async function getMyActivitiesHandler(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }
    const { limit, offset } = req.queryParams ?? { limit: 20, offset: 0 };
    try {
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const queryBuilder = activityRepo
            .createQueryBuilder('activity')
            .where('activity.creatorId = :userId', { userId })
            .andWhere('activity.activityType != :excludedType', {
            excludedType: Activity_1.ActivityType.RECRUITMENT,
        })
            .orderBy('activity.scheduledStartDate', 'DESC');
        const total = await queryBuilder.getCount();
        queryBuilder.skip(offset).take(limit);
        const activities = await queryBuilder.getMany();
        const links = (0, queryParser_1.buildHateoasLinks)(req.path, offset, limit, total);
        res.paginated(activities, {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
        }, links);
    }
    catch (error) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch user activities'), 500);
    }
}
async function getActivityStatisticsHandler(req, res) {
    const organizationId = req.tenantContext?.organizationId;
    try {
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const queryBuilder = activityRepo.createQueryBuilder('activity');
        if (organizationId) {
            queryBuilder.where('activity.organizationId = :organizationId', { organizationId });
        }
        const [total, byStatus, byType] = await Promise.all([
            queryBuilder.getCount(),
            queryBuilder
                .select('activity.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .groupBy('activity.status')
                .getRawMany(),
            queryBuilder
                .select('activity.activityType', 'type')
                .addSelect('COUNT(*)', 'count')
                .groupBy('activity.activityType')
                .getRawMany(),
        ]);
        const statistics = {
            total,
            byStatus: byStatus.reduce((acc, curr) => {
                acc[curr.status] = Number.parseInt(curr.count);
                return acc;
            }, {}),
            byType: byType.reduce((acc, curr) => {
                acc[curr.type] = Number.parseInt(curr.count);
                return acc;
            }, {}),
        };
        res.success(statistics);
    }
    catch (error) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch statistics'), 500);
    }
}
//# sourceMappingURL=activityController.searchDiscovery.js.map