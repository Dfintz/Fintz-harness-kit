"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityControllerV2 = void 0;
const ActivityEventService_1 = require("../../services/activity/ActivityEventService");
const ActivityParticipantService_1 = require("../../services/activity/ActivityParticipantService");
const NotificationRouter_1 = require("../../services/communication/notifications/NotificationRouter");
const OrganizationService_1 = require("../../services/organization/OrganizationService");
const activityController_batchOperations_1 = require("./activityController.batchOperations");
const activityController_coreHelpers_1 = require("./activityController.coreHelpers");
const activityController_fullFlowQuickJoin_1 = require("./activityController.fullFlowQuickJoin");
const activityController_lifecycleDiscovery_1 = require("./activityController.lifecycleDiscovery");
const activityController_participation_1 = require("./activityController.participation");
const activityController_routeOrgVoice_1 = require("./activityController.routeOrgVoice");
const activityController_searchDiscovery_1 = require("./activityController.searchDiscovery");
const activityController_sharedHelpers_1 = require("./activityController.sharedHelpers");
const activityController_shipCrewAssignments_1 = require("./activityController.shipCrewAssignments");
const activityController_statusCalendarReminder_1 = require("./activityController.statusCalendarReminder");
class ActivityControllerV2 {
    notificationRouter = new NotificationRouter_1.NotificationRouter();
    participantService = new ActivityParticipantService_1.ActivityParticipantService();
    activityEventService = new ActivityEventService_1.ActivityEventService();
    organizationService = new OrganizationService_1.OrganizationService();
    sharedHelpers = new activityController_sharedHelpers_1.ActivityControllerSharedHelpers(this.participantService, this.organizationService, this.notificationRouter);
    shipCrewBindings = new activityController_shipCrewAssignments_1.ActivityControllerShipCrewBindings();
    routeOrgVoiceBindings = new activityController_routeOrgVoice_1.ActivityControllerRouteOrgVoiceBindings();
    addShip = this.shipCrewBindings.addShip;
    loanShips = this.shipCrewBindings.loanShips;
    joinShipCrew = this.shipCrewBindings.joinShipCrew;
    leaveShipCrew = this.shipCrewBindings.leaveShipCrew;
    getAvailableCrewPositions = this.shipCrewBindings.getAvailableCrewPositions;
    setCrewPosition = this.shipCrewBindings.setCrewPosition;
    setPassengerSlots = this.shipCrewBindings.setPassengerSlots;
    joinShipPassenger = this.shipCrewBindings.joinShipPassenger;
    leaveShipPassenger = this.shipCrewBindings.leaveShipPassenger;
    getAvailablePassengerSlots = this.shipCrewBindings.getAvailablePassengerSlots;
    setCrewSlots = this.shipCrewBindings.setCrewSlots;
    getCrewSlotAvailability = this.shipCrewBindings.getCrewSlotAvailability;
    bringFleetToActivity = this.shipCrewBindings.bringFleetToActivity;
    bringFleetAndInviteMembers = this.shipCrewBindings.bringFleetAndInviteMembers;
    inviteFleetMembers = this.shipCrewBindings.inviteFleetMembers;
    nestShip = this.shipCrewBindings.nestShip;
    addRoutePlan = this.routeOrgVoiceBindings.addRoutePlan;
    updateWaypoint = this.routeOrgVoiceBindings.updateWaypoint;
    enrichWithMiningData = this.routeOrgVoiceBindings.enrichWithMiningData;
    inviteOrganization = this.routeOrgVoiceBindings.inviteOrganization;
    acceptOrganizationInvite = this.routeOrgVoiceBindings.acceptOrganizationInvite;
    declineOrganizationInvite = this.routeOrgVoiceBindings.declineOrganizationInvite;
    createVoiceChannel = this.routeOrgVoiceBindings.createVoiceChannel;
    linkVoiceChannel = this.routeOrgVoiceBindings.linkVoiceChannel;
    listOrgActivities = activityController_lifecycleDiscovery_1.listOrgActivitiesHandler;
    getPublicActivityById = async (req, res) => {
        await (0, activityController_lifecycleDiscovery_1.getPublicActivityByIdHandler)(req, res, {
            hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
        });
    };
    getActivityById = async (req, res) => {
        await (0, activityController_lifecycleDiscovery_1.getActivityByIdHandler)(req, res, {
            hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
        });
    };
    createActivity = async (req, res) => {
        await (0, activityController_lifecycleDiscovery_1.createActivityHandler)(req, res, {
            findOrganizationById: this.sharedHelpers.findOrganizationById.bind(this.sharedHelpers),
            participantService: this.participantService,
            notifyOrg: this.sharedHelpers.notifyOrg.bind(this.sharedHelpers),
        });
    };
    updateActivity = async (req, res) => {
        await (0, activityController_lifecycleDiscovery_1.updateActivityHandler)(req, res, {
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
            applyAllowedActivityUpdates: this.sharedHelpers.applyAllowedActivityUpdates.bind(this.sharedHelpers),
            applyScheduleUpdates: this.sharedHelpers.applyScheduleUpdates.bind(this.sharedHelpers),
            applyMetadataUpdate: this.sharedHelpers.applyMetadataUpdate.bind(this.sharedHelpers),
            hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
        });
    };
    deleteActivity = async (req, res) => {
        await (0, activityController_lifecycleDiscovery_1.deleteActivityHandler)(req, res, {
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
        });
    };
    getRecommendedActivities = activityController_lifecycleDiscovery_1.getRecommendedActivitiesHandler;
    getUpcomingActivities = activityController_lifecycleDiscovery_1.getUpcomingActivitiesHandler;
    getActivityAnalytics = activityController_lifecycleDiscovery_1.getActivityAnalyticsHandler;
    joinActivity = async (req, res) => {
        await (0, activityController_participation_1.joinActivityHandler)(req, res, {
            participantService: this.participantService,
            hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
            notifyActivityJoined: this.sharedHelpers.notifyActivityJoined.bind(this.sharedHelpers),
        });
    };
    leaveActivity = async (req, res) => {
        await (0, activityController_participation_1.leaveActivityHandler)(req, res, {
            participantService: this.participantService,
            hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
        });
    };
    getParticipants = async (req, res) => {
        await (0, activityController_participation_1.getParticipantsHandler)(req, res, {
            participantService: this.participantService,
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
        });
    };
    updateParticipant = async (req, res) => {
        await (0, activityController_participation_1.updateParticipantHandler)(req, res, {
            participantService: this.participantService,
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
            hydrateParticipants: this.sharedHelpers.hydrateParticipants.bind(this.sharedHelpers),
        });
    };
    searchActivities = activityController_searchDiscovery_1.searchActivitiesHandler;
    getMyActivities = activityController_searchDiscovery_1.getMyActivitiesHandler;
    getActivityStatistics = activityController_searchDiscovery_1.getActivityStatisticsHandler;
    getActivityCalendar = activityController_statusCalendarReminder_1.getActivityCalendarHandler;
    exportActivityToCalendar = async (req, res) => {
        await (0, activityController_statusCalendarReminder_1.exportActivityToCalendarHandler)(req, res, {
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
        });
    };
    createActivityReminder = async (req, res) => {
        await (0, activityController_statusCalendarReminder_1.createActivityReminderHandler)(req, res, {
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
        });
    };
    getActivityReminders = async (req, res) => {
        await (0, activityController_statusCalendarReminder_1.getActivityRemindersHandler)(req, res, {
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
        });
    };
    updateActivityStatus = async (req, res) => {
        await (0, activityController_statusCalendarReminder_1.updateActivityStatusHandler)(req, res, {
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
            notifyOrg: this.sharedHelpers.notifyOrg.bind(this.sharedHelpers),
        });
    };
    batchCreateActivities = activityController_batchOperations_1.batchCreateActivitiesHandler;
    batchUpdateActivities = async (req, res) => {
        await (0, activityController_batchOperations_1.batchUpdateActivitiesHandler)(req, res, {
            findActivityById: (id) => this.sharedHelpers.findActivityById(id),
        });
    };
    batchDeleteActivities = async (req, res) => {
        await (0, activityController_batchOperations_1.batchDeleteActivitiesHandler)(req, res, {
            findActivityById: (id) => this.sharedHelpers.findActivityById(id),
        });
    };
    completeActivity = async (req, res) => {
        await (0, activityController_statusCalendarReminder_1.completeActivityHandler)(req, res, {
            getCompletionActivityForUser: this.getCompletionActivityForUser.bind(this),
        });
    };
    cancelActivity = async (req, res) => {
        await (0, activityController_statusCalendarReminder_1.cancelActivityHandler)(req, res, {
            getCompletionActivityForUser: this.getCompletionActivityForUser.bind(this),
            activityEventService: this.activityEventService,
        });
    };
    createActivityFull = async (req, res) => {
        await (0, activityController_fullFlowQuickJoin_1.createActivityFullHandler)(req, res, {
            organizationServiceCanUserAccessOrganization: (userId, orgId) => this.organizationService.canUserAccessOrganization(userId, orgId),
        });
    };
    completeActivityFull = async (req, res) => {
        await (0, activityController_fullFlowQuickJoin_1.completeActivityFullHandler)(req, res, {
            getCompletionActivityForUser: this.getCompletionActivityForUser.bind(this),
        });
    };
    generateJoinLink = async (req, res) => {
        await (0, activityController_fullFlowQuickJoin_1.generateJoinLinkHandler)(req, res, {
            findActivityById: this.sharedHelpers.findActivityById.bind(this.sharedHelpers),
        });
    };
    previewActivityByToken = async (req, res) => {
        await (0, activityController_fullFlowQuickJoin_1.previewActivityByTokenHandler)(req, res, {
            findActivityByQuickJoinToken: this.sharedHelpers.findActivityByQuickJoinToken.bind(this.sharedHelpers),
            getParticipantCount: this.participantService.getParticipantCount.bind(this.participantService),
        });
    };
    joinActivityByToken = async (req, res) => {
        await (0, activityController_fullFlowQuickJoin_1.joinActivityByTokenHandler)(req, res, {
            findActivityByQuickJoinToken: this.sharedHelpers.findActivityByQuickJoinToken.bind(this.sharedHelpers),
            validateQuickJoinActivity: this.sharedHelpers.validateQuickJoinActivity.bind(this.sharedHelpers),
            isParticipant: this.participantService.isParticipant.bind(this.participantService),
            joinActivityByToken: this.participantService.joinActivity.bind(this.participantService),
        });
    };
    findActivityById = (id, options) => this.sharedHelpers.findActivityById(id, options);
    getScopedOrganizationId = (req) => this.sharedHelpers.getScopedOrganizationId(req);
    getCompletionActivityForUser = (req, activityId, userId, options) => (0, activityController_coreHelpers_1.getCompletionActivityForUserHelper)({
        req,
        activityId,
        userId,
        options,
        getScopedOrganizationId: this.getScopedOrganizationId,
        findActivityById: this.findActivityById,
        canUserAccessOrganization: (actorUserId, orgId) => this.organizationService.canUserAccessOrganization(actorUserId, orgId),
    });
}
exports.ActivityControllerV2 = ActivityControllerV2;
//# sourceMappingURL=activityController.js.map