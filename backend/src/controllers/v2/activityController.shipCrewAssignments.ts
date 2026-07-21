import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import type { ActivityService } from '../../services/activity/ActivityService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

import type { AddShipBody, LoanShipsBody } from './activityController.types';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

export type ActivityControllerRouteHandler = (req: Request, res: Response) => Promise<void>;

async function getActivityServiceInstance(): Promise<ActivityService> {
  const { ActivityService } = await import('../../services/activity/ActivityService');
  return new ActivityService();
}

export async function addShipHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const {
      shipId,
      shipType,
      shipName,
      role,
      crewCapacity,
      capabilities,
      parentShipId,
      transportType,
    } = req.body as AddShipBody;

    if (!shipType || !role || !crewCapacity) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Ship type, role, and crew capacity are required',
        400
      );
    }

    const activityService = await getActivityServiceInstance();

    const activity = await activityService.addShip(activityId, userId, {
      shipId,
      shipType,
      shipName,
      role,
      crewCapacity,
      capabilities: capabilities ?? [],
      parentShipId,
      transportType,
    });

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to add ship'),
      500
    );
  }
}

export async function loanShipsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;
    const userName = (req as AuthRequest).user?.username ?? 'Unknown';

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { ships } = req.body as LoanShipsBody;

    if (!Array.isArray(ships) || ships.length === 0) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Ships array is required and must contain at least one ship',
        400
      );
    }

    for (const ship of ships) {
      if (!ship.shipType) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Each ship must have a shipType', 400);
      }
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.loanShips(activityId, userId, userName, ships);
    res.success(activity);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to loan ships'),
      500
    );
  }
}

export async function joinShipCrewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId, ownerId } = req.params;
    const userId = (req as AuthRequest).user?.id;
    const userName = (req as AuthRequest).user?.username ?? 'Unknown';

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { crewPosition } = req.body as { crewPosition?: string };

    if (!crewPosition) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Crew position is required', 400);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.joinShipAsCrew(
      activityId,
      userId,
      userName,
      ownerId,
      crewPosition
    );

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to join ship crew'),
      500
    );
  }
}

export async function leaveShipCrewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.leaveShipCrew(activityId, userId);
    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to leave ship crew'),
      500
    );
  }
}

export async function getAvailableCrewPositionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;

    const activityService = await getActivityServiceInstance();
    const positions = await activityService.getAvailableCrewPositions(activityId);

    res.success({ positions, count: positions.length });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to fetch available crew positions'),
      500
    );
  }
}

export async function setCrewPositionHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { targetUserId, shipAssignmentId, crewPosition } = req.body as {
      targetUserId?: string;
      shipAssignmentId?: string;
      crewPosition?: string;
    };

    if (!targetUserId || !shipAssignmentId || !crewPosition) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'targetUserId, shipAssignmentId and crewPosition are required',
        400
      );
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.setCrewPosition(
      activityId,
      actorUserId,
      targetUserId,
      shipAssignmentId,
      crewPosition
    );

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to set crew position'),
      500
    );
  }
}

export async function setPassengerSlotsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId, shipId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { slots } = req.body as { slots?: Array<{ role: string; capacity: number }> };
    if (!Array.isArray(slots)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'slots array is required', 400);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.setPassengerSlots(
      activityId,
      actorUserId,
      shipId,
      slots
    );

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to set passenger slots'),
      500
    );
  }
}

export async function joinShipPassengerHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId, shipId } = req.params;
    const userId = (req as AuthRequest).user?.id;
    const userName = (req as AuthRequest).user?.username ?? 'Unknown';

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { passengerRole } = req.body as { passengerRole?: string };
    if (!passengerRole) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'passengerRole is required', 400);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.joinShipAsPassenger(
      activityId,
      userId,
      userName,
      shipId,
      passengerRole
    );

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to join as passenger'),
      500
    );
  }
}

export async function leaveShipPassengerHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.leaveShipAsPassenger(activityId, userId);

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to leave passenger slot'),
      500
    );
  }
}

export async function getAvailablePassengerSlotsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const activityService = await getActivityServiceInstance();
    const slots = await activityService.getAvailablePassengerSlots(activityId, actorUserId);

    res.success({ slots, count: slots.length });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to fetch available passenger slots'),
      500
    );
  }
}

