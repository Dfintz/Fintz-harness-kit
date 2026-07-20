"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbedBuilderService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const ShortcodeEngine_1 = require("./ShortcodeEngine");
const REDIS_PREFIX = 'bot:embed:';
class EmbedBuilderService {
    static instance;
    embeds = new Map();
    shortcodeEngine = ShortcodeEngine_1.ShortcodeEngine.getInstance();
    idCounter = 0;
    static getInstance() {
        if (!EmbedBuilderService.instance) {
            EmbedBuilderService.instance = new EmbedBuilderService();
        }
        return EmbedBuilderService.instance;
    }
    initialize() {
        this.loadFromRedis().catch(err => logger_1.logger.warn('EmbedBuilderService: Failed to load persisted embeds from Redis', err));
        logger_1.logger.info('EmbedBuilderService initialized');
    }
    async loadFromRedis() {
        const keys = await redis_1.cache.keys(`${REDIS_PREFIX}*`);
        if (!keys.length) {
            return;
        }
        let loaded = 0;
        for (const key of keys) {
            const data = await redis_1.cache.get(key);
            if (!data) {
                continue;
            }
            data.createdAt = new Date(data.createdAt);
            data.updatedAt = new Date(data.updatedAt);
            this.embeds.set(data.id, data);
            loaded++;
        }
        if (loaded > 0) {
            logger_1.logger.info(`EmbedBuilderService: Restored ${loaded} embeds from Redis`);
        }
    }
    async persistEmbed(embed) {
        try {
            await redis_1.cache.set(`${REDIS_PREFIX}${embed.id}`, embed);
        }
        catch (err) {
            logger_1.logger.warn('EmbedBuilderService: Failed to persist embed to Redis', err);
        }
    }
    async unpersistEmbed(embedId) {
        try {
            await redis_1.cache.del(`${REDIS_PREFIX}${embedId}`);
        }
        catch (err) {
            logger_1.logger.warn('EmbedBuilderService: Failed to remove embed from Redis', err);
        }
    }
    createEmbed(guildId, name, options, createdBy) {
        const existing = this.findByName(guildId, name);
        if (existing) {
            return `An embed named "${name}" already exists.`;
        }
        if (options.fields && options.fields.length > 25) {
            return 'Embeds can have a maximum of 25 fields.';
        }
        if (options.thumbnailUrl && !this.isValidUrl(options.thumbnailUrl)) {
            return 'Invalid thumbnail URL. Must be an https:// URL.';
        }
        if (options.imageUrl && !this.isValidUrl(options.imageUrl)) {
            return 'Invalid image URL. Must be an https:// URL.';
        }
        this.idCounter += 1;
        const id = `embed_${Date.now()}_${this.idCounter}`;
        const embed = {
            id,
            guildId,
            name: name.toLowerCase().trim(),
            title: options.title,
            description: options.description,
            color: options.color ?? 0x00d9ff,
            footerText: options.footerText,
            thumbnailUrl: options.thumbnailUrl,
            imageUrl: options.imageUrl,
            fields: options.fields ?? [],
            createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.embeds.set(id, embed);
        this.persistEmbed(embed).catch(() => { });
        logger_1.logger.info(`Embed template created: ${name} in guild ${guildId}`);
        return embed;
    }
    updateEmbed(embedId, updates) {
        const embed = this.embeds.get(embedId);
        if (!embed) {
            return null;
        }
        Object.assign(embed, updates, { updatedAt: new Date() });
        this.persistEmbed(embed).catch(() => { });
        return embed;
    }
    findByName(guildId, name) {
        const normalizedName = name.toLowerCase().trim();
        return Array.from(this.embeds.values()).find(e => e.guildId === guildId && e.name === normalizedName);
    }
    getEmbed(embedId) {
        return this.embeds.get(embedId);
    }
    listEmbeds(guildId) {
        return Array.from(this.embeds.values()).filter(e => e.guildId === guildId);
    }
    deleteEmbed(embedId) {
        const deleted = this.embeds.delete(embedId);
        if (deleted) {
            this.unpersistEmbed(embedId).catch(() => { });
        }
        return deleted;
    }
    buildDiscordEmbed(saved, context) {
        const resolve = (text) => {
            if (!text) {
                return text;
            }
            const resolved = context ? this.shortcodeEngine.resolve(text, context) : text;
            return (0, shared_types_1.decodeHtmlEntities)(resolved);
        };
        const embed = new discord_js_1.EmbedBuilder().setColor(saved.color ?? 0x00d9ff).setTimestamp();
        const resolvedTitle = resolve(saved.title);
        if (resolvedTitle) {
            embed.setTitle(resolvedTitle);
        }
        const resolvedDesc = resolve(saved.description);
        if (resolvedDesc) {
            embed.setDescription(resolvedDesc);
        }
        const resolvedFooter = resolve(saved.footerText);
        if (resolvedFooter) {
            embed.setFooter({ text: resolvedFooter });
        }
        if (saved.thumbnailUrl) {
            embed.setThumbnail(saved.thumbnailUrl);
        }
        if (saved.imageUrl) {
            embed.setImage(saved.imageUrl);
        }
        for (const field of saved.fields) {
            const resolvedName = resolve(field.name) || field.name;
            const resolvedValue = resolve(field.value) || field.value;
            embed.addFields({
                name: resolvedName,
                value: resolvedValue,
                inline: field.inline,
            });
        }
        return embed;
    }
    renderWithContext(title, description, context) {
        return {
            title: title ? this.shortcodeEngine.resolve(title, context) : undefined,
            description: description ? this.shortcodeEngine.resolve(description, context) : undefined,
        };
    }
    resolveFooterText(text, context) {
        return text ? this.shortcodeEngine.resolve(text, context) : undefined;
    }
    resolveAuthorName(name, context) {
        return name ? this.shortcodeEngine.resolve(name, context) : undefined;
    }
    resolveFieldText(text, context) {
        return text ? this.shortcodeEngine.resolve(text, context) : undefined;
    }
    isValidUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:';
        }
        catch {
            return false;
        }
    }
}
exports.EmbedBuilderService = EmbedBuilderService;
//# sourceMappingURL=EmbedBuilderService.js.map