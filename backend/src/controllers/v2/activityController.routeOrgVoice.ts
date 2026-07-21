import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import type { RouteWaypoint } from '../../models/Activity';
import type { ActivityService } from '../../services/activity/ActivityService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

import type { InviteOrgBody } from './activityController.types';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

export type ActivityControllerRouteOrgVoiceHandler = (req: Request, res: Response) => Promise<void>;

async function getActivityServiceInstance(): Promise<ActivityService> {
  const { ActivityService } = await import('../../services/activity/ActivityService');
  return new ActivityService();
}

export async function addRoutePlanHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { waypoints } = req.body as { waypoints?: RouteWaypoint[] };

    if (!waypoints || !Array.isArray(waypoints)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Waypoints array is required', 400);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.addRoutePlan(activityId, userId, waypoints);

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to add route plan'),
      500
    );
  }
}

export async function updateWaypointHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId, order } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const waypointOrder = Number.parseInt(order);
    if (Number.isNaN(waypointOrder)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid waypoint order', 400);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.updateWaypoint(
      activityId,
      userId,
      waypointOrder,
      req.body as Partial<RouteWaypoint>
    );

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to update waypoint'),
      500
    );
  }
}

export async function enrichWithMiningDataHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const activityService = await getActivityServiceInstance();
    const activity = await activityService.enrichWithMiningData(activityId);

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to enrich mining data'),
      500
    );
  }
}

export async function inviteOrganizationHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;
    const { organizationId, organizationName, role } = req.body as InviteOrgBody;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    if (!organizationId || !organizationName) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Organization ID and name are required',
        400
      );
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.inviteOrganization(
      activityId,
      organizationId,
      organizationName,
      userId,
      role ?? 'participant'
    );

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to invite organization'),
      500
    );
  }
}

export async function acceptOrganizationInviteHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;
    const organizationId = (req as AuthRequest).user?.currentOrganizationId;

    if (!userId || !organizationId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.acceptOrganizationInvite(
      activityId,
      organizationId,
      userId
    );

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to accept organization invite'),
      500
    );
  }
}

export async function declineOrganizationInviteHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const organizationId = (req as AuthRequest).user?.currentOrganizationId;

    if (!organizationId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.declineOrganizationInvite(activityId, organizationId);

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to decline organization invite'),
      500
    );
  }
}

export async function createVoiceChannelHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;
    const { templateId, userLimit, bitrate } = req.body as {
      templateId?: string;
      userLimit?: number;
      bitrate?: number;
    };

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const activityService = await getActivityServiceInstance();

    const activity = await activityService.getActivityById(activityId);
    if (!activity) {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }

    if (activity.creatorId !== userId) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, 'Only creator can create voice channel', 403);
    }

    await activityService.createVoiceChannelForActivity(activity, templateId, userLimit, bitrate);

    res.success({ message: 'Voice channel configured', activity });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to create voice channel'),
      500
    );
  }
}

export async function linkVoiceChannelHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;
    const { channelId, guildId } = req.body as { channelId?: string; guildId?: string };

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    if (!channelId || !guildId) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Channel ID and Guild ID are required',
        400
      );
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.linkVoiceChannel(activityId, channelId, guildId);

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to link voice channel'),
      500
    );
  }
}

export class ActivityControllerRouteOrgVoiceBindings {
  readonly addRoutePlan: ActivityControllerRouteOrgVoiceHandler = addRoutePlanHandler;
  readonly updateWaypoint: ActivityControllerRouteOrgVoiceHandler = updateWaypointHandler;
  readonly enrichWithMiningData: ActivityControllerRouteOrgVoiceHandler =
    enrichWithMiningDataHandler;
  readonly inviteOrganization: ActivityControllerRouteOrgVoiceHandler = inviteOrganizationHandler;
  readonly acceptOrganizationInvite: ActivityControllerRouteOrgVoiceHandler =
    acceptOrganizationInviteHandler;
  readonly declineOrganizationInvite: ActivityControllerRouteOrgVoiceHandler =
    declineOrganizationInviteHandler;
  readonly createVoiceChannel: ActivityControllerRouteOrgVoiceHandler = createVoiceChannelHandler;
  readonly linkVoiceChannel: ActivityControllerRouteOrgVoiceHandler = linkVoiceChannelHandler;
}
