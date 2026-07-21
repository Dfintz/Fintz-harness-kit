import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Activity } from '../../models/Activity';
import { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import { User } from '../../models/User';
import type { JoinActivityDTO } from '../../services/activity/ActivityParticipantService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

import { enrichActivityWithAvatars } from './activityController.avatars';
import type { JoinActivityBody, UpdateParticipantBody } from './activityController.types';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

type ParticipationDeps = {
  participantService: {
    joinActivity: (
      activityId: string,
      dto: JoinActivityDTO
    ) => Promise<{ activity: Activity; wasUpdate: boolean }>;
    leaveActivity: (activityId: string, userId: string) => Promise<Activity>;
    getParticipants: (activityId: string) => Promise<ActivityParticipantEntity[]>;
    isLeader: (activityId: string, userId: string) => Promise<boolean>;
    isParticipant: (activityId: string, userId: string) => Promise<boolean>;
    updateParticipant: (
      activityId: string,
      userId: string,
      updates: Partial<Pick<ActivityParticipantEntity, 'role' | 'status' | 'shipId' | 'notes'>>
    ) => Promise<number>;
  };
  findActivityById: (
    id: string,
    options?: { includeParticipants?: boolean }
  ) => Promise<Activity | null>;
  hydrateParticipants: (activity: Activity) => Promise<void>;
  notifyActivityJoined: (activity: Activity, userId: string, userName: string) => void;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * POST /api/v2/activities/:id/join
 * Join an activity as a participant (cross-org: any authenticated user)
 */
export async function joinActivityHandler(
  req: Request,
  res: Response,
  deps: Pick<
    ParticipationDeps,
    'participantService' | 'hydrateParticipants' | 'notifyActivityJoined'
  >
): Promise<void> {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;
  const userName = (req as AuthRequest).user?.username ?? 'Unknown';

  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
  }

  const { role, shipId, shipType, shipName, crewPosition, crewShipId, notes } =
    req.body as JoinActivityBody;

  try {
    const { activity, wasUpdate } = await deps.participantService.joinActivity(id, {
      userId,
      userName,
      role,
      shipId,
      shipType,
      shipName,
      crewPosition,
      crewShipId,
      notes,
    });

    // Fire-and-forget notifications (only on new join, not update)
    if (!wasUpdate) {
      deps.notifyActivityJoined(activity, userId, userName);
    }

    await enrichActivityWithAvatars(activity);
    await deps.hydrateParticipants(activity);
    res.status(wasUpdate ? 200 : 201);
    res.success(activity);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to join activity'),
      500
    );
  }
}

/**
 * POST /api/v2/activities/:id/leave
 * Leave an activity
 */
export async function leaveActivityHandler(
  req: Request,
  res: Response,
  deps: Pick<ParticipationDeps, 'participantService' | 'hydrateParticipants'>
): Promise<void> {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;

  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
  }

  try {
    const activity = await deps.participantService.leaveActivity(id, userId);

    await enrichActivityWithAvatars(activity);
    await deps.hydrateParticipants(activity);
    res.success(activity);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to leave activity'),
      500
    );
  }
}

/**
 * GET /api/v2/activities/:id/participants
 * Get list of participants for an activity
 */
export async function getParticipantsHandler(
  req: Request,
  res: Response,
  deps: Pick<ParticipationDeps, 'participantService' | 'findActivityById'>
): Promise<void> {
  const { id } = req.params;

  try {
    const activity = await deps.findActivityById(id, { includeParticipants: true });

    if (!activity) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
    }

    // Fetch participants from normalized table
    const participants = await deps.participantService.getParticipants(id);

    // Enrich normalized participants with current avatar URLs
    if (participants.length > 0) {
      const userIds = participants.map(p => p.userId).filter(isNonEmptyString);
      if (userIds.length > 0) {
        const userRepo = AppDataSource.getRepository(User);
        const users = await userRepo
          .createQueryBuilder('user')
          .select(['user.id', 'user.avatar'])
          .where('user.id IN (:...userIds)', { userIds })
          .getMany();
        const avatarMap = new Map(users.map(u => [u.id, u.avatar]));
        for (const p of participants) {
          const avatar = avatarMap.get(p.userId);
          if (avatar) {
            p.avatarUrl = avatar;
          }
        }
      }
    }

    res.success({
      participants,
      count: participants.length,
    });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to fetch participants'),
      500
    );
  }
}

/**
 * PUT /api/v2/activities/:id/participants/:userId
 * Update a participant's information (admin/organizer)
 */
export async function updateParticipantHandler(
  req: Request,
  res: Response,
  deps: Pick<ParticipationDeps, 'participantService' | 'findActivityById' | 'hydrateParticipants'>
): Promise<void> {
  const { id, userId } = req.params;
  const requestingUserId = (req as AuthRequest).user?.id;

  if (!requestingUserId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
  }

  const { role, status, shipId, notes } = req.body as UpdateParticipantBody;

  try {
    const activity = await deps.findActivityById(id);

    if (!activity) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
    }

    const canManageParticipants =
      activity.creatorId === requestingUserId ||
      (await deps.participantService.isLeader(id, requestingUserId));

    if (!canManageParticipants) {
      throw new ApiError(
        ApiErrorCode.FORBIDDEN,
        'Only activity leaders can update participants',
        403
      );
    }

    // Source of truth is the normalized table
    const isParticipant = await deps.participantService.isParticipant(id, userId);
    if (!isParticipant) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Participant not found', 404);
    }

    // Build normalized table updates
    const normalizedUpdates: Partial<
      Pick<ActivityParticipantEntity, 'role' | 'status' | 'shipId' | 'notes'>
    > = {};
    if (role !== undefined) {
      normalizedUpdates.role = role;
    }
    if (status !== undefined) {
      normalizedUpdates.status = status as ActivityParticipantEntity['status'];
    }
    if (shipId !== undefined) {
      normalizedUpdates.shipId = shipId;
    }
    if (notes !== undefined) {
      normalizedUpdates.notes = notes;
    }

    if (Object.keys(normalizedUpdates).length > 0) {
      await deps.participantService.updateParticipant(id, userId, normalizedUpdates);
    }

    await enrichActivityWithAvatars(activity);
    await deps.hydrateParticipants(activity);
    res.success(activity);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to update participant'),
      500
    );
  }
}
