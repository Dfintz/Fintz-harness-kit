"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginate = paginate;
exports.buildPaginationRow = buildPaginationRow;
const discord_js_1 = require("discord.js");
function paginate(items, page, pageSize) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = clampedPage * pageSize;
    return {
        pageItems: items.slice(start, start + pageSize),
        page: clampedPage,
        totalPages,
        total,
    };
}
const PAGE_INDICATOR_CUSTOM_ID = 'pagination_indicator_noop';
function buildPaginationRow(options) {
    const { page, totalPages, makeCustomId, prevLabel = 'Previous', nextLabel = 'Next' } = options;
    if (totalPages <= 1) {
        return null;
    }
    const previousButton = new discord_js_1.ButtonBuilder()
        .setCustomId(makeCustomId(page - 1))
        .setLabel(prevLabel)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('◀️')
        .setDisabled(page <= 0);
    const indicatorButton = new discord_js_1.ButtonBuilder()
        .setCustomId(PAGE_INDICATOR_CUSTOM_ID)
        .setLabel(`Page ${page + 1} / ${totalPages}`)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(true);
    const nextButton = new discord_js_1.ButtonBuilder()
        .setCustomId(makeCustomId(page + 1))
        .setLabel(nextLabel)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('▶️')
        .setDisabled(page >= totalPages - 1);
    return new discord_js_1.ActionRowBuilder().addComponents(previousButton, indicatorButton, nextButton);
}
//# sourceMappingURL=paginationControls.js.map