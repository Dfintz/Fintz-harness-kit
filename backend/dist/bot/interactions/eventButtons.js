"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRemoveShipSelectMenu = exports.handleCrewSelectMenu = exports.handleReqShipTypeSelect = exports.handleReqShipRoleSelect = exports.handleReqShipModal = exports.handlePassengerSelectMenu = exports.handleManageSlotsShipSelect = exports.handleManageSlotsModal = exports.buildHangarGroups = exports.resolveDiscordIdMap = exports.collectUserIdsForEmbed = exports.buildEmbedDataFromActivity = exports.handleEditEventModal = exports.handleNestShipSelect = exports.handleHangarShipSelect = exports.handleHangarPageSelect = exports.handleBringShipModal = exports.handleFleetInviteResponse = exports.handleBringFleetSelect = void 0;
exports.handleEventButton = handleEventButton;
const discord_js_1 = require("discord.js");
const errorHandler_1 = require("../../utils/errorHandler");
const eventEmbed_1 = require("../embeds/eventEmbed");
const eventButtons_actorContext_1 = require("./eventButtons.actorContext");
const eventButtons_directActions_1 = require("./eventButtons.directActions");
const eventButtons_messages_1 = require("./eventButtons.messages");
const eventButtons_nonDirectPipeline_1 = require("./eventButtons.nonDirectPipeline");
const eventButtons_security_1 = require("./eventButtons.security");
var eventButtons_bringFleet_1 = require("./eventButtons.bringFleet");
Object.defineProperty(exports, "handleBringFleetSelect", { enumerable: true, get: function () { return eventButtons_bringFleet_1.handleBringFleetSelect; } });
Object.defineProperty(exports, "handleFleetInviteResponse", { enumerable: true, get: function () { return eventButtons_bringFleet_1.handleFleetInviteResponse; } });
var eventButtons_bringShip_1 = require("./eventButtons.bringShip");
Object.defineProperty(exports, "handleBringShipModal", { enumerable: true, get: function () { return eventButtons_bringShip_1.handleBringShipModal; } });
Object.defineProperty(exports, "handleHangarPageSelect", { enumerable: true, get: function () { return eventButtons_bringShip_1.handleHangarPageSelect; } });
Object.defineProperty(exports, "handleHangarShipSelect", { enumerable: true, get: function () { return eventButtons_bringShip_1.handleHangarShipSelect; } });
Object.defineProperty(exports, "handleNestShipSelect", { enumerable: true, get: function () { return eventButtons_bringShip_1.handleNestShipSelect; } });
var eventButtons_edit_1 = require("./eventButtons.edit");
Object.defineProperty(exports, "handleEditEventModal", { enumerable: true, get: function () { return eventButtons_edit_1.handleEditEventModal; } });
var eventButtons_embedData_1 = require("./eventButtons.embedData");
Object.defineProperty(exports, "buildEmbedDataFromActivity", { enumerable: true, get: function () { return eventButtons_embedData_1.buildEmbedDataFromActivity; } });
Object.defineProperty(exports, "collectUserIdsForEmbed", { enumerable: true, get: function () { return eventButtons_embedData_1.collectUserIdsForEmbed; } });
Object.defineProperty(exports, "resolveDiscordIdMap", { enumerable: true, get: function () { return eventButtons_embedData_1.resolveDiscordIdMap; } });
var eventButtons_hangarGroups_1 = require("./eventButtons.hangarGroups");
Object.defineProperty(exports, "buildHangarGroups", { enumerable: true, get: function () { return eventButtons_hangarGroups_1.buildHangarGroups; } });
var eventButtons_manageSlots_1 = require("./eventButtons.manageSlots");
Object.defineProperty(exports, "handleManageSlotsModal", { enumerable: true, get: function () { return eventButtons_manageSlots_1.handleManageSlotsModal; } });
Object.defineProperty(exports, "handleManageSlotsShipSelect", { enumerable: true, get: function () { return eventButtons_manageSlots_1.handleManageSlotsShipSelect; } });
var eventButtons_passenger_1 = require("./eventButtons.passenger");
Object.defineProperty(exports, "handlePassengerSelectMenu", { enumerable: true, get: function () { return eventButtons_passenger_1.handlePassengerSelectMenu; } });
var eventButtons_requestShip_1 = require("./eventButtons.requestShip");
Object.defineProperty(exports, "handleReqShipModal", { enumerable: true, get: function () { return eventButtons_requestShip_1.handleReqShipModal; } });
Object.defineProperty(exports, "handleReqShipRoleSelect", { enumerable: true, get: function () { return eventButtons_requestShip_1.handleReqShipRoleSelect; } });
Object.defineProperty(exports, "handleReqShipTypeSelect", { enumerable: true, get: function () { return eventButtons_requestShip_1.handleReqShipTypeSelect; } });
var eventButtons_shipCrew_1 = require("./eventButtons.shipCrew");
Object.defineProperty(exports, "handleCrewSelectMenu", { enumerable: true, get: function () { return eventButtons_shipCrew_1.handleCrewSelectMenu; } });
Object.defineProperty(exports, "handleRemoveShipSelectMenu", { enumerable: true, get: function () { return eventButtons_shipCrew_1.handleRemoveShipSelectMenu; } });
async function handleEventButton(interaction) {
    const parsed = (0, eventEmbed_1.parseEventButtonId)(interaction.customId);
    if (!parsed) {
        await interaction.reply({
            content: '❌ Unknown button action.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const { action, activityId } = parsed;
    const userName = interaction.user.username;
    const handledDirectly = await (0, eventButtons_directActions_1.dispatchDirectAction)(interaction, action, activityId);
    if (handledDirectly) {
        return;
    }
    const actorContext = await (0, eventButtons_actorContext_1.resolveActionActorContext)(interaction);
    if (!actorContext) {
        return;
    }
    const { userId, isDiscordGuest, guestContext } = actorContext;
    const isEphemeralSource = interaction.message?.flags?.has(discord_js_1.MessageFlags.Ephemeral) ?? false;
    await interaction.deferUpdate();
    try {
        await (0, eventButtons_nonDirectPipeline_1.runDeferredNonDirectPipeline)({
            interaction,
            action,
            activityId,
            userId,
            userName,
            isDiscordGuest,
            guestContext,
            isEphemeralSource,
        });
    }
    catch (error) {
        await interaction.followUp({
            content: (0, eventButtons_messages_1.getUserFriendlyError)((0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))),
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
//# sourceMappingURL=eventButtons.js.map