"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyFeatureFlagChange = exports.sendFeatureFlagUpdateToOrganization = exports.sendFeatureFlagUpdateToUser = exports.broadcastFeatureFlagUpdate = void 0;
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../websocketServer");
const broadcastFeatureFlagUpdate = (update) => {
    const fullUpdate = {
        ...update,
        timestamp: Date.now()
    };
    const event = {
        type: `feature-flag:${update.action}`,
        update: fullUpdate
    };
    (0, websocketServer_1.broadcastEvent)('feature-flag:updated', event);
    logger_1.logger.info('Broadcasted feature flag update', { flagId: update.flagId, action: update.action });
};
exports.broadcastFeatureFlagUpdate = broadcastFeatureFlagUpdate;
const sendFeatureFlagUpdateToUser = (userId, update) => {
    const fullUpdate = {
        ...update,
        timestamp: Date.now()
    };
    const event = {
        type: `feature-flag:${update.action}`,
        update: fullUpdate,
        userId
    };
    (0, websocketServer_1.emitToUser)(userId, 'feature-flag:updated', event);
    logger_1.logger.debug('Sent feature flag update to user', { userId, flagId: update.flagId });
};
exports.sendFeatureFlagUpdateToUser = sendFeatureFlagUpdateToUser;
const sendFeatureFlagUpdateToOrganization = (organizationId, update) => {
    const fullUpdate = {
        ...update,
        timestamp: Date.now()
    };
    const event = {
        type: `feature-flag:${update.action}`,
        update: fullUpdate,
        organizationId
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'feature-flag:updated', event);
    logger_1.logger.debug('Sent feature flag update to organization', { organizationId, flagId: update.flagId });
};
exports.sendFeatureFlagUpdateToOrganization = sendFeatureFlagUpdateToOrganization;
const notifyFeatureFlagChange = async (flagId, action, scope, status, percentage, targetOrganizations, targetUsers) => {
    const update = {
        flagId,
        action,
        status,
        scope,
        percentage,
        targetOrganizations,
        targetUsers
    };
    if (scope === 'global' || scope === 'beta_users') {
        (0, exports.broadcastFeatureFlagUpdate)(update);
    }
    else if (scope === 'organization' && targetOrganizations) {
        for (const orgId of targetOrganizations) {
            (0, exports.sendFeatureFlagUpdateToOrganization)(orgId, update);
        }
    }
    else if (scope === 'user' && targetUsers) {
        for (const userId of targetUsers) {
            (0, exports.sendFeatureFlagUpdateToUser)(userId, update);
        }
    }
};
exports.notifyFeatureFlagChange = notifyFeatureFlagChange;
//# sourceMappingURL=featureFlagWebSocketController.js.map