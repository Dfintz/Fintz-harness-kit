"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionTemplateType = exports.VoiceChannelType = exports.LFGActivity = exports.RecurrencePattern = exports.RSVPStatus = exports.EventRole = void 0;
var EventRole;
(function (EventRole) {
    EventRole["PILOT"] = "pilot";
    EventRole["ENGINEER"] = "engineer";
    EventRole["GUNNER"] = "gunner";
    EventRole["MEDIC"] = "medic";
    EventRole["VEHICLE_OPERATOR"] = "vehicle_operator";
    EventRole["MARINE"] = "marine";
    EventRole["GROUND_SUPPORT"] = "ground_support";
    EventRole["TANK"] = "tank";
    EventRole["DPS"] = "dps";
    EventRole["SUPPORT"] = "support";
    EventRole["ANY"] = "any";
})(EventRole || (exports.EventRole = EventRole = {}));
var RSVPStatus;
(function (RSVPStatus) {
    RSVPStatus["ACCEPTED"] = "accepted";
    RSVPStatus["TENTATIVE"] = "tentative";
    RSVPStatus["DECLINED"] = "declined";
})(RSVPStatus || (exports.RSVPStatus = RSVPStatus = {}));
var RecurrencePattern;
(function (RecurrencePattern) {
    RecurrencePattern["NONE"] = "none";
    RecurrencePattern["DAILY"] = "daily";
    RecurrencePattern["WEEKLY"] = "weekly";
    RecurrencePattern["MONTHLY"] = "monthly";
})(RecurrencePattern || (exports.RecurrencePattern = RecurrencePattern = {}));
var LFGActivity;
(function (LFGActivity) {
    LFGActivity["PVP"] = "PvP";
    LFGActivity["PVE"] = "PvE";
    LFGActivity["MINING"] = "Mining";
    LFGActivity["TRADING"] = "Trading";
    LFGActivity["EXPLORATION"] = "Exploration";
    LFGActivity["BOUNTY_HUNTING"] = "Bounty Hunting";
    LFGActivity["CARGO_HAULING"] = "Cargo Hauling";
    LFGActivity["RACING"] = "Racing";
    LFGActivity["OTHER"] = "Other";
})(LFGActivity || (exports.LFGActivity = LFGActivity = {}));
var VoiceChannelType;
(function (VoiceChannelType) {
    VoiceChannelType["EVENT"] = "event";
    VoiceChannelType["ACTIVITY"] = "activity";
    VoiceChannelType["TEMPORARY"] = "temporary";
    VoiceChannelType["PERMANENT"] = "permanent";
    VoiceChannelType["DYNAMIC"] = "dynamic";
})(VoiceChannelType || (exports.VoiceChannelType = VoiceChannelType = {}));
var PermissionTemplateType;
(function (PermissionTemplateType) {
    PermissionTemplateType["ADMIN"] = "admin";
    PermissionTemplateType["MODERATOR"] = "moderator";
    PermissionTemplateType["MEMBER"] = "member";
    PermissionTemplateType["RECRUITER"] = "recruiter";
    PermissionTemplateType["FLEET_COMMANDER"] = "fleet_commander";
    PermissionTemplateType["EVENT_COORDINATOR"] = "event_coordinator";
    PermissionTemplateType["FINANCE_MANAGER"] = "finance_manager";
    PermissionTemplateType["GUEST"] = "guest";
    PermissionTemplateType["CUSTOM"] = "custom";
})(PermissionTemplateType || (exports.PermissionTemplateType = PermissionTemplateType = {}));
__exportStar(require("./models"), exports);
//# sourceMappingURL=index.js.map