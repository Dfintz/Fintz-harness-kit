/**
 * Activity Controller V2
 * Handles activity-related endpoints with standardized responses
 * Updated for API v2 with enhanced query parameter support
 */
import { Request } from 'express';

import { Activity } from '../../models/Activity';
import { ActivityEventService } from '../../services/activity/ActivityEventService';
import { ActivityParticipantService } from '../../services/activity/ActivityParticipantService';
import { NotificationRouter } from '../../services/communication/notifications/NotificationRouter';
import { OrganizationService } from '../../services/organization/OrganizationService';

import {
  batchCreateActivitiesHandler,
  batchDeleteActivitiesHandler,
  batchUpdateActivitiesHandler,
} from './activityController.batchOperations';
import { getCompletionActivityForUserHelper } from './activityController.coreHelpers';
import {
  completeActivityFullHandler,
  createActivityFullHandler,
  generateJoinLinkHandler,
  joinActivityByTokenHandler,
  previewActivityByTokenHandler,
} from './activityController.fullFlowQuickJoin';
import {
  createActivityHandler,
  deleteActivityHandler,
  getActivityAnalyticsHandler,
  getActivityByIdHandler,
  getPublicActivityByIdHandler,
  getRecommendedActivitiesHandler,
  getUpcomingActivitiesHandler,
  listOrgActivitiesHandler,
  updateActivityHandler,
} from './activityController.lifecycleDiscovery';
import {
  getParticipantsHandler,
  joinActivityHandler,
  leaveActivityHandler,
  updateParticipantHandler,
} from './activityController.participation';
import {
  type ActivityControllerRouteOrgVoiceHandler,
  ActivityControllerRouteOrgVoiceBindings,
} from './activityController.routeOrgVoice';
import {
  getActivityStatisticsHandler,
  getMyActivitiesHandler,
  searchActivitiesHandler,
} from './activityController.searchDiscovery';
import { ActivityControllerSharedHelpers } from './activityController.sharedHelpers';
import {
  type ActivityControllerRouteHandler,
  ActivityControllerShipCrewBindings,
} from './activityController.shipCrewAssignments';
import {
  cancelActivityHandler,
  completeActivityHandler,
  createActivityReminderHandler,
  exportActivityToCalendarHandler,
  getActivityCalendarHandler,
  getActivityRemindersHandler,
  updateActivityStatusHandler,
} from './activityController.statusCalendarReminder';

export class ActivityControllerV2 {
  private readonly notificationRouter = new NotificationRouter();
  private readonly participantService = new ActivityParticipantService();
  private readonly activityEventService = new ActivityEventService();
  private readonly organizationService = new OrganizationService();

  private readonly sharedHelpers = new ActivityControllerSharedHelpers(
    this.participantService,
    this.organizationService,
    this.notificationRouter
  );
  private readonly shipCrewBindings: ActivityControllerShipCrewBindings =
    new ActivityControllerShipCrewBindings();
  private readonly routeOrgVoiceBindings: ActivityControllerRouteOrgVoiceBindings =
    new ActivityControllerRouteOrgVoiceBindings();

