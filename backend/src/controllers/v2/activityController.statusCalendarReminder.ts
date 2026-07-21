import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Activity, ActivityStatus } from '../../models/Activity';
import type { ActivityEventService } from '../../services/activity/ActivityEventService';
import { NotificationContext } from '../../services/communication/notifications/NotificationRouter';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { emitActivityUpdated } from '../../websocket/controllers/activityWebSocketController';

import type {
  CancelActivityBody,
  CompleteActivityBody,
  UpdateStatusBody,
} from './activityController.types';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

type NotificationInput = {
  context: NotificationContext;
  organizationId: string;
  title: string;
  message: string;
  activityId: string;
  senderId?: string;
  metadata?: Record<string, unknown>;
};

type StatusCalendarReminderDeps = {
  findActivityById: (id: string) => Promise<Activity | null>;
  getCompletionActivityForUser: (
    req: Request,
    activityId: string,
    userId: string
  ) => Promise<Activity>;
  notifyOrg: (input: NotificationInput) => void;
  activityEventService: ActivityEventService;
};

export async function getActivityCalendarHandler(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const { start, end, view } = req.query;

    if (!start || !end) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Start and end dates are required', 400);
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    const { ActivityCalendarService } =
      await import('../../services/activity/ActivityCalendarService');
    const calendarService = new ActivityCalendarService();

    const calendar = await calendarService.getCalendar(orgId, startDate, endDate, view as string);

    res.success({
      calendar,
      range: { start: startDate, end: endDate },
      view: view ?? 'month',
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to fetch calendar'),
      500
    );
  }
}

