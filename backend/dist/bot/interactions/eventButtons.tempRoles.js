"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTempRoleUpdate = handleTempRoleUpdate;
const EventTempRoleService_1 = require("../../services/activity/EventTempRoleService");
const logger_1 = require("../../utils/logger");
const eventButtons_services_1 = require("./eventButtons.services");
const TEMP_ROLE_ASSIGN_ACTIONS = new Set(['join']);
const TEMP_ROLE_REMOVE_ACTIONS = new Set(['decline', 'leave']);
function handleTempRoleUpdate(interaction, activityId, userId, action) {
    if (!interaction.guild) {
        return;
    }
    if (!TEMP_ROLE_ASSIGN_ACTIONS.has(action) && !TEMP_ROLE_REMOVE_ACTIONS.has(action)) {
        return;
    }
    const guild = interaction.guild;
    const tempRoleService = EventTempRoleService_1.EventTempRoleService.getInstance();
    (0, eventButtons_services_1.getActivityService)()
        .getActivityById(activityId)
        .then(activity => {
        const tempRoleId = activity?.metadata?.tempRoleId;
        if (!tempRoleId) {
            return;
        }
        if (TEMP_ROLE_ASSIGN_ACTIONS.has(action)) {
            return tempRoleService.assignTempRole(guild, userId, tempRoleId, activityId);
        }
        else {
            return tempRoleService.removeTempRole(guild, userId, tempRoleId, activityId);
        }
    })
        .catch(err => {
        logger_1.logger.warn('Temp role update failed (non-critical)', {
            activityId,
            userId,
            action,
            error: err instanceof Error ? err.message : String(err),
        });
    });
}
//# sourceMappingURL=eventButtons.tempRoles.js.map