import { Request } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Activity, type ActivityParticipant } from '../../models/Activity';
import { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import { Organization } from '../../models/Organization';
import { NotificationContext } from '../../services/communication/notifications/NotificationRouter';
import { ApiErrorCode } from '../../types/api';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

type AuthTenantRequest = AuthRequest & {
  tenantContext?: { organizationId?: string };
};

export async function findActivityByIdHelper(
  id: string,
  options?: {
    organizationId?: string;
    visibility?: Activity['visibility'];
    includeParticipants?: boolean;
  }
): Promise<Activity | null> {
  const queryBuilder = AppDataSource.getRepository(Activity)
    .createQueryBuilder('activity')
    .where('activity.id = :id', { id });

  if (options?.organizationId) {
    queryBuilder.andWhere('activity.organizationId = :organizationId', {
      organizationId: options.organizationId,
    });
  }

  if (options?.visibility) {
    queryBuilder.andWhere('activity.visibility = :visibility', {
      visibility: options.visibility,
    });
  }

  if (options?.includeParticipants) {
    queryBuilder.addSelect('activity.participants');
  }

  return queryBuilder.getOne();
}

export function getScopedOrganizationIdHelper(req: Request): string | undefined {
  const authReq = req as AuthTenantRequest;
  const organizationId =
    authReq.user?.currentOrganizationId ?? authReq.tenantContext?.organizationId;
  if (!organizationId || organizationId.trim().length === 0) {
    return undefined;
  }

  return organizationId;
}

export async function getCompletionActivityForUserHelper(input: {
  req: Request;
  activityId: string;
  userId: string;
  options?: {
    requireOrganization?: boolean;
  };
  getScopedOrganizationId: (req: Request) => string | undefined;
  findActivityById: (
    id: string,
    options?: {
      organizationId?: string;
      visibility?: Activity['visibility'];
      includeParticipants?: boolean;
    }
  ) => Promise<Activity | null>;
  canUserAccessOrganization: (userId: string, orgId: string) => Promise<{ canAccess: boolean }>;
}): Promise<Activity> {
  const scopedOrganizationId = input.getScopedOrganizationId(input.req);
  let activity: Activity | null = null;

  if (scopedOrganizationId) {
    activity = await input.findActivityById(input.activityId, {
      organizationId: scopedOrganizationId,
    });
  }

  // Fallback lookup prevents creator-owned personal activities from being
  // hidden when a current organization scope is present in auth context.
  activity ??= await input.findActivityById(input.activityId);

  if (!activity) {
    throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
  }

  const requireOrganization = input.options?.requireOrganization ?? false;
  if (!activity.organizationId) {
    if (requireOrganization) {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }

    return activity;
  }

  const orgAccess = await input.canUserAccessOrganization(input.userId, activity.organizationId);
  if (!orgAccess.canAccess) {
    throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
  }

  return activity;
}

export async function findOrganizationByIdHelper(
  orgId: string,
  getOrganizationById: (orgId: string) => Promise<Organization | null>
): Promise<Organization | null> {
  return getOrganizationById(orgId);
}

export function applyAllowedActivityUpdatesHelper(
  activity: Activity,
  updates: Record<string, unknown>
): void {
  const allowedFields = [
    'title',
    'description',
    'status',
    'visibility',
    'maxParticipants',
    'timezone',
    'location',
    'requirements',
    'shipRequirementType',
    'requiredShips',
    'crewSpotsTotal',
    'estimatedDuration',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      (activity as unknown as Record<string, unknown>)[field] = updates[field];
    }
  }
}

export function applyScheduleUpdatesHelper(
  activity: Activity,
  updates: Record<string, unknown>
): void {
  if (updates.startDate !== undefined) {
    activity.scheduledStartDate = updates.startDate
      ? new Date(updates.startDate as string)
      : undefined;
  }
  if (updates.scheduledStartDate !== undefined) {
    activity.scheduledStartDate = updates.scheduledStartDate
      ? new Date(updates.scheduledStartDate as string)
      : undefined;
  }
  if (updates.endDate !== undefined) {
    activity.scheduledEndDate = updates.endDate ? new Date(updates.endDate as string) : undefined;
  }
  if (updates.scheduledEndDate !== undefined) {
    activity.scheduledEndDate = updates.scheduledEndDate
      ? new Date(updates.scheduledEndDate as string)
      : undefined;
  }
}

export function applyMetadataUpdateHelper(
  activity: Activity,
  updates: Record<string, unknown>
): void {
  if (updates.metadata !== undefined && updates.metadata !== null) {
    activity.metadata = {
      ...activity.metadata,
      ...(updates.metadata as Record<string, unknown>),
    };
  }
}

export async function hydrateParticipantsHelper(
  activity: Activity,
  getParticipants: (activityId: string) => Promise<ActivityParticipantEntity[]>
): Promise<void> {
  const participantRows = await getParticipants(activity.id);
  (activity as Activity & { participants: ActivityParticipant[] }).participants =
    participantRows.map(p => ({
      userId: p.userId,
      userName: p.userName,
      avatarUrl: p.avatarUrl ?? undefined,
      organizationId: p.organizationId ?? undefined,
      organizationName: p.organizationName ?? undefined,
      role: p.role,
      status: p.status,
      joinedAt: p.joinedAt,
      shipType: p.shipType ?? undefined,
      shipName: p.shipName ?? undefined,
      shipId: p.shipId ?? undefined,
      crewPosition: p.crewPosition ?? undefined,
      crewShipId: p.crewShipId ?? undefined,
      reputation: p.reputation ?? undefined,
      notes: p.notes ?? undefined,
      message: p.message ?? undefined,
      metadata: p.metadata ?? undefined,
    }));
}

export function notifyOrgHelper(
  input: {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    activityId: string;
    senderId?: string;
    metadata?: Record<string, unknown>;
  },
  notifyOrganization: (payload: {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    senderId?: string;
    actionUrl: string;
    metadata: Record<string, unknown>;
  }) => void
): void {
  try {
    notifyOrganization({
      context: input.context,
      organizationId: input.organizationId,
      title: input.title,
      message: input.message,
      senderId: input.senderId,
      actionUrl: `/activities/${input.activityId}`,
      metadata: { activityId: input.activityId, ...input.metadata },
    });
  } catch {
    /* best-effort - do not block the API response */
  }
}
