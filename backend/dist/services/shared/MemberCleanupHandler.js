"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberCleanupHandler = void 0;
exports.getMemberCleanupHandler = getMemberCleanupHandler;
const logger_1 = require("../../utils/logger");
const AvailabilityService_1 = require("../calendar/AvailabilityService");
const TeamService_1 = require("../team/TeamService");
const DomainEventBus_1 = require("./DomainEventBus");
class MemberCleanupHandler {
    teamService;
    availabilityService;
    subscribed = false;
    constructor(teamService, availabilityService) {
        this.teamService = teamService || new TeamService_1.TeamService();
        this.availabilityService = availabilityService || new AvailabilityService_1.AvailabilityService();
    }
    subscribeToEvents() {
        if (this.subscribed) {
            return;
        }
        this.subscribed = true;
        DomainEventBus_1.domainEvents.on('member:platform_left', p => this.onPlatformLeft(p));
        logger_1.logger.info('MemberCleanupHandler: subscribed to member:platform_left');
    }
    async onPlatformLeft(payload) {
        const { userId, organizationId, username } = payload;
        logger_1.logger.info('MemberCleanupHandler: processing platform_left', {
            userId,
            organizationId,
            username,
        });
        let teamsRemoved = 0;
        try {
            teamsRemoved = await this.teamService.removeUserFromAllTeams(organizationId, userId);
        }
        catch (err) {
            logger_1.logger.error('MemberCleanupHandler: failed to remove user from teams', {
                userId,
                organizationId,
                error: err,
            });
        }
        try {
            await this.availabilityService.setAvailability(userId, organizationId, []);
        }
        catch (err) {
            logger_1.logger.error('MemberCleanupHandler: failed to clear availability', {
                userId,
                organizationId,
                error: err,
            });
        }
        logger_1.logger.info(`MemberCleanupHandler: cleaned up member ${username}: removed from ${teamsRemoved} teams, cleared availability`, { userId, organizationId });
    }
}
exports.MemberCleanupHandler = MemberCleanupHandler;
let _memberCleanupHandler = null;
function getMemberCleanupHandler() {
    if (!_memberCleanupHandler) {
        _memberCleanupHandler = new MemberCleanupHandler();
        _memberCleanupHandler.subscribeToEvents();
    }
    return _memberCleanupHandler;
}
//# sourceMappingURL=MemberCleanupHandler.js.map