export async function setCrewSlotsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId, shipId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { slots } = req.body as { slots?: Array<{ role: string; capacity: number }> };
    if (!Array.isArray(slots)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'slots array is required', 400);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.setCrewSlots(activityId, actorUserId, shipId, slots);

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to set crew slots'),
      500
    );
  }
}

export async function getCrewSlotAvailabilityHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const activityService = await getActivityServiceInstance();
    const ships = await activityService.getCrewSlotAvailability(activityId, actorUserId);

    res.success({ ships, count: ships.length });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to fetch crew slot availability'),
      500
    );
  }
}

export async function bringFleetToActivityHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { fleetId, shipIds } = req.body as { fleetId?: string; shipIds?: string[] };
    if (!fleetId) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'fleetId is required', 400);
    }

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.bringFleetToActivity(
      activityId,
      actorUserId,
      fleetId,
      shipIds
    );

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to bring fleet to activity'),
      500
    );
  }
}

export async function bringFleetAndInviteMembersHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { fleetId, shipIds, userIds } = req.body as {
      fleetId?: string;
      shipIds?: string[];
      userIds?: string[];
    };
    if (!fleetId) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'fleetId is required', 400);
    }

    const activityService = await getActivityServiceInstance();
    const result = await activityService.bringFleetAndInviteMembers(
      activityId,
      actorUserId,
      fleetId,
      {
        shipIds,
        userIds,
      }
    );

    res.success(result);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to bring fleet and invite members'),
      500
    );
  }
}

export async function inviteFleetMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { fleetId, userIds } = req.body as { fleetId?: string; userIds?: string[] };
    if (!fleetId) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'fleetId is required', 400);
    }

    const activityService = await getActivityServiceInstance();
    const result = await activityService.inviteFleetMembers(
      activityId,
      actorUserId,
      fleetId,
      userIds
    );

    res.success(result);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to invite fleet members'),
      500
    );
  }
}

export async function nestShipHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: activityId, shipAssignmentId } = req.params;
    const actorUserId = (req as AuthRequest).user?.id;

    if (!actorUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const body = req.body as {
      parentShipId?: string | null;
      transportType?: 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar' | null;
    };

    const parentShipId = body.parentShipId ?? null;
    const transportType = body.transportType ?? null;

    const activityService = await getActivityServiceInstance();
    const activity = await activityService.nestShip(activityId, actorUserId, shipAssignmentId, {
      parentShipId,
      transportType,
    });

    res.success(activity);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to nest ship'),
      500
    );
  }
}

export class ActivityControllerShipCrewBindings {
  readonly addShip: ActivityControllerRouteHandler = addShipHandler;
  readonly loanShips: ActivityControllerRouteHandler = loanShipsHandler;
  readonly joinShipCrew: ActivityControllerRouteHandler = joinShipCrewHandler;
  readonly leaveShipCrew: ActivityControllerRouteHandler = leaveShipCrewHandler;
  readonly getAvailableCrewPositions: ActivityControllerRouteHandler =
    getAvailableCrewPositionsHandler;
  readonly setCrewPosition: ActivityControllerRouteHandler = setCrewPositionHandler;
  readonly setPassengerSlots: ActivityControllerRouteHandler = setPassengerSlotsHandler;
  readonly joinShipPassenger: ActivityControllerRouteHandler = joinShipPassengerHandler;
  readonly leaveShipPassenger: ActivityControllerRouteHandler = leaveShipPassengerHandler;
  readonly getAvailablePassengerSlots: ActivityControllerRouteHandler =
    getAvailablePassengerSlotsHandler;
  readonly setCrewSlots: ActivityControllerRouteHandler = setCrewSlotsHandler;
  readonly getCrewSlotAvailability: ActivityControllerRouteHandler = getCrewSlotAvailabilityHandler;
  readonly bringFleetToActivity: ActivityControllerRouteHandler = bringFleetToActivityHandler;
  readonly bringFleetAndInviteMembers: ActivityControllerRouteHandler =
    bringFleetAndInviteMembersHandler;
  readonly inviteFleetMembers: ActivityControllerRouteHandler = inviteFleetMembersHandler;
  readonly nestShip: ActivityControllerRouteHandler = nestShipHandler;
}
