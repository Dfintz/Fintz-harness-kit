"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchDirectAction = dispatchDirectAction;
exports.getEphemeralLeaveConfirmation = getEphemeralLeaveConfirmation;
const eventButtons_bringFleet_1 = require("./eventButtons.bringFleet");
const eventButtons_bringShip_1 = require("./eventButtons.bringShip");
const eventButtons_cancel_1 = require("./eventButtons.cancel");
const eventButtons_clone_1 = require("./eventButtons.clone");
const eventButtons_edit_1 = require("./eventButtons.edit");
const eventButtons_manageSlots_1 = require("./eventButtons.manageSlots");
const eventButtons_panelReminder_1 = require("./eventButtons.panelReminder");
const eventButtons_passenger_1 = require("./eventButtons.passenger");
const eventButtons_requestShip_1 = require("./eventButtons.requestShip");
const eventButtons_shipCrew_1 = require("./eventButtons.shipCrew");
const handleCancelEventPromptAction = async (interaction, activityId) => {
    await (0, eventButtons_cancel_1.handleCancelEventPrompt)(interaction, activityId);
};
const handleCancelEventAction = async (interaction, activityId) => {
    await (0, eventButtons_cancel_1.handleCancelEvent)(interaction, activityId);
};
const handleCancelEventDismissAction = async (interaction, activityId) => {
    await (0, eventButtons_cancel_1.handleCancelEventDismiss)(interaction, activityId);
};
const handleOpenActionsPanelAction = async (interaction, activityId) => {
    await (0, eventButtons_panelReminder_1.handleOpenActionsPanel)(interaction, activityId);
};
const handleRemindMeAction = async (interaction, activityId) => {
    await (0, eventButtons_panelReminder_1.handleRemindMe)(interaction, activityId);
};
const directActionHandlers = {
    actions: handleOpenActionsPanelAction,
    bringship: eventButtons_bringShip_1.handleBringShip,
    removeship: eventButtons_shipCrew_1.handleRemoveShip,
    joincrew: eventButtons_shipCrew_1.handleJoinCrew,
    joinpassenger: eventButtons_passenger_1.handleJoinPassenger,
    requestship: eventButtons_requestShip_1.handleRequestShip,
    manageslots: eventButtons_manageSlots_1.handleManageSlots,
    bringfleet: eventButtons_bringFleet_1.handleBringFleet,
    remindme: handleRemindMeAction,
    cancel: handleCancelEventPromptAction,
    confirmcancel: handleCancelEventAction,
    canceldismiss: handleCancelEventDismissAction,
    edit: eventButtons_edit_1.handleEditEvent,
    clone: eventButtons_clone_1.handleCloneEvent,
};
async function dispatchDirectAction(interaction, action, activityId) {
    const directHandler = directActionHandlers[action];
    if (!directHandler) {
        return false;
    }
    await directHandler(interaction, activityId);
    return true;
}
function getEphemeralLeaveConfirmation(action) {
    return (0, eventButtons_panelReminder_1.ephemeralLeaveConfirmation)(action);
}
//# sourceMappingURL=eventButtons.directActions.js.map