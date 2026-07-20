"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEventMirrorSubPanelEmbed = buildEventMirrorSubPanelEmbed;
const discord_js_1 = require("discord.js");
function buildEventMirrorSubPanelEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🪞 Event Mirroring')
        .setDescription('**Create Mirror** — Select one of your events and generate an invite code that others can use to mirror it.\n\n' +
        '**Post Mirror** — Enter an invite code (and password if needed) to post a mirrored event in this channel.');
}
//# sourceMappingURL=eventsEmbeds.js.map