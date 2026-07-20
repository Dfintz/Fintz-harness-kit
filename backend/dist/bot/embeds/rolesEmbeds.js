"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReactionRolePanelsListEmbed = buildReactionRolePanelsListEmbed;
const discord_js_1 = require("discord.js");
function buildReactionRolePanelsListEmbed(panels) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00d9ff)
        .setTitle('🎭 Reaction Role Panels')
        .setDescription(`${panels.length} panel(s) configured`)
        .setTimestamp();
    for (const panel of panels.slice(0, 10)) {
        const rolesList = panel.roles.map(role => `<@&${role.roleId}>`).join(', ') || 'No roles added';
        embed.addFields({
            name: panel.title,
            value: [
                `Mode: ${panel.exclusive ? 'Exclusive' : 'Multi-select'}`,
                `Roles: ${rolesList}`,
                `ID: \`${panel.id}\``,
            ].join('\n'),
            inline: false,
        });
    }
    return embed;
}
//# sourceMappingURL=rolesEmbeds.js.map