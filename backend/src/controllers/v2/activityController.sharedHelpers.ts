import { Request } from 'express';

import { Activity } from '../../models/Activity';
import { Organization } from '../../models/Organization';
import type { ActivityParticipantService } from '../../services/activity/ActivityParticipantService';
import {
  NotificationContext,
  NotificationRouter,
} from '../../services/communication/notifications/NotificationRouter';
import type { OrganizationService } from '../../services/organization/OrganizationService';

import {
  applyAllowedActivityUpdatesHelper,
  applyMetadataUpdateHelper,
  applyScheduleUpdatesHelper,
  findActivityByIdHelper,
  findOrganizationByIdHelper,
  getCompletionActivityForUserHelper,
  getScopedOrganizationIdHelper,
  hydrateParticipantsHelper,
  notifyOrgHelper,
} from './activityController.coreHelpers';
import {
  findActivityByQuickJoinTokenHelper,
  notifyActivityJoinedHelper,
  tokensEqualConstantTimeHelper,
  validateQuickJoinActivityHelper,
} from './activityController.quickJoinHelpers';

export class ActivityControllerSharedHelpers {
  constructor(
    private readonly participantService: ActivityParticipantService,
    private readonly organizationService: OrganizationService,
    private readonly notificationRouter: NotificationRouter
  ) {}

  async findActivityById(
    id: string,
    options?: {
      organizationId?: string;
      visibility?: Activity['visibility'];
      includeParticipants?: boolean;
    }
  ): Promise<Activity | null> {
    return findActivityByIdHelper(id, options);
  }

  getScopedOrganizationId(req: Request): string | undefined {
    return getScopedOrganizationIdHelper(req);
  }

  async getCompletionActivityForUser(
    req: Request,
    activityId: string,
    userId: string,
    options?: {
      requireOrganization?: boolean;
    }
  ): Promise<Activity> {
    return getCompletionActivityForUserHelper({
      req,
      activityId,
      userId,
      options,
      getScopedOrganizationId: this.getScopedOrganizationId.bind(this),
      findActivityById: this.findActivityById.bind(this),
      canUserAccessOrganization: (actorUserId, orgId) =>
        this.organizationService.canUserAccessOrganization(actorUserId, orgId),
    });
  }

  async findOrganizationById(orgId: string): Promise<Organization | null> {
    return findOrganizationByIdHelper(
      orgId,
      this.organizationService.getOrganizationById.bind(this.organizationService)
    );
  }

  applyAllowedActivityUpdates(activity: Activity, updates: Record<string, unknown>): void {
    applyAllowedActivityUpdatesHelper(activity, updates);
  }

  applyScheduleUpdates(activity: Activity, updates: Record<string, unknown>): void {
    applyScheduleUpdatesHelper(activity, updates);
  }

  applyMetadataUpdate(activity: Activity, updates: Record<string, unknown>): void {
    applyMetadataUpdateHelper(activity, updates);
  }

  async hydrateParticipants(activity: Activity): Promise<void> {
    await hydrateParticipantsHelper(
      activity,
      this.participantService.getParticipants.bind(this.participantService)
    );
  }

  notifyOrg(input: {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    activityId: string;
    senderId?: string;
    metadata?: Record<string, unknown>;
  }): void {
    notifyOrgHelper(
      input,
      this.notificationRouter.notifyOrganization.bind(this.notificationRouter)
    );
  }

  notifyActivityJoined(activity: Activity, userId: string, userName: string): void {
    notifyActivityJoinedHelper({
      activity,
      userId,
      userName,
      notifyUser: this.notificationRouter.notifyUser.bind(this.notificationRouter),
      notifyOrg: this.notifyOrg.bind(this),
    });
  }

  validateQuickJoinActivity(activity: Activity): void {
    validateQuickJoinActivityHelper(activity);
  }

  async findActivityByQuickJoinToken(token: string): Promise<Activity | null> {
    return findActivityByQuickJoinTokenHelper(token, this.tokensEqualConstantTime.bind(this));
  }

  tokensEqualConstantTime(left: string, right: string): boolean {
    return tokensEqualConstantTimeHelper(left, right);
  }
}
