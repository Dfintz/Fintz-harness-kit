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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityControllerRouteOrgVoiceBindings = void 0;
exports.addRoutePlanHandler = addRoutePlanHandler;
exports.updateWaypointHandler = updateWaypointHandler;
exports.enrichWithMiningDataHandler = enrichWithMiningDataHandler;
exports.inviteOrganizationHandler = inviteOrganizationHandler;
exports.acceptOrganizationInviteHandler = acceptOrganizationInviteHandler;
exports.declineOrganizationInviteHandler = declineOrganizationInviteHandler;
exports.createVoiceChannelHandler = createVoiceChannelHandler;
exports.linkVoiceChannelHandler = linkVoiceChannelHandler;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
async function getActivityServiceInstance() {
    const { ActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/activity/ActivityService')));
    return new ActivityService();
}
async function addRoutePlanHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { waypoints } = req.body;
        if (!waypoints || !Array.isArray(waypoints)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Waypoints array is required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.addRoutePlan(activityId, userId, waypoints);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to add route plan'), 500);
    }
}
async function updateWaypointHandler(req, res) {
    try {
        const { id: activityId, order } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const waypointOrder = Number.parseInt(order);
        if (Number.isNaN(waypointOrder)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Invalid waypoint order', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.updateWaypoint(activityId, userId, waypointOrder, req.body);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update waypoint'), 500);
    }
}
async function enrichWithMiningDataHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.enrichWithMiningData(activityId);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to enrich mining data'), 500);
    }
}
async function inviteOrganizationHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        const { organizationId, organizationName, role } = req.body;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        if (!organizationId || !organizationName) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization ID and name are required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.inviteOrganization(activityId, organizationId, organizationName, userId, role ?? 'participant');
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to invite organization'), 500);
    }
}
async function acceptOrganizationInviteHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        const organizationId = req.user?.currentOrganizationId;
        if (!userId || !organizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.acceptOrganizationInvite(activityId, organizationId, userId);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to accept organization invite'), 500);
    }
}
async function declineOrganizationInviteHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const organizationId = req.user?.currentOrganizationId;
        if (!organizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.declineOrganizationInvite(activityId, organizationId);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to decline organization invite'), 500);
    }
}
async function createVoiceChannelHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        const { templateId, userLimit, bitrate } = req.body;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.getActivityById(activityId);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
        if (activity.creatorId !== userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only creator can create voice channel', 403);
        }
        await activityService.createVoiceChannelForActivity(activity, templateId, userLimit, bitrate);
        res.success({ message: 'Voice channel configured', activity });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create voice channel'), 500);
    }
}
async function linkVoiceChannelHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        const { channelId, guildId } = req.body;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        if (!channelId || !guildId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Channel ID and Guild ID are required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.linkVoiceChannel(activityId, channelId, guildId);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to link voice channel'), 500);
    }
}
class ActivityControllerRouteOrgVoiceBindings {
    addRoutePlan = addRoutePlanHandler;
    updateWaypoint = updateWaypointHandler;
    enrichWithMiningData = enrichWithMiningDataHandler;
    inviteOrganization = inviteOrganizationHandler;
    acceptOrganizationInvite = acceptOrganizationInviteHandler;
    declineOrganizationInvite = declineOrganizationInviteHandler;
    createVoiceChannel = createVoiceChannelHandler;
    linkVoiceChannel = linkVoiceChannelHandler;
}
exports.ActivityControllerRouteOrgVoiceBindings = ActivityControllerRouteOrgVoiceBindings;
//# sourceMappingURL=activityController.routeOrgVoice.js.map