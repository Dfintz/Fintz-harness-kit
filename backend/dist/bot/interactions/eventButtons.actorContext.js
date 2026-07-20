"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveActionActorContext = resolveActionActorContext;
const discord_js_1 = require("discord.js");
const eventButtons_guestContext_1 = require("./eventButtons.guestContext");
const eventButtons_identity_1 = require("./eventButtons.identity");
const LINK_ACCOUNT_MESSAGE = '❌ Please link your Discord account on the web app first, then try again.';
async function resolveActionActorContext(interaction) {
    const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
    if (internalUserId) {
        return {
            userId: internalUserId,
            isDiscordGuest: false,
            guestContext: null,
        };
    }
    const guestContext = await (0, eventButtons_guestContext_1.resolveGuestContext)(interaction);
    if (!guestContext) {
        await interaction.reply({
            content: LINK_ACCOUNT_MESSAGE,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return null;
    }
    return {
        userId: guestContext.guestId,
        isDiscordGuest: true,
        guestContext,
    };
}
//# sourceMappingURL=eventButtons.actorContext.js.map