import crypto from 'node:crypto';

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Activity, ActivityStatus } from '../../models/Activity';
import { ActivityParticipantStatus } from '../../models/ActivityParticipant';
import type { ActivityParticipantService } from '../../services/activity/ActivityParticipantService';
import { ActivityAggregatorService } from '../../services/aggregators/ActivityAggregatorService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

import type { JoinByTokenBody } from './activityController.types';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

type QuickJoinDeps = {
  findActivityById: (id: string) => Promise<Activity | null>;
  getCompletionActivityForUser: (
    req: Request,
    activityId: string,
    userId: string
  ) => Promise<Activity>;
  findActivityByQuickJoinToken: (token: string) => Promise<Activity | null>;
  validateQuickJoinActivity: (activity: Activity) => void;
  organizationServiceCanUserAccessOrganization: (
    userId: string,
    organizationId: string
  ) => Promise<{ canAccess: boolean; accessLevel?: string; reason?: string }>;
  getParticipantCount: (activityId: string, status: ActivityParticipantStatus) => Promise<number>;
  isParticipant: (activityId: string, userId: string) => Promise<boolean>;
  joinActivityByToken: (
    activityId: string,
    input: Parameters<ActivityParticipantService['joinActivity']>[1]
  ) => Promise<{ activity: Activity }>;
};

/**
 * POST /api/v2/organizations/:orgId/activities/create-full
 * Create an activity with participants and notifications via aggregator
 */
export async function createActivityFullHandler(
  req: Request,
  res: Response,
  deps: Pick<QuickJoinDeps, 'organizationServiceCanUserAccessOrganization'>
): Promise<void> {
  try {
    const { orgId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const orgAccess = await deps.organizationServiceCanUserAccessOrganization(userId, orgId);
    if (!orgAccess.canAccess || orgAccess.accessLevel === 'viewer') {
      throw new ApiError(
        ApiErrorCode.FORBIDDEN,
        orgAccess.reason ?? 'User cannot create activities in this organization',
        403
      );
    }

    const { activityData, participantIds, notifyParticipants, postToDiscord, discordChannelId } =
      req.body as {
        activityData?: Record<string, unknown>;
        participantIds?: string[];
        notifyParticipants?: boolean;
        postToDiscord?: boolean;
        discordChannelId?: string;
      };

    const aggregator = new ActivityAggregatorService();
    const result = await aggregator.createActivityWithParticipants({
      organizationId: orgId,
      activityData: { ...activityData, creatorId: userId } as Parameters<
        typeof aggregator.createActivityWithParticipants
      >[0]['activityData'],
      participantIds,
      notifyParticipants,
      postToDiscord,
      discordChannelId,
    });

    res.status(201).success(result);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to create activity with participants'),
      500
    );
  }
}

/**
 * POST /api/v2/activities/:id/complete-full
 * Complete an activity with attendance tracking and notifications via aggregator
 */
export async function completeActivityFullHandler(
  req: Request,
  res: Response,
  deps: Pick<QuickJoinDeps, 'getCompletionActivityForUser'>
): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const activity = await deps.getCompletionActivityForUser(req, activityId, userId);

    if (activity.creatorId !== userId) {
      throw new ApiError(
        ApiErrorCode.FORBIDDEN,
        'Only activity creator can complete the activity',
        403
      );
    }

    const { outcome, summary, participantReports, notifyParticipants } = req.body as {
      outcome?: 'success' | 'failed' | 'cancelled';
      summary?: string;
      participantReports?: Array<{ userId: string; attended: boolean; contribution?: string }>;
      notifyParticipants?: boolean;
    };

    const aggregator: ActivityAggregatorService = new ActivityAggregatorService();

    if (!activity.organizationId) {
      res.success(
        await aggregator.completePersonalActivity({
          activity,
          completedById: userId,
          outcome,
          summary,
          participantReports,
          notifyParticipants,
        })
      );
      return;
    }

    const result = await aggregator.completeActivity({
      organizationId: activity.organizationId,
      activityId,
      completedById: userId,
      outcome,
      summary,
      participantReports,
      notifyParticipants,
    });

    res.success(result);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to complete activity'),
      500
    );
  }
}

/**
 * POST /api/v2/activities/:id/join-link
 * Generate a quick-join link for an activity
 */
