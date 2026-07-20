"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityService = getActivityService;
exports.getUserService = getUserService;
exports.getParticipantService = getParticipantService;
exports.getFleetService = getFleetService;
exports.getReminderService = getReminderService;
const activity_1 = require("../../services/activity");
const ActivityParticipantService_1 = require("../../services/activity/ActivityParticipantService");
const ActivityReminderService_1 = require("../../services/activity/ActivityReminderService");
const communication_1 = require("../../services/communication");
const FleetService_1 = require("../../services/fleet/FleetService");
const UserService_1 = require("../../services/user/UserService");
let _activityService = null;
function getActivityService() {
    if (!_activityService) {
        _activityService = new activity_1.ActivityService();
    }
    return _activityService;
}
let _userService = null;
function getUserService() {
    _userService ??= new UserService_1.UserService();
    return _userService;
}
let _participantService = null;
function getParticipantService() {
    _participantService ??= new ActivityParticipantService_1.ActivityParticipantService();
    return _participantService;
}
let _fleetService = null;
function getFleetService() {
    _fleetService ??= new FleetService_1.FleetService();
    return _fleetService;
}
let _reminderService = null;
function getReminderService() {
    _reminderService ??= new ActivityReminderService_1.ActivityReminderService(new communication_1.NotificationService());
    return _reminderService;
}
//# sourceMappingURL=eventButtons.services.js.map