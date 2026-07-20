"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitReadyCheckCancelled = exports.emitReadyCheckExpired = exports.emitReadyCheckCompleted = exports.emitReadyCheckResponse = exports.emitReadyCheckInitiated = exports.emitActivityReminder = exports.emitActivityStatusChanged = exports.emitParticipantLeft = exports.emitParticipantJoined = exports.emitActivityDeleted = exports.emitActivityUpdated = exports.emitActivityCreated = void 0;
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../websocketServer");
const emitActivityCreated = (organizationId, activity, userId) => {
    if (!organizationId) {
        return;
    }
    const event = {
        type: 'activity:created',
        organizationId,
        activityId: activity.id,
        data: activity,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:created', event);
    logger_1.logger.debug(`Emitted activity:created for activity ${activity.id} in org ${organizationId}`);
};
exports.emitActivityCreated = emitActivityCreated;
const emitActivityUpdated = (organizationId, activity, userId) => {
    if (!organizationId) {
        return;
    }
    const event = {
        type: 'activity:updated',
        organizationId,
        activityId: activity.id,
        data: activity,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:updated', event);
    logger_1.logger.debug(`Emitted activity:updated for activity ${activity.id} in org ${organizationId}`);
};
exports.emitActivityUpdated = emitActivityUpdated;
const emitActivityDeleted = (organizationId, activityId, userId) => {
    if (!organizationId) {
        return;
    }
    const event = {
        type: 'activity:deleted',
        organizationId,
        activityId,
        data: { id: activityId },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:deleted', event);
    logger_1.logger.debug(`Emitted activity:deleted for activity ${activityId} in org ${organizationId}`);
};
exports.emitActivityDeleted = emitActivityDeleted;
const emitParticipantJoined = (organizationId, activityId, participant, userId) => {
    const event = {
        type: 'activity:participant_joined',
        organizationId,
        activityId,
        data: { participant },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:participant_joined', event);
    logger_1.logger.debug(`Emitted activity:participant_joined for activity ${activityId} in org ${organizationId}`);
};
exports.emitParticipantJoined = emitParticipantJoined;
const emitParticipantLeft = (organizationId, activityId, participantId, userId) => {
    const event = {
        type: 'activity:participant_left',
        organizationId,
        activityId,
        data: { participantId },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:participant_left', event);
    logger_1.logger.debug(`Emitted activity:participant_left for activity ${activityId} in org ${organizationId}`);
};
exports.emitParticipantLeft = emitParticipantLeft;
const emitActivityStatusChanged = (organizationId, activityId, oldStatus, newStatus, userId) => {
    const event = {
        type: 'activity:status_changed',
        organizationId,
        activityId,
        data: { oldStatus, newStatus },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:status_changed', event);
    logger_1.logger.debug(`Emitted activity:status_changed for activity ${activityId} in org ${organizationId}`);
};
exports.emitActivityStatusChanged = emitActivityStatusChanged;
const emitActivityReminder = (organizationId, activityId, activity, reminderMinutes) => {
    const event = {
        type: 'activity:reminder',
        organizationId,
        activityId,
        data: { activity, reminderMinutes },
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:reminder', event);
    logger_1.logger.debug(`Emitted activity:reminder for activity ${activityId} in org ${organizationId} (${reminderMinutes} minutes)`);
};
exports.emitActivityReminder = emitActivityReminder;
const emitReadyCheckInitiated = (organizationId, activityId, readyCheck, userId) => {
    const event = {
        type: 'activity:ready_check_initiated',
        organizationId,
        activityId,
        data: readyCheck,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:ready_check_initiated', event);
    logger_1.logger.debug(`Emitted activity:ready_check_initiated for activity ${activityId} in org ${organizationId}`);
};
exports.emitReadyCheckInitiated = emitReadyCheckInitiated;
const emitReadyCheckResponse = (organizationId, activityId, readyCheckSummary, userId) => {
    const event = {
        type: 'activity:ready_check_response',
        organizationId,
        activityId,
        data: readyCheckSummary,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:ready_check_response', event);
    logger_1.logger.debug(`Emitted activity:ready_check_response for activity ${activityId} in org ${organizationId}`);
};
exports.emitReadyCheckResponse = emitReadyCheckResponse;
const emitReadyCheckCompleted = (organizationId, activityId, readyCheckSummary, userId) => {
    const event = {
        type: 'activity:ready_check_completed',
        organizationId,
        activityId,
        data: readyCheckSummary,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:ready_check_completed', event);
    logger_1.logger.debug(`Emitted activity:ready_check_completed for activity ${activityId} in org ${organizationId}`);
};
exports.emitReadyCheckCompleted = emitReadyCheckCompleted;
const emitReadyCheckExpired = (organizationId, activityId, readyCheckSummary) => {
    const event = {
        type: 'activity:ready_check_expired',
        organizationId,
        activityId,
        data: readyCheckSummary,
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:ready_check_expired', event);
    logger_1.logger.debug(`Emitted activity:ready_check_expired for activity ${activityId} in org ${organizationId}`);
};
exports.emitReadyCheckExpired = emitReadyCheckExpired;
const emitReadyCheckCancelled = (organizationId, activityId, userId) => {
    const event = {
        type: 'activity:ready_check_cancelled',
        organizationId,
        activityId,
        data: { cancelled: true },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:ready_check_cancelled', event);
    logger_1.logger.debug(`Emitted activity:ready_check_cancelled for activity ${activityId} in org ${organizationId}`);
};
exports.emitReadyCheckCancelled = emitReadyCheckCancelled;
//# sourceMappingURL=activityWebSocketController.js.map