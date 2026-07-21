import crypto from 'node:crypto';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Activity, ActivityStatus } from '../../models/Activity';
import { NotificationContext } from '../../services/communication/notifications/NotificationRouter';
import { ApiErrorCode } from '../../types/api';

export function notifyActivityJoinedHelper(input: {
  activity: Activity;
  userId: string;
  userName: string;
  notifyUser: (payload: {
    context: NotificationContext;
    userId: string;
    title: string;
    message: string;
    senderId: string;
    actionUrl: string;
    metadata: Record<string, unknown>;
  }) => Promise<unknown>;
  notifyOrg: (payload: {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    senderId: string;
    activityId: string;
  }) => void;
}): void {
  if (input.activity.creatorId && input.activity.creatorId !== input.userId) {
    input
      .notifyUser({
        context: NotificationContext.ACTIVITY_JOINED,
        userId: input.activity.creatorId,
        title: `${input.userName} joined your activity`,
        message: `${input.userName} joined "${input.activity.title}"`,
        senderId: input.userId,
        actionUrl: `/activities/${input.activity.id}`,
        metadata: { activityId: input.activity.id },
      })
      .catch(() => {
        /* best-effort */
      });
  }
  if (input.activity.organizationId) {
    input.notifyOrg({
      context: NotificationContext.ACTIVITY_JOINED,
      organizationId: input.activity.organizationId,
      title: `${input.userName} joined an activity`,
      message: `${input.userName} joined "${input.activity.title}"`,
      senderId: input.userId,
      activityId: input.activity.id,
    });
  }
}

export function validateQuickJoinActivityHelper(activity: Activity): void {
  if (activity.metadata?.quickJoinTokenExpiry) {
    const expiry = new Date(activity.metadata.quickJoinTokenExpiry);
    if (expiry < new Date()) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'This join link has expired', 410);
    }
  }

  if (!activity.metadata?.quickJoin) {
    throw new ApiError(
      ApiErrorCode.VALIDATION_ERROR,
      'Quick join is not enabled for this activity',
      400
    );
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
}

export async function findActivityByQuickJoinTokenHelper(
  token: string,
  tokensEqualConstantTime: (left: string, right: string) => boolean
): Promise<Activity | null> {
  const activityRepo = AppDataSource.getRepository(Activity);

  const activity = await activityRepo
    .createQueryBuilder('activity')
    // `metadata` is declared `simple-json` (stored as text in Postgres),
    // so we must cast to jsonb before using the `->>` extractor. The
    // expression matches `idx_activities_quick_join_token`.
    .where("(activity.metadata::jsonb)->>'quickJoinToken' = :token", { token })
    .getOne();

  if (!activity) {
    return null;
  }

  const persistedToken = activity.metadata?.quickJoinToken;
  if (typeof persistedToken !== 'string') {
    return null;
  }

  return tokensEqualConstantTime(persistedToken, token) ? activity : null;
}

export function tokensEqualConstantTimeHelper(left: string, right: string): boolean {
  const leftDigest = crypto.createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = crypto.createHash('sha256').update(right, 'utf8').digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}
