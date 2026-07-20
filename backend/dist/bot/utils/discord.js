"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeDiscordMarkdown = escapeDiscordMarkdown;
exports.checkBotGuildPermissions = checkBotGuildPermissions;
exports.checkBotChannelPermissions = checkBotChannelPermissions;
exports.getMissingPermissions = getMissingPermissions;
const discord_js_1 = require("discord.js");
function escapeDiscordMarkdown(text) {
    return text.replaceAll(/[*`_~[\]()\\>|]/g, '\\$&');
}
function checkBotGuildPermissions(guild, ...permissions) {
    const me = guild.members.me;
    if (!me) {
        return false;
    }
    return me.permissions.has(permissions);
}
function checkBotChannelPermissions(channel, ...permissions) {
    if (!('guild' in channel) || !channel.guild) {
        return true;
    }
    const me = channel.guild.members.me;
    if (!me) {
        return false;
    }
    const perms = channel.permissionsFor(me);
    return perms ? perms.has(permissions) : false;
}
function getMissingPermissions(member, ...permissions) {
    const resolved = new discord_js_1.PermissionsBitField(permissions);
    const missing = [];
    for (const [name, bit] of Object.entries(discord_js_1.PermissionsBitField.Flags)) {
        if (resolved.has(bit) && !member.permissions.has(bit)) {
            missing.push(name);
        }
    }
    return missing;
}
//# sourceMappingURL=discord.js.map