export async function generateJoinLinkHandler(
  req: Request,
  res: Response,
  deps: Pick<QuickJoinDeps, 'findActivityById'>
): Promise<void> {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;

  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
  }

  try {
    const activityRepo = AppDataSource.getRepository(Activity);
    const activity = await deps.findActivityById(id);

    if (!activity) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
    }

    // Only the creator or an org admin can generate join links
    if (activity.creatorId !== userId) {
      throw new ApiError(
        ApiErrorCode.FORBIDDEN,
        'Only the activity creator can generate join links',
        403
      );
    }

    if (
      activity.status === ActivityStatus.CANCELLED ||
      activity.status === ActivityStatus.COMPLETED
    ) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Cannot generate join links for cancelled or completed activities',
        400
      );
    }

    // Generate secure token (16 bytes = 128 bits, base64url = 22 chars)
    // Short enough for URLs, strong enough to resist brute-force over 7-day TTL
    const token = crypto.randomBytes(16).toString('base64url');
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    activity.metadata = {
      ...activity.metadata,
      quickJoin: true,
      quickJoinToken: token,
      quickJoinTokenExpiry: expiry.toISOString(),
    };

    await activityRepo.save(activity);

    res.status(201);
    res.success({
      token,
      expiresAt: expiry.toISOString(),
    });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to generate join link'),
      500
    );
  }
}

/**
 * GET /api/v2/activities/join/:token
 * Preview an activity by quick-join token (no auth required)
 */
export async function previewActivityByTokenHandler(
  req: Request,
  res: Response,
  deps: Pick<QuickJoinDeps, 'findActivityByQuickJoinToken' | 'getParticipantCount'>
): Promise<void> {
  const { token } = req.params;

  try {
    const activity = await deps.findActivityByQuickJoinToken(token);

    if (!activity) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Invalid or expired join link', 404);
    }

    // Check token expiry
    if (activity.metadata?.quickJoinTokenExpiry) {
      const expiry = new Date(activity.metadata.quickJoinTokenExpiry);
      if (expiry < new Date()) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'This join link has expired', 410);
      }
    }

    if (
      activity.status === ActivityStatus.CANCELLED ||
      activity.status === ActivityStatus.COMPLETED
    ) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'This activity is no longer accepting participants',
        400
      );
    }

    // Return safe preview — strip sensitive data
    const acceptedCount = await deps.getParticipantCount(
      activity.id,
      ActivityParticipantStatus.ACCEPTED
    );
    res.success({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      type: activity.activityType,
      status: activity.status,
      scheduledStart: activity.scheduledStartDate,
      scheduledEnd: activity.scheduledEndDate,
      location: activity.location,
      maxParticipants: activity.maxParticipants,
      currentParticipants: acceptedCount,
      organizationId: activity.organizationId,
    });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to preview activity'),
      500
    );
  }
}

/**
 * POST /api/v2/activities/join/:token
 * Join an activity via quick-join token
 */
export async function joinActivityByTokenHandler(
  req: Request,
  res: Response,
  deps: Pick<
    QuickJoinDeps,
    | 'findActivityByQuickJoinToken'
    | 'validateQuickJoinActivity'
    | 'isParticipant'
    | 'joinActivityByToken'
  >
): Promise<void> {
  const { token } = req.params;
  const userId = (req as AuthRequest).user?.id;
  const userName = (req as AuthRequest).user?.username ?? 'Unknown';

  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
  }

  const { role, shipId, shipType, shipName, notes } = req.body as JoinByTokenBody;

  try {
    const activity = await deps.findActivityByQuickJoinToken(token);

    if (!activity) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Invalid or expired join link', 404);
    }

    deps.validateQuickJoinActivity(activity);

    // Check if already a participant (normalized table lookup)
    const alreadyJoined = await deps.isParticipant(activity.id, userId);
    if (alreadyJoined) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'User is already a participant', 400);
    }

    // Delegate to the service for the actual join
    const { activity: updatedActivity } = await deps.joinActivityByToken(activity.id, {
      userId,
      userName,
      role,
      shipId,
      shipType,
      shipName,
      notes,
    });

    res.status(201);
    res.success(updatedActivity);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to join activity via token'),
      500
    );
  }
}
