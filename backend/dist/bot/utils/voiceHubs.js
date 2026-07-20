"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfiguredVoiceHubs = getConfiguredVoiceHubs;
exports.formatVoiceHubs = formatVoiceHubs;
const discord_js_1 = require("discord.js");
function getConfiguredVoiceHubs(vc) {
    return [
        ...new Set([vc?.hubChannelId, ...(vc?.hubChannelIds ?? [])].filter((id) => typeof id === 'string' && id.length > 0)),
    ];
}
function formatVoiceHubs(vc) {
    const hubs = getConfiguredVoiceHubs(vc);
    return hubs.length > 0 ? hubs.map(discord_js_1.channelMention).join(', ') : '*not set*';
}
//# sourceMappingURL=voiceHubs.js.map