import { Request, Response } from 'express';
import { SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks, selectFieldsFromArray } from '../../middleware/queryParser';
import { Activity, ActivityType } from '../../models/Activity';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

/**
 * Apply visibility constraints to an activity query builder.
 * Users see: public/listed, their own org, activities they created, or participating orgs.
 */
function applyVisibilityFilter(
  queryBuilder: SelectQueryBuilder<Activity>,
  filters: Record<string, unknown>,
  userId?: string,
  userOrgId?: string
): void {
  if (filters.visibility) {
    queryBuilder.andWhere('activity.visibility = :visFilter', {
      visFilter: filters.visibility,
    });
    return;
  }

  const visConds = ["activity.visibility IN ('public', 'listed')"];
  const visParams: Record<string, string> = {};

  if (userId) {
    visConds.push('activity.creatorId = :visUserId');
    visParams.visUserId = userId;
  }
  if (userOrgId) {
    visConds.push(
      'activity.organizationId = :visOrgId',
      'activity.participatingOrgs::text LIKE :visOrgPattern'
    );
    visParams.visOrgId = userOrgId;
    visParams.visOrgPattern = `%${userOrgId}%`;
  }

  queryBuilder.andWhere(`(${visConds.join(' OR ')})`, visParams);
}

/**
 * GET /api/v2/activities
 * Search activities with visibility filtering.
 * Users only see: public/listed activities, activities from their org,
 * activities they created, and activities they're participating in.
 */
export async function searchActivitiesHandler(req: Request, res: Response): Promise<void> {
  const { limit, offset, sort, filters, search, fields } = req.queryParams ?? {
    limit: 20,
    offset: 0,
    sort: null,
    filters: {},
    search: null,
    fields: null,
  };

  const userId = (req as AuthRequest).user?.id;
  const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

  const activityRepo = AppDataSource.getRepository(Activity);
  const queryBuilder = activityRepo.createQueryBuilder('activity');

  // Exclude internal recruitment activities from general search
  queryBuilder.andWhere('activity.activityType != :excludedType', {
    excludedType: ActivityType.RECRUITMENT,
  });

  // Apply visibility constraints based on user context
  applyVisibilityFilter(queryBuilder, filters, userId, userOrgId);

  // Add filters
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

  // Apply sorting (allowlist to prevent SQL injection via column name)
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
  } else {
    queryBuilder.orderBy('activity.scheduledStartDate', 'DESC');
  }

  // Get total count
  const total = await queryBuilder.getCount();

  // Apply pagination
  queryBuilder.skip(offset).take(limit);

  // Execute query
  const activities = await queryBuilder.getMany();

  // Apply field selection without mutating the original results
  const filteredActivities =
    fields && Array.isArray(fields) && fields.length > 0
      ? selectFieldsFromArray(activities, fields)
      : activities;

  // Build HATEOAS links
  const links = buildHateoasLinks(req.path, offset, limit, total);

  res.paginated(
    filteredActivities,
    {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    links
  );
}

/**
 * GET /api/v2/users/me/activities
 * Get activities for the current user.
 */
export async function getMyActivitiesHandler(req: Request, res: Response): Promise<void> {
  const userId = (req as AuthRequest).user?.id;

  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
  }

  const { limit, offset } = req.queryParams ?? { limit: 20, offset: 0 };

  try {
    const activityRepo = AppDataSource.getRepository(Activity);

    // Find activities where user is creator or participant (exclude internal recruitment)
    const queryBuilder = activityRepo
      .createQueryBuilder('activity')
      .where('activity.creatorId = :userId', { userId })
      .andWhere('activity.activityType != :excludedType', {
        excludedType: ActivityType.RECRUITMENT,
      })
      .orderBy('activity.scheduledStartDate', 'DESC');

    const total = await queryBuilder.getCount();
    queryBuilder.skip(offset).take(limit);

    const activities = await queryBuilder.getMany();

    const links = buildHateoasLinks(req.path, offset, limit, total);

    res.paginated(
      activities,
      {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      links
    );
  } catch (error: unknown) {
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to fetch user activities'),
      500
    );
  }
}

/**
 * GET /api/v2/activities/statistics
 * Get activity statistics.
 */
export async function getActivityStatisticsHandler(req: Request, res: Response): Promise<void> {
  const organizationId = req.tenantContext?.organizationId;

  try {
    const activityRepo = AppDataSource.getRepository(Activity);
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
      byStatus: (byStatus as { status: string; count: string }[]).reduce(
        (acc: Record<string, number>, curr) => {
          acc[curr.status] = Number.parseInt(curr.count);
          return acc;
        },
        {}
      ),
      byType: (byType as { type: string; count: string }[]).reduce(
        (acc: Record<string, number>, curr) => {
          acc[curr.type] = Number.parseInt(curr.count);
          return acc;
        },
        {}
      ),
    };

    res.success(statistics);
  } catch (error: unknown) {
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to fetch statistics'),
      500
    );
  }
}
