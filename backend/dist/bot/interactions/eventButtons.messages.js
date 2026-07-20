"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserFriendlyError = getUserFriendlyError;
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
const ERROR_MESSAGES = [
    {
        match: msg => msg.includes('full') || msg.includes('max'),
        content: "❌ Event is full. Try clicking **Withdraw** first if you're already signed up, or ask an organizer for more slots.",
    },
    {
        match: msg => msg.includes('creator cannot leave'),
        content: '❌ Event creators cannot leave their own event.',
    },
    {
        match: msg => msg.includes('not crew on any ship'),
        content: '⚠️ You are not assigned as crew on any ship.',
    },
    {
        match: msg => msg.includes('captain cannot leave'),
        content: '❌ Ship captains cannot leave crew. Transfer captaincy first.',
    },
    {
        match: msg => msg.includes('only remove ships you brought'),
        content: '❌ You can only remove ships you brought to this event.',
    },
    {
        match: msg => msg.includes('activity not found') || msg.includes('event not found'),
        content: MSG_ACTIVITY_NOT_FOUND,
    },
];
function getUserFriendlyError(errorMsg) {
    const lower = errorMsg.toLowerCase();
    const matched = ERROR_MESSAGES.find(e => e.match(lower));
    return matched?.content ?? `❌ Error: ${errorMsg}`;
}
//# sourceMappingURL=eventButtons.messages.js.map