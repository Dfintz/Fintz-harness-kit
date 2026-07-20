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
exports.ActivityControllerShipCrewBindings = void 0;
exports.addShipHandler = addShipHandler;
exports.loanShipsHandler = loanShipsHandler;
exports.joinShipCrewHandler = joinShipCrewHandler;
exports.leaveShipCrewHandler = leaveShipCrewHandler;
exports.getAvailableCrewPositionsHandler = getAvailableCrewPositionsHandler;
exports.setCrewPositionHandler = setCrewPositionHandler;
exports.setPassengerSlotsHandler = setPassengerSlotsHandler;
exports.joinShipPassengerHandler = joinShipPassengerHandler;
exports.leaveShipPassengerHandler = leaveShipPassengerHandler;
exports.getAvailablePassengerSlotsHandler = getAvailablePassengerSlotsHandler;
exports.setCrewSlotsHandler = setCrewSlotsHandler;
exports.getCrewSlotAvailabilityHandler = getCrewSlotAvailabilityHandler;
exports.bringFleetToActivityHandler = bringFleetToActivityHandler;
exports.bringFleetAndInviteMembersHandler = bringFleetAndInviteMembersHandler;
exports.inviteFleetMembersHandler = inviteFleetMembersHandler;
exports.nestShipHandler = nestShipHandler;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
async function getActivityServiceInstance() {
    const { ActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/activity/ActivityService')));
    return new ActivityService();
}
async function addShipHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { shipId, shipType, shipName, role, crewCapacity, capabilities, parentShipId, transportType, } = req.body;
        if (!shipType || !role || !crewCapacity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Ship type, role, and crew capacity are required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.addShip(activityId, userId, {
            shipId,
            shipType,
            shipName,
            role,
            crewCapacity,
            capabilities: capabilities ?? [],
            parentShipId,
            transportType,
        });
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to add ship'), 500);
    }
}
async function loanShipsHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        const userName = req.user?.username ?? 'Unknown';
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { ships } = req.body;
        if (!Array.isArray(ships) || ships.length === 0) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Ships array is required and must contain at least one ship', 400);
        }
        for (const ship of ships) {
            if (!ship.shipType) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Each ship must have a shipType', 400);
            }
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.loanShips(activityId, userId, userName, ships);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to loan ships'), 500);
    }
}
async function joinShipCrewHandler(req, res) {
    try {
        const { id: activityId, ownerId } = req.params;
        const userId = req.user?.id;
        const userName = req.user?.username ?? 'Unknown';
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { crewPosition } = req.body;
        if (!crewPosition) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Crew position is required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.joinShipAsCrew(activityId, userId, userName, ownerId, crewPosition);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to join ship crew'), 500);
    }
}
async function leaveShipCrewHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.leaveShipCrew(activityId, userId);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to leave ship crew'), 500);
    }
}
async function getAvailableCrewPositionsHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const activityService = await getActivityServiceInstance();
        const positions = await activityService.getAvailableCrewPositions(activityId);
        res.success({ positions, count: positions.length });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch available crew positions'), 500);
    }
}
async function setCrewPositionHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { targetUserId, shipAssignmentId, crewPosition } = req.body;
        if (!targetUserId || !shipAssignmentId || !crewPosition) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'targetUserId, shipAssignmentId and crewPosition are required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.setCrewPosition(activityId, actorUserId, targetUserId, shipAssignmentId, crewPosition);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to set crew position'), 500);
    }
}
async function setPassengerSlotsHandler(req, res) {
    try {
        const { id: activityId, shipId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { slots } = req.body;
        if (!Array.isArray(slots)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'slots array is required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.setPassengerSlots(activityId, actorUserId, shipId, slots);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to set passenger slots'), 500);
    }
}
async function joinShipPassengerHandler(req, res) {
    try {
        const { id: activityId, shipId } = req.params;
        const userId = req.user?.id;
        const userName = req.user?.username ?? 'Unknown';
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { passengerRole } = req.body;
        if (!passengerRole) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'passengerRole is required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.joinShipAsPassenger(activityId, userId, userName, shipId, passengerRole);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to join as passenger'), 500);
    }
}
async function leaveShipPassengerHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.leaveShipAsPassenger(activityId, userId);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to leave passenger slot'), 500);
    }
}
async function getAvailablePassengerSlotsHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const activityService = await getActivityServiceInstance();
        const slots = await activityService.getAvailablePassengerSlots(activityId, actorUserId);
        res.success({ slots, count: slots.length });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch available passenger slots'), 500);
    }
}
async function setCrewSlotsHandler(req, res) {
    try {
        const { id: activityId, shipId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { slots } = req.body;
        if (!Array.isArray(slots)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'slots array is required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.setCrewSlots(activityId, actorUserId, shipId, slots);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to set crew slots'), 500);
    }
}
async function getCrewSlotAvailabilityHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const activityService = await getActivityServiceInstance();
        const ships = await activityService.getCrewSlotAvailability(activityId, actorUserId);
        res.success({ ships, count: ships.length });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch crew slot availability'), 500);
    }
}
async function bringFleetToActivityHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { fleetId, shipIds } = req.body;
        if (!fleetId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'fleetId is required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.bringFleetToActivity(activityId, actorUserId, fleetId, shipIds);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to bring fleet to activity'), 500);
    }
}
async function bringFleetAndInviteMembersHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { fleetId, shipIds, userIds } = req.body;
        if (!fleetId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'fleetId is required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const result = await activityService.bringFleetAndInviteMembers(activityId, actorUserId, fleetId, {
            shipIds,
            userIds,
        });
        res.success(result);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to bring fleet and invite members'), 500);
    }
}
async function inviteFleetMembersHandler(req, res) {
    try {
        const { id: activityId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { fleetId, userIds } = req.body;
        if (!fleetId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'fleetId is required', 400);
        }
        const activityService = await getActivityServiceInstance();
        const result = await activityService.inviteFleetMembers(activityId, actorUserId, fleetId, userIds);
        res.success(result);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to invite fleet members'), 500);
    }
}
async function nestShipHandler(req, res) {
    try {
        const { id: activityId, shipAssignmentId } = req.params;
        const actorUserId = req.user?.id;
        if (!actorUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const body = req.body;
        const parentShipId = body.parentShipId ?? null;
        const transportType = body.transportType ?? null;
        const activityService = await getActivityServiceInstance();
        const activity = await activityService.nestShip(activityId, actorUserId, shipAssignmentId, {
            parentShipId,
            transportType,
        });
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to nest ship'), 500);
    }
}
class ActivityControllerShipCrewBindings {
    addShip = addShipHandler;
    loanShips = loanShipsHandler;
    joinShipCrew = joinShipCrewHandler;
    leaveShipCrew = leaveShipCrewHandler;
    getAvailableCrewPositions = getAvailableCrewPositionsHandler;
    setCrewPosition = setCrewPositionHandler;
    setPassengerSlots = setPassengerSlotsHandler;
    joinShipPassenger = joinShipPassengerHandler;
    leaveShipPassenger = leaveShipPassengerHandler;
    getAvailablePassengerSlots = getAvailablePassengerSlotsHandler;
    setCrewSlots = setCrewSlotsHandler;
    getCrewSlotAvailability = getCrewSlotAvailabilityHandler;
    bringFleetToActivity = bringFleetToActivityHandler;
    bringFleetAndInviteMembers = bringFleetAndInviteMembersHandler;
    inviteFleetMembers = inviteFleetMembersHandler;
    nestShip = nestShipHandler;
}
exports.ActivityControllerShipCrewBindings = ActivityControllerShipCrewBindings;
//# sourceMappingURL=activityController.shipCrewAssignments.js.map