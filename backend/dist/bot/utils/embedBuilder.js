"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCFleetEmbed = exports.TimestampFormat = exports.StatusDots = exports.ActivityAccentColors = exports.EmbedColors = void 0;
exports.getActivityAccentColor = getActivityAccentColor;
exports.formatDiscordTimestamp = formatDiscordTimestamp;
exports.formatRelativeTime = formatRelativeTime;
exports.createProgressBar = createProgressBar;
exports.createCapacityIndicator = createCapacityIndicator;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
exports.EmbedColors = {
    SC_BLUE: 0x00d4ff,
    QUANTUM_GOLD: 0xf1c40f,
    SUCCESS: 0x57f287,
    ERROR: 0xed4245,
    WARNING: 0xfee75c,
    INFO: 0x5865f2,
    ALLIED: 0x57f287,
    NEUTRAL: 0x9b59b6,
    HOSTILE: 0xed4245,
    OPEN: 0x57f287,
    FULL: 0xffa500,
    CLOSED: 0x808080,
};
exports.ActivityAccentColors = {
    pilot: 0x3b82f6,
    gunner: 0xef4444,
    engineer: 0xf59e0b,
    medic: 0x06b6d4,
    miner: 0xd97706,
    hauler: 0x8b5cf6,
    scout: 0x6366f1,
    security: 0x10b981,
    leadership: 0xec4899,
    support: 0x14b8a6,
    crew: 0x8b949e,
    pvp: 0xef4444,
    pve: 0x3b82f6,
    mining: 0xd97706,
    trading: 0x8b5cf6,
    exploration: 0x6366f1,
    bounty_hunting: 0xef4444,
    cargo_hauling: 0xf59e0b,
    racing: 0xec4899,
};
function getActivityAccentColor(key) {
    if (!key) {
        return exports.EmbedColors.SC_BLUE;
    }
    const normalized = key.toLowerCase().replaceAll(/[\s-]/g, '_');
    if (exports.ActivityAccentColors[normalized] !== undefined) {
        return exports.ActivityAccentColors[normalized];
    }
    const typeCfg = shared_types_1.ACTIVITY_TYPE_CONFIG[normalized];
    if (typeCfg) {
        return typeCfg.colorHex;
    }
    return exports.EmbedColors.SC_BLUE;
}
exports.StatusDots = {
    ONLINE: '🟢',
    AWAY: '🟡',
    BUSY: '🔴',
    OFFLINE: '⚫',
    PENDING: '⚪',
};
var TimestampFormat;
(function (TimestampFormat) {
    TimestampFormat["SHORT_TIME"] = "t";
    TimestampFormat["LONG_TIME"] = "T";
    TimestampFormat["SHORT_DATE"] = "d";
    TimestampFormat["LONG_DATE"] = "D";
    TimestampFormat["SHORT_DATETIME"] = "f";
    TimestampFormat["LONG_DATETIME"] = "F";
    TimestampFormat["RELATIVE"] = "R";
})(TimestampFormat || (exports.TimestampFormat = TimestampFormat = {}));
function formatDiscordTimestamp(date, format = TimestampFormat.RELATIVE) {
    const unixTimestamp = Math.floor(date.getTime() / 1000);
    return `<t:${unixTimestamp}:${format}>`;
}
function formatRelativeTime(date) {
    return formatDiscordTimestamp(date, TimestampFormat.RELATIVE);
}
const PROGRESS_GRADIENT_STOPS = ['🟥', '🟧', '🟨', '🟩'];
function pickGradientCell(cellIndex, width) {
    const ratio = width > 0 ? (cellIndex + 0.5) / width : 0;
    const stopIndex = Math.min(PROGRESS_GRADIENT_STOPS.length - 1, Math.floor(ratio * PROGRESS_GRADIENT_STOPS.length));
    return PROGRESS_GRADIENT_STOPS[stopIndex];
}
function createProgressBar(current, max, options = {}) {
    const { width = 10, style = 'gradient', showPercentage = true } = options;
    const filledChar = options.filledChar ?? '█';
    const emptyChar = options.emptyChar ?? (style === 'gradient' ? '⬛' : '░');
    const clampedCurrent = Math.max(0, Math.min(current, max));
    const percentage = max > 0 ? (clampedCurrent / max) * 100 : 0;
    const filledCount = Math.round((percentage / 100) * width);
    let bar = '';
    if (style === 'gradient') {
        for (let cell = 0; cell < width; cell++) {
            bar += cell < filledCount ? pickGradientCell(cell, width) : emptyChar;
        }
    }
    else {
        bar = filledChar.repeat(filledCount) + emptyChar.repeat(width - filledCount);
    }
    return showPercentage ? `${bar} ${Math.round(percentage)}%` : bar;
}
function createCapacityIndicator(current, max) {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    let indicator;
    if (percentage >= 100) {
        indicator = exports.StatusDots.BUSY;
    }
    else if (percentage >= 75) {
        indicator = exports.StatusDots.AWAY;
    }
    else {
        indicator = exports.StatusDots.ONLINE;
    }
    return `${indicator} ${current}/${max}`;
}
class SCFleetEmbed {
    embed;
    constructor() {
        this.embed = new discord_js_1.EmbedBuilder();
    }
    static create() {
        return new SCFleetEmbed();
    }
    static info(title, description) {
        const instance = new SCFleetEmbed();
        instance.embed.setColor(exports.EmbedColors.INFO).setTitle(title);
        if (description) {
            instance.embed.setDescription(description);
        }
        return instance;
    }
    static success(title, description) {
        const instance = new SCFleetEmbed();
        instance.embed.setColor(exports.EmbedColors.SUCCESS).setTitle(`✅ ${title}`);
        if (description) {
            instance.embed.setDescription(description);
        }
        return instance;
    }
    static error(title, description) {
        const instance = new SCFleetEmbed();
        instance.embed.setColor(exports.EmbedColors.ERROR).setTitle(`❌ ${title}`);
        if (description) {
            instance.embed.setDescription(description);
        }
        return instance;
    }
    static warning(title, description) {
        const instance = new SCFleetEmbed();
        instance.embed.setColor(exports.EmbedColors.WARNING).setTitle(`⚠️ ${title}`);
        if (description) {
            instance.embed.setDescription(description);
        }
        return instance;
    }
    static event(title, description) {
        const instance = new SCFleetEmbed();
        instance.embed.setColor(exports.EmbedColors.QUANTUM_GOLD).setTitle(`📅 ${title}`);
        if (description) {
            instance.embed.setDescription(description);
        }
        return instance;
    }
    static fleet(title, description) {
        const instance = new SCFleetEmbed();
        instance.embed.setColor(exports.EmbedColors.SC_BLUE).setTitle(`🚀 ${title}`);
        if (description) {
            instance.embed.setDescription(description);
        }
        return instance;
    }
    setTitle(title) {
        this.embed.setTitle(title);
        return this;
    }
    setDescription(description) {
        this.embed.setDescription(description);
        return this;
    }
    setColor(color) {
        this.embed.setColor(color);
        return this;
    }
    addFields(...fields) {
        this.embed.addFields(...fields);
        return this;
    }
    setFooter(options) {
        this.embed.setFooter(options);
        return this;
    }
    setThumbnail(url) {
        this.embed.setThumbnail(url);
        return this;
    }
    setImage(url) {
        this.embed.setImage(url);
        return this;
    }
    setTimestamp(date) {
        this.embed.setTimestamp(date);
        return this;
    }
    setAuthor(options) {
        this.embed.setAuthor(options);
        return this;
    }
    addProgressField(name, current, max, options) {
        const progressBar = createProgressBar(current, max, options);
        this.embed.addFields({
            name,
            value: progressBar,
            inline: options?.inline ?? false,
        });
        return this;
    }
    addTimestampField(name, date, format = TimestampFormat.RELATIVE, inline) {
        this.embed.addFields({
            name,
            value: formatDiscordTimestamp(date, format),
            inline: inline ?? true,
        });
        return this;
    }
    build() {
        return this.embed;
    }
    toJSON() {
        return this.embed.toJSON();
    }
}
exports.SCFleetEmbed = SCFleetEmbed;
//# sourceMappingURL=embedBuilder.js.map