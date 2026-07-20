"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityControllerSharedHelpers = void 0;
const activityController_coreHelpers_1 = require("./activityController.coreHelpers");
const activityController_quickJoinHelpers_1 = require("./activityController.quickJoinHelpers");
class ActivityControllerSharedHelpers {
    participantService;
    organizationService;
    notificationRouter;
    constructor(participantService, organizationService, notificationRouter) {
        this.participantService = participantService;
        this.organizationService = organizationService;
        this.notificationRouter = notificationRouter;
    }
    async findActivityById(id, options) {
        return (0, activityController_coreHelpers_1.findActivityByIdHelper)(id, options);
    }
    getScopedOrganizationId(req) {
        return (0, activityController_coreHelpers_1.getScopedOrganizationIdHelper)(req);
    }
    async getCompletionActivityForUser(req, activityId, userId, options) {
        return (0, activityController_coreHelpers_1.getCompletionActivityForUserHelper)({
            req,
            activityId,
            userId,
            options,
            getScopedOrganizationId: this.getScopedOrganizationId.bind(this),
            findActivityById: this.findActivityById.bind(this),
            canUserAccessOrganization: (actorUserId, orgId) => this.organizationService.canUserAccessOrganization(actorUserId, orgId),
        });
    }
    async findOrganizationById(orgId) {
        return (0, activityController_coreHelpers_1.findOrganizationByIdHelper)(orgId, this.organizationService.getOrganizationById.bind(this.organizationService));
    }
    applyAllowedActivityUpdates(activity, updates) {
        (0, activityController_coreHelpers_1.applyAllowedActivityUpdatesHelper)(activity, updates);
    }
    applyScheduleUpdates(activity, updates) {
        (0, activityController_coreHelpers_1.applyScheduleUpdatesHelper)(activity, updates);
    }
    applyMetadataUpdate(activity, updates) {
        (0, activityController_coreHelpers_1.applyMetadataUpdateHelper)(activity, updates);
    }
    async hydrateParticipants(activity) {
        await (0, activityController_coreHelpers_1.hydrateParticipantsHelper)(activity, this.participantService.getParticipants.bind(this.participantService));
    }
    notifyOrg(input) {
        (0, activityController_coreHelpers_1.notifyOrgHelper)(input, this.notificationRouter.notifyOrganization.bind(this.notificationRouter));
    }
    notifyActivityJoined(activity, userId, userName) {
        (0, activityController_quickJoinHelpers_1.notifyActivityJoinedHelper)({
            activity,
            userId,
            userName,
            notifyUser: this.notificationRouter.notifyUser.bind(this.notificationRouter),
            notifyOrg: this.notifyOrg.bind(this),
        });
    }
    validateQuickJoinActivity(activity) {
        (0, activityController_quickJoinHelpers_1.validateQuickJoinActivityHelper)(activity);
    }
    async findActivityByQuickJoinToken(token) {
        return (0, activityController_quickJoinHelpers_1.findActivityByQuickJoinTokenHelper)(token, this.tokensEqualConstantTime.bind(this));
    }
    tokensEqualConstantTime(left, right) {
        return (0, activityController_quickJoinHelpers_1.tokensEqualConstantTimeHelper)(left, right);
    }
}
exports.ActivityControllerSharedHelpers = ActivityControllerSharedHelpers;
//# sourceMappingURL=activityController.sharedHelpers.js.map