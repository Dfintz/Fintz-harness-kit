"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoleEmoji = getRoleEmoji;
exports.getLfgActivityEmoji = getLfgActivityEmoji;
exports.getLfgStatusEmoji = getLfgStatusEmoji;
const types_1 = require("../../types");
function getRoleEmoji(role) {
    switch (role) {
        case types_1.EventRole.PILOT:
            return '✈️';
        case types_1.EventRole.ENGINEER:
            return '🔧';
        case types_1.EventRole.GUNNER:
            return '🎯';
        case types_1.EventRole.MEDIC:
            return '⚕️';
        case types_1.EventRole.VEHICLE_OPERATOR:
            return '🚗';
        case types_1.EventRole.MARINE:
            return '⚔️';
        case types_1.EventRole.GROUND_SUPPORT:
            return '🛡️';
        case types_1.EventRole.TANK:
            return '🛡️';
        case types_1.EventRole.DPS:
            return '⚔️';
        case types_1.EventRole.SUPPORT:
            return '💚';
        case types_1.EventRole.ANY:
            return '⭐';
        default:
            return '👤';
    }
}
function getLfgActivityEmoji(activity) {
    switch (activity) {
        case types_1.LFGActivity.PVP:
            return '⚔️';
        case types_1.LFGActivity.PVE:
            return '🎮';
        case types_1.LFGActivity.MINING:
            return '⛏️';
        case types_1.LFGActivity.TRADING:
            return '📦';
        case types_1.LFGActivity.EXPLORATION:
            return '🔭';
        case types_1.LFGActivity.BOUNTY_HUNTING:
            return '🎯';
        case types_1.LFGActivity.CARGO_HAULING:
            return '🚚';
        case types_1.LFGActivity.RACING:
            return '🏁';
        case types_1.LFGActivity.OTHER:
            return '❓';
        default:
            return '🎮';
    }
}
function getLfgStatusEmoji(status) {
    switch (status) {
        case 'open':
            return '🟢';
        case 'full':
            return '🟡';
        case 'closed':
            return '🔴';
        default:
            return '⚪';
    }
}
//# sourceMappingURL=emojiMaps.js.map