export async function exportActivityToCalendarHandler(
  req: Request,
  res: Response,
  deps: Pick<StatusCalendarReminderDeps, 'findActivityById'>
): Promise<void> {
  try {
    const { id } = req.params;
    const { format = 'ical' } = req.query;

    const activity = await deps.findActivityById(id);
    if (!activity) {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }

    const { CalendarExportService } = await import('../../services/activity/CalendarExportService');
    const exportService = CalendarExportService.getInstance();

    const calendarData = await exportService.generateActivityICS(activity.id);

    if (format === 'ical') {
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="activity-${id}.ics"`);
    }

    res.success({
      format,
      data: calendarData,
      activity: {
        id: activity.id,
        title: activity.title,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to export calendar'),
      500
    );
  }
}

export async function createActivityReminderHandler(
  req: Request,
  res: Response,
  deps: Pick<StatusCalendarReminderDeps, 'findActivityById'>
): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const reminderData = req.body as Record<string, unknown>;

    const activity = await deps.findActivityById(activityId);
    if (!activity) {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }

    const { ActivityReminderService } =
      await import('../../services/activity/ActivityReminderService');
    const { NotificationService } = await import('../../services/communication');
    const notificationService = new NotificationService();
    const reminderService = new ActivityReminderService(notificationService);

    const reminder = await reminderService.createReminder({
      activityId,
      ...reminderData,
    } as Parameters<typeof reminderService.createReminder>[0]);

    res.status(201).success({
      message: 'Reminder created successfully',
      reminder,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to create reminder'),
      500
    );
  }
}

export async function getActivityRemindersHandler(
  req: Request,
  res: Response,
  deps: Pick<StatusCalendarReminderDeps, 'findActivityById'>
): Promise<void> {
  try {
    const { id: activityId } = req.params;

    const activity = await deps.findActivityById(activityId);
    if (!activity) {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }

    const { ActivityReminderService } =
      await import('../../services/activity/ActivityReminderService');
    const { NotificationService } = await import('../../services/communication');
    const notificationService = new NotificationService();
    const reminderService = new ActivityReminderService(notificationService);

    const reminders = await reminderService.getReminders(activityId);
    res.success({ reminders });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to fetch reminders'),
      500
    );
  }
}

export async function updateActivityStatusHandler(
  req: Request,
  res: Response,
  deps: Pick<StatusCalendarReminderDeps, 'findActivityById' | 'notifyOrg'>
): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const { status, notes } = req.body as UpdateStatusBody;

    const activityRepo = AppDataSource.getRepository(Activity);
    const activity = await deps.findActivityById(activityId);

    if (!activity) {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }

    activity.status = status;
    if (notes) {
      (activity as unknown as Record<string, unknown>).statusNotes = notes;
    }
    (activity as unknown as Record<string, unknown>).statusUpdatedAt = new Date();

    await activityRepo.save(activity);

    emitActivityUpdated(
      activity.organizationId ?? null,
      activity as unknown as Record<string, unknown>
    );

    if (activity.organizationId) {
      let statusContext: NotificationContext | null = null;
      if (status === ActivityStatus.COMPLETED) {
        statusContext = NotificationContext.ACTIVITY_COMPLETED;
      } else if (status === ActivityStatus.CANCELLED) {
        statusContext = NotificationContext.ACTIVITY_CANCELLED;
      }

      if (statusContext) {
        deps.notifyOrg({
          context: statusContext,
          organizationId: activity.organizationId,
          title: `Activity ${status}: ${activity.title}`,
          message: `"${activity.title}" has been ${status}`,
          activityId: activity.id,
          metadata: { status },
        });
      }
    }

    res.success({
      message: 'Activity status updated successfully',
      activity: {
        id: activity.id,
        title: activity.title,
        status: activity.status,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to update activity status'),
      500
    );
  }
}

export async function completeActivityHandler(
  req: Request,
  res: Response,
  deps: Pick<StatusCalendarReminderDeps, 'getCompletionActivityForUser'>
): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const { report, attendanceCount, notes } = req.body as CompleteActivityBody;
    const completedBy = (req as AuthRequest).user?.id;

    if (!completedBy) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const activityRepo = AppDataSource.getRepository(Activity);
    const activity = await deps.getCompletionActivityForUser(req, activityId, completedBy);

    if (activity.creatorId !== completedBy) {
      throw new ApiError(
        ApiErrorCode.FORBIDDEN,
        'Only activity creator can complete the activity',
        403
      );
    }

    activity.status = ActivityStatus.COMPLETED;
    (activity as unknown as Record<string, unknown>).completionReport = report;
    (activity as unknown as Record<string, unknown>).attendanceCount = attendanceCount;
    (activity as unknown as Record<string, unknown>).completionNotes = notes;
    (activity as unknown as Record<string, unknown>).completedAt = new Date();

    await activityRepo.save(activity);

    emitActivityUpdated(activity.organizationId, activity as unknown as Record<string, unknown>);

    res.success({
      message: 'Activity marked as complete',
      activity: {
        id: activity.id,
        title: activity.title,
        status: activity.status,
        completedAt: (activity as unknown as Record<string, unknown>).completedAt,
      },
    });
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

export async function cancelActivityHandler(
  req: Request,
  res: Response,
  deps: Pick<StatusCalendarReminderDeps, 'getCompletionActivityForUser' | 'activityEventService'>
): Promise<void> {
  try {
    const { id: activityId } = req.params;
    const { notes } = req.body as CancelActivityBody;
    const cancelledBy = (req as AuthRequest).user?.id;

    if (!cancelledBy) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const activity = await deps.getCompletionActivityForUser(req, activityId, cancelledBy);

    if (activity.creatorId !== cancelledBy) {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }

    const cancelledActivity = activity.organizationId
      ? await deps.activityEventService.cancelActivityAsSystem(
          activity.organizationId,
          activity.id,
          cancelledBy,
          notes
        )
      : await deps.activityEventService.cancelActivity(activity.id, cancelledBy, notes);

    emitActivityUpdated(
      cancelledActivity.organizationId ?? null,
      cancelledActivity as unknown as Record<string, unknown>
    );

    res.success({
      message: 'Activity cancelled successfully',
      activity: {
        id: cancelledActivity.id,
        title: cancelledActivity.title,
        status: cancelledActivity.status,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      switch (error.name) {
        case 'ValidationError':
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        case 'ForbiddenError':
          throw new ApiError(ApiErrorCode.FORBIDDEN, error.message, 403);
        case 'ActivityNotFoundError':
        case 'NotFoundError':
          throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, error.message, 404);
        default:
          break;
      }
    }

    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to cancel activity'),
      500
    );
  }
}
