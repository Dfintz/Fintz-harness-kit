import { logger } from '../../utils/logger';
import { emitToOrganization } from '../websocketServer';

/**
 * Activity WebSocket Controller
 *
 * Handles real-time events for activity operations:
 * - Activity created, updated, deleted
 * - Activity status changes
 * - Participants joined/left
 * - Activity reminders
 */

export interface ActivityData {
  id: string;
  name?: string;
  description?: string;
  activityType?: string;
  status?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  participants?: unknown[];
  [key: string]: unknown;
}

export interface ActivityParticipant {
  userId: string;
  userName: string;
  role?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ActivityEvent {
  type:
    | 'activity:created'
    | 'activity:updated'
    | 'activity:deleted'
    | 'activity:participant_joined'
    | 'activity:participant_left'
    | 'activity:status_changed'
    | 'activity:reminder'
    | 'activity:ready_check_initiated'
    | 'activity:ready_check_response'
    | 'activity:ready_check_completed'
    | 'activity:ready_check_expired'
    | 'activity:ready_check_cancelled';
  organizationId: string;
  activityId: string;
  data: ActivityData | Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

/**
 * Emit activity created event
 */
export const emitActivityCreated = (
  organizationId: string | null,
  activity: ActivityData | Record<string, unknown>,
  userId?: string
): void => {
  if (!organizationId) {
    return;
  } // Personal activities have no org room
  const event: ActivityEvent = {
    type: 'activity:created',
    organizationId,
    activityId: activity.id as string,
    data: activity,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:created', event);
  logger.debug(`Emitted activity:created for activity ${activity.id} in org ${organizationId}`);
};

/**
 * Emit activity updated event
 */
export const emitActivityUpdated = (
  organizationId: string | null,
  activity: ActivityData | Record<string, unknown>,
  userId?: string
): void => {
  if (!organizationId) {
    return;
  } // Personal activities have no org room
  const event: ActivityEvent = {
    type: 'activity:updated',
    organizationId,
    activityId: activity.id as string,
    data: activity,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:updated', event);
  logger.debug(`Emitted activity:updated for activity ${activity.id} in org ${organizationId}`);
};

/**
 * Emit activity deleted event
 */
export const emitActivityDeleted = (
  organizationId: string | null,
  activityId: string,
  userId?: string
): void => {
  if (!organizationId) {
    return;
  } // Personal activities have no org room
  const event: ActivityEvent = {
    type: 'activity:deleted',
    organizationId,
    activityId,
    data: { id: activityId },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:deleted', event);
  logger.debug(`Emitted activity:deleted for activity ${activityId} in org ${organizationId}`);
};

/**
 * Emit participant joined activity event
 */
export const emitParticipantJoined = (
  organizationId: string,
  activityId: string,
  participant: ActivityParticipant,
  userId?: string
): void => {
  const event: ActivityEvent = {
    type: 'activity:participant_joined',
    organizationId,
    activityId,
    data: { participant },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:participant_joined', event);
  logger.debug(
    `Emitted activity:participant_joined for activity ${activityId} in org ${organizationId}`
  );
};

/**
 * Emit participant left activity event
 */
export const emitParticipantLeft = (
  organizationId: string,
  activityId: string,
  participantId: string,
  userId?: string
): void => {
  const event: ActivityEvent = {
    type: 'activity:participant_left',
    organizationId,
    activityId,
    data: { participantId },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:participant_left', event);
  logger.debug(
    `Emitted activity:participant_left for activity ${activityId} in org ${organizationId}`
  );
};

/**
 * Emit activity status changed event
 */
export const emitActivityStatusChanged = (
  organizationId: string,
  activityId: string,
  oldStatus: string,
  newStatus: string,
  userId?: string
): void => {
  const event: ActivityEvent = {
    type: 'activity:status_changed',
    organizationId,
    activityId,
    data: { oldStatus, newStatus },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:status_changed', event);
  logger.debug(
    `Emitted activity:status_changed for activity ${activityId} in org ${organizationId}`
  );
};

/**
 * Emit activity reminder event
 */
export const emitActivityReminder = (
  organizationId: string,
  activityId: string,
  activity: ActivityData | Record<string, unknown>,
  reminderMinutes: number
): void => {
  const event: ActivityEvent = {
    type: 'activity:reminder',
    organizationId,
    activityId,
    data: { activity, reminderMinutes },
    timestamp: Date.now(),
  };

  emitToOrganization(organizationId, 'activity:reminder', event);
  logger.debug(
    `Emitted activity:reminder for activity ${activityId} in org ${organizationId} (${reminderMinutes} minutes)`
  );
};

/**
 * Emit ready check initiated event
 */
export const emitReadyCheckInitiated = (
  organizationId: string,
  activityId: string,
  readyCheck: Record<string, unknown>,
  userId?: string
): void => {
  const event: ActivityEvent = {
    type: 'activity:ready_check_initiated',
    organizationId,
    activityId,
    data: readyCheck,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:ready_check_initiated', event);
  logger.debug(
    `Emitted activity:ready_check_initiated for activity ${activityId} in org ${organizationId}`
  );
};

/**
 * Emit ready check response event (a participant responded)
 */
export const emitReadyCheckResponse = (
  organizationId: string,
  activityId: string,
  readyCheckSummary: Record<string, unknown>,
  userId?: string
): void => {
  const event: ActivityEvent = {
    type: 'activity:ready_check_response',
    organizationId,
    activityId,
    data: readyCheckSummary,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:ready_check_response', event);
  logger.debug(
    `Emitted activity:ready_check_response for activity ${activityId} in org ${organizationId}`
  );
};

/**
 * Emit ready check completed event (all responded or manually completed)
 */
export const emitReadyCheckCompleted = (
  organizationId: string,
  activityId: string,
  readyCheckSummary: Record<string, unknown>,
  userId?: string
): void => {
  const event: ActivityEvent = {
    type: 'activity:ready_check_completed',
    organizationId,
    activityId,
    data: readyCheckSummary,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:ready_check_completed', event);
  logger.debug(
    `Emitted activity:ready_check_completed for activity ${activityId} in org ${organizationId}`
  );
};

/**
 * Emit ready check expired event
 */
export const emitReadyCheckExpired = (
  organizationId: string,
  activityId: string,
  readyCheckSummary: Record<string, unknown>
): void => {
  const event: ActivityEvent = {
    type: 'activity:ready_check_expired',
    organizationId,
    activityId,
    data: readyCheckSummary,
    timestamp: Date.now(),
  };

  emitToOrganization(organizationId, 'activity:ready_check_expired', event);
  logger.debug(
    `Emitted activity:ready_check_expired for activity ${activityId} in org ${organizationId}`
  );
};

/**
 * Emit ready check cancelled event
 */
export const emitReadyCheckCancelled = (
  organizationId: string,
  activityId: string,
  userId?: string
): void => {
  const event: ActivityEvent = {
    type: 'activity:ready_check_cancelled',
    organizationId,
    activityId,
    data: { cancelled: true },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'activity:ready_check_cancelled', event);
  logger.debug(
    `Emitted activity:ready_check_cancelled for activity ${activityId} in org ${organizationId}`
  );
};
