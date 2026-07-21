import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Activity, ActivityStatus } from '../../models/Activity';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { getOrganizationId } from '../../utils/tenantHelpers';
import {
  emitActivityCreated,
  emitActivityDeleted,
  emitActivityUpdated,
} from '../../websocket/controllers/activityWebSocketController';

import type { BatchCreateBody, BatchDeleteBody, BatchUpdateBody } from './activityController.types';

type BatchOperationDeps = {
  findActivityById: (id: string) => Promise<Activity | null>;
};

export async function batchCreateActivitiesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const { activities } = req.body as BatchCreateBody;

    if (!Array.isArray(activities) || activities.length === 0) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Activities array is required', 400);
    }

    if (activities.length > 50) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'Maximum 50 activities can be created at once',
        400
      );
    }

    const activityRepo = AppDataSource.getRepository(Activity);
    const createdActivities: Activity[] = [];

    for (const activityData of activities) {
      const status =
        Object.values(ActivityStatus).find(value => value === activityData.status) ??
        ActivityStatus.OPEN;
      const activity = activityRepo.create({
        ...activityData,
        organizationId: orgId,
        status,
      });

      const saved = await activityRepo.save(activity);
      createdActivities.push(saved);

      // Emit WebSocket event for each
      emitActivityCreated(orgId, saved as unknown as Record<string, unknown>);
    }

    res.status(201).success({
      message: `${createdActivities.length} activities created successfully`,
      count: createdActivities.length,
      activities: createdActivities.map(a => ({
        id: a.id,
        title: a.title,
        status: a.status,
      })),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to batch create activities'),
      500
    );
  }
}

export async function batchUpdateActivitiesHandler(
  req: Request,
  res: Response,
  deps: BatchOperationDeps
): Promise<void> {
  try {
    const { updates } = req.body as BatchUpdateBody;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Updates array is required', 400);
    }

    if (updates.length > 50) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'Maximum 50 activities can be updated at once',
        400
      );
    }

    const activityRepo = AppDataSource.getRepository(Activity);
    const updatedActivities = [];
    const organizationId = getOrganizationId(req);

    for (const update of updates) {
      const { id, ...updateData } = update;

      if (!id) {
        continue;
      }

      const activity = await deps.findActivityById(id);
      if (activity?.organizationId !== organizationId) {
        continue;
      }

      Object.assign(activity, updateData);
      const saved = await activityRepo.save(activity);
      updatedActivities.push(saved);

      // Emit WebSocket event for each
      emitActivityUpdated(saved.organizationId ?? '', saved as unknown as Record<string, unknown>);
    }

    res.success({
      message: `${updatedActivities.length} activities updated successfully`,
      count: updatedActivities.length,
      activities: updatedActivities.map(a => ({
        id: a.id,
        title: a.title,
        status: a.status,
      })),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to batch update activities'),
      500
    );
  }
}

export async function batchDeleteActivitiesHandler(
  req: Request,
  res: Response,
  deps: BatchOperationDeps
): Promise<void> {
  try {
    const { activityIds } = req.body as BatchDeleteBody;

    if (!Array.isArray(activityIds) || activityIds.length === 0) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Activity IDs array is required', 400);
    }

    if (activityIds.length > 50) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'Maximum 50 activities can be deleted at once',
        400
      );
    }

    const activityRepo = AppDataSource.getRepository(Activity);
    let deletedCount = 0;
    const organizationId = getOrganizationId(req);

    for (const id of activityIds) {
      const activity = await deps.findActivityById(id);
      if (activity?.organizationId !== organizationId) {
        continue;
      }

      const orgId = activity.organizationId;
      await activityRepo.remove(activity);
      deletedCount++;

      // Emit WebSocket event for each
      emitActivityDeleted(orgId, id);
    }

    res.success({
      message: `${deletedCount} activities deleted successfully`,
      count: deletedCount,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to batch delete activities'),
      500
    );
  }
}