  readonly addShip: ActivityControllerRouteHandler = this.shipCrewBindings.addShip;
  readonly loanShips: ActivityControllerRouteHandler = this.shipCrewBindings.loanShips;
  readonly joinShipCrew: ActivityControllerRouteHandler = this.shipCrewBindings.joinShipCrew;
  readonly leaveShipCrew: ActivityControllerRouteHandler = this.shipCrewBindings.leaveShipCrew;
  readonly getAvailableCrewPositions: ActivityControllerRouteHandler =
    this.shipCrewBindings.getAvailableCrewPositions;
  readonly setCrewPosition: ActivityControllerRouteHandler = this.shipCrewBindings.setCrewPosition;
  readonly setPassengerSlots: ActivityControllerRouteHandler =
    this.shipCrewBindings.setPassengerSlots;
  readonly joinShipPassenger: ActivityControllerRouteHandler =
    this.shipCrewBindings.joinShipPassenger;
  readonly leaveShipPassenger: ActivityControllerRouteHandler =
    this.shipCrewBindings.leaveShipPassenger;
  readonly getAvailablePassengerSlots: ActivityControllerRouteHandler =
    this.shipCrewBindings.getAvailablePassengerSlots;
  readonly setCrewSlots: ActivityControllerRouteHandler = this.shipCrewBindings.setCrewSlots;
  readonly getCrewSlotAvailability: ActivityControllerRouteHandler =
    this.shipCrewBindings.getCrewSlotAvailability;
  readonly bringFleetToActivity: ActivityControllerRouteHandler =
    this.shipCrewBindings.bringFleetToActivity;
  readonly bringFleetAndInviteMembers: ActivityControllerRouteHandler =
    this.shipCrewBindings.bringFleetAndInviteMembers;
  readonly inviteFleetMembers: ActivityControllerRouteHandler =
    this.shipCrewBindings.inviteFleetMembers;
  readonly nestShip: ActivityControllerRouteHandler = this.shipCrewBindings.nestShip;
  readonly addRoutePlan: ActivityControllerRouteOrgVoiceHandler =
    this.routeOrgVoiceBindings.addRoutePlan;
  readonly updateWaypoint: ActivityControllerRouteOrgVoiceHandler =
    this.routeOrgVoiceBindings.updateWaypoint;
  readonly enrichWithMiningData: ActivityControllerRouteOrgVoiceHandler =
    this.routeOrgVoiceBindings.enrichWithMiningData;
  readonly inviteOrganization: ActivityControllerRouteOrgVoiceHandler =
    this.routeOrgVoiceBindings.inviteOrganization;
  readonly acceptOrganizationInvite: ActivityControllerRouteOrgVoiceHandler =
    this.routeOrgVoiceBindings.acceptOrganizationInvite;
  readonly declineOrganizationInvite: ActivityControllerRouteOrgVoiceHandler =
    this.routeOrgVoiceBindings.declineOrganizationInvite;
  readonly createVoiceChannel: ActivityControllerRouteOrgVoiceHandler =
    this.routeOrgVoiceBindings.createVoiceChannel;
  readonly linkVoiceChannel: ActivityControllerRouteOrgVoiceHandler =
    this.routeOrgVoiceBindings.linkVoiceChannel;
  readonly listOrgActivities: ActivityControllerRouteHandler = listOrgActivitiesHandler;
  readonly getPublicActivityById: ActivityControllerRouteHandler = async (req, res) => {
    await getPublicActivityByIdHandler(req, res, {
      hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
    });
  };
  readonly getActivityById: ActivityControllerRouteHandler = async (req, res) => {
    await getActivityByIdHandler(req, res, {
      hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
    });
  };
  readonly createActivity: ActivityControllerRouteHandler = async (req, res) => {
    await createActivityHandler(req, res, {
      findOrganizationById: this.sharedHelpers.findOrganizationById.bind(this.sharedHelpers),
      participantService: this.participantService,
      notifyOrg: this.sharedHelpers.notifyOrg.bind(this.sharedHelpers),
    });
  };
  readonly updateActivity: ActivityControllerRouteHandler = async (req, res) => {
    await updateActivityHandler(req, res, {
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
      applyAllowedActivityUpdates: this.sharedHelpers.applyAllowedActivityUpdates.bind(
        this.sharedHelpers
      ),
      applyScheduleUpdates: this.sharedHelpers.applyScheduleUpdates.bind(this.sharedHelpers),
      applyMetadataUpdate: this.sharedHelpers.applyMetadataUpdate.bind(this.sharedHelpers),
      hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
    });
  };
  readonly deleteActivity: ActivityControllerRouteHandler = async (req, res) => {
    await deleteActivityHandler(req, res, {
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
    });
  };
  readonly getRecommendedActivities: ActivityControllerRouteHandler =
    getRecommendedActivitiesHandler;
  readonly getUpcomingActivities: ActivityControllerRouteHandler = getUpcomingActivitiesHandler;
  readonly getActivityAnalytics: ActivityControllerRouteHandler = getActivityAnalyticsHandler;
  readonly joinActivity: ActivityControllerRouteHandler = async (req, res) => {
    await joinActivityHandler(req, res, {
      participantService: this.participantService,
      hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
      notifyActivityJoined: this.sharedHelpers.notifyActivityJoined.bind(this.sharedHelpers),
    });
  };
  readonly leaveActivity: ActivityControllerRouteHandler = async (req, res) => {
    await leaveActivityHandler(req, res, {
      participantService: this.participantService,
      hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
    });
  };
  readonly getParticipants: ActivityControllerRouteHandler = async (req, res) => {
    await getParticipantsHandler(req, res, {
      participantService: this.participantService,
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
    });
  };
  readonly updateParticipant: ActivityControllerRouteHandler = async (req, res) => {
    await updateParticipantHandler(req, res, {
      participantService: this.participantService,
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
      hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
    });
  };
  readonly searchActivities: ActivityControllerRouteHandler = searchActivitiesHandler;
  readonly getMyActivities: ActivityControllerRouteHandler = getMyActivitiesHandler;
  readonly getActivityStatistics: ActivityControllerRouteHandler = getActivityStatisticsHandler;
  readonly getActivityCalendar: ActivityControllerRouteHandler = getActivityCalendarHandler;
  readonly exportActivityToCalendar: ActivityControllerRouteHandler = async (req, res) => {
    await exportActivityToCalendarHandler(req, res, {
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
    });
  };
  readonly createActivityReminder: ActivityControllerRouteHandler = async (req, res) => {
    await createActivityReminderHandler(req, res, {
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
    });
  };
  readonly getActivityReminders: ActivityControllerRouteHandler = async (req, res) => {
    await getActivityRemindersHandler(req, res, {
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
    });
  };
  readonly updateActivityStatus: ActivityControllerRouteHandler = async (req, res) => {
    await updateActivityStatusHandler(req, res, {
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
      notifyOrg: this.sharedHelpers.notifyOrg.bind(this.sharedHelpers),
    });
  };
  readonly batchCreateActivities: ActivityControllerRouteHandler = batchCreateActivitiesHandler;
  readonly batchUpdateActivities: ActivityControllerRouteHandler = async (req, res) => {
    await batchUpdateActivitiesHandler(req, res, {
      findActivityById: (id: string) => this.sharedHelpers.findActivityById(id),
    });
  };
  readonly batchDeleteActivities: ActivityControllerRouteHandler = async (req, res) => {
    await batchDeleteActivitiesHandler(req, res, {
      findActivityById: (id: string) => this.sharedHelpers.findActivityById(id),
    });
  };
  readonly completeActivity: ActivityControllerRouteHandler = async (req, res) => {
    await completeActivityHandler(req, res, {
      getCompletionActivityForUser: this.getCompletionActivityForUser.bind(this),
    });
  };
  readonly cancelActivity: ActivityControllerRouteHandler = async (req, res) => {
    await cancelActivityHandler(req, res, {
      getCompletionActivityForUser: this.getCompletionActivityForUser.bind(this),
      activityEventService: this.activityEventService,
    });
  };
  readonly createActivityFull: ActivityControllerRouteHandler = async (req, res) => {
    await createActivityFullHandler(req, res, {
      organizationServiceCanUserAccessOrganization: (userId, orgId) =>
        this.organizationService.canUserAccessOrganization(userId, orgId),
    });
  };
  readonly completeActivityFull: ActivityControllerRouteHandler = async (req, res) => {
    await completeActivityFullHandler(req, res, {
      getCompletionActivityForUser: this.getCompletionActivityForUser.bind(this),
    });
  };
  readonly generateJoinLink: ActivityControllerRouteHandler = async (req, res) => {
    await generateJoinLinkHandler(req, res, {
      findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
    });
  };
  readonly previewActivityByToken: ActivityControllerRouteHandler = async (req, res) => {
    await previewActivityByTokenHandler(req, res, {
      findActivityByQuickJoinToken: this.sharedHelpers.findActivityByQuickJoinToken.bind(
        this.sharedHelpers
      ),
      getParticipantCount: this.participantService.getParticipantCount.bind(
        this.participantService
      ),
    });
  };
  readonly joinActivityByToken: ActivityControllerRouteHandler = async (req, res) => {
    await joinActivityByTokenHandler(req, res, {
      findActivityByQuickJoinToken: this.sharedHelpers.findActivityByQuickJoinToken.bind(
        this.sharedHelpers
      ),
      validateQuickJoinActivity: this.sharedHelpers.validateQuickJoinActivity.bind(
        this.sharedHelpers
      ),
      isParticipant: this.participantService.isParticipant.bind(this.participantService),
      joinActivityByToken: this.participantService.joinActivity.bind(this.participantService),
    });
  };
  private readonly findActivityById = (
    id: string,
    options?: {
      organizationId?: string;
      visibility?: Activity['visibility'];
      includeParticipants?: boolean;
    }
  ): Promise<Activity | null> => this.sharedHelpers.findActivityById(id, options);

  private readonly getScopedOrganizationId = (req: Request): string | undefined =>
    this.sharedHelpers.getScopedOrganizationId(req);

  private readonly getCompletionActivityForUser = (
    req: Request,
    activityId: string,
    userId: string,
    options?: {
      requireOrganization?: boolean;
    }
  ): Promise<Activity> =>
    getCompletionActivityForUserHelper({
      req,
      activityId,
      userId,
      options,
      getScopedOrganizationId: this.getScopedOrganizationId,
      findActivityById: this.findActivityById,
      canUserAccessOrganization: (actorUserId, orgId) =>
        this.organizationService.canUserAccessOrganization(actorUserId, orgId),
    });
}
