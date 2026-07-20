"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactionRoleService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const REDIS_PREFIX = 'bot:reactionrole:';
class ReactionRoleService {
    static instance;
    client = null;
    panels = new Map();
    idCounter = 0;
    static MAX_PANELS_PER_GUILD = 50;
    static getInstance() {
        if (!ReactionRoleService.instance) {
            ReactionRoleService.instance = new ReactionRoleService();
        }
        return ReactionRoleService.instance;
    }
    initialize(client) {
        this.client = client;
        this.loadFromRedis().catch(err => logger_1.logger.warn('ReactionRoleService: Failed to load persisted panels from Redis', err));
        logger_1.logger.info('ReactionRoleService initialized');
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
            this.panels.set(data.id, data);
            loaded++;
        }
        if (loaded > 0) {
            logger_1.logger.info(`ReactionRoleService: Restored ${loaded} panels from Redis`);
        }
    }
    async persistPanel(panel) {
        try {
            await redis_1.cache.set(`${REDIS_PREFIX}${panel.id}`, panel);
        }
        catch (err) {
            logger_1.logger.warn('ReactionRoleService: Failed to persist panel to Redis', err);
        }
    }
    async unpersistPanel(panelId) {
        try {
            await redis_1.cache.del(`${REDIS_PREFIX}${panelId}`);
        }
        catch (err) {
            logger_1.logger.warn('ReactionRoleService: Failed to remove panel from Redis', err);
        }
    }
    createPanel(guildId, channelId, title, description, roles, exclusive, createdBy) {
        const guildPanels = Array.from(this.panels.values()).filter(p => p.guildId === guildId);
        if (guildPanels.length >= ReactionRoleService.MAX_PANELS_PER_GUILD) {
            return `Maximum of ${ReactionRoleService.MAX_PANELS_PER_GUILD} reaction role panels per server.`;
        }
        this.idCounter += 1;
        const id = `rr_${Date.now()}_${this.idCounter}`;
        const panel = {
            id,
            guildId,
            channelId,
            messageId: '',
            title,
            description,
            roles: roles.slice(0, 25),
            exclusive,
            createdBy,
        };
        this.panels.set(id, panel);
        this.persistPanel(panel).catch(() => { });
        return panel;
    }
    setMessageId(panelId, messageId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.messageId = messageId;
            this.persistPanel(panel).catch(() => { });
        }
    }
    async handleRoleToggle(panelId, roleId, member) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            return 'Panel not found.';
        }
        const roleOption = panel.roles.find(r => r.roleId === roleId);
        if (!roleOption) {
            return 'Role not found in panel.';
        }
        const guild = member.guild;
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
            return 'Discord role no longer exists.';
        }
        const hasRole = member.roles.cache.has(roleId);
        if (hasRole) {
            await member.roles.remove(role);
            return { action: 'removed', roleName: role.name };
        }
        if (panel.exclusive) {
            const otherRoleIds = panel.roles
                .filter(r => r.roleId !== roleId)
                .map(r => r.roleId)
                .filter(id => member.roles.cache.has(id));
            for (const otherId of otherRoleIds) {
                const otherRole = guild.roles.cache.get(otherId);
                if (otherRole) {
                    await member.roles.remove(otherRole);
                }
            }
            if (otherRoleIds.length > 0) {
                await member.roles.add(role);
                return { action: 'switched', roleName: role.name };
            }
        }
        await member.roles.add(role);
        return { action: 'added', roleName: role.name };
    }
    getPanel(panelId) {
        return this.panels.get(panelId);
    }
    findPanelByButton(customId) {
        const match = /^reactionrole_([^_]+_\d+)_(\d+)$/.exec(customId);
        if (!match) {
            return null;
        }
        const panel = this.panels.get(match[1]);
        if (!panel) {
            return null;
        }
        return { panel, roleId: match[2] };
    }
    listPanels(guildId) {
        return Array.from(this.panels.values()).filter(p => p.guildId === guildId);
    }
    async deletePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            return false;
        }
        if (this.client && panel.messageId) {
            try {
                const channel = await this.client.channels.fetch(panel.channelId).catch(() => null);
                if (channel instanceof discord_js_1.TextChannel) {
                    const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
                    if (msg) {
                        await msg.delete();
                    }
                }
            }
            catch {
            }
        }
        this.panels.delete(panelId);
        this.unpersistPanel(panelId).catch(() => { });
        return true;
    }
    buildPanelEmbed(panel) {
        const description = [
            (0, shared_types_1.decodeHtmlEntities)(panel.description),
            '',
            panel.exclusive
                ? '⚡ *Exclusive — picking one removes the other.*'
                : '✨ *Pick as many as you like!*',
            '',
            ...panel.roles.map(r => `${r.emoji || '🏷️'} <@&${r.roleId}>${r.description ? ` — ${(0, shared_types_1.decodeHtmlEntities)(r.description)}` : ''}`),
        ].join('\n');
        return new discord_js_1.EmbedBuilder()
            .setTitle(`🏷️ ${(0, shared_types_1.decodeHtmlEntities)(panel.title)}`)
            .setDescription(description)
            .setColor(0x5865f2)
            .setFooter({ text: 'Click a button below to toggle the role' })
            .setTimestamp();
    }
    buildPanelButtons(panel) {
        const rows = [];
        let currentRow = new discord_js_1.ActionRowBuilder();
        for (let i = 0; i < panel.roles.length; i++) {
            if (i > 0 && i % 5 === 0) {
                rows.push(currentRow);
                currentRow = new discord_js_1.ActionRowBuilder();
            }
            const role = panel.roles[i];
            const button = new discord_js_1.ButtonBuilder()
                .setCustomId(`reactionrole_${panel.id}_${role.roleId}`)
                .setLabel((0, shared_types_1.decodeHtmlEntities)(role.label))
                .setStyle(discord_js_1.ButtonStyle.Secondary);
            if (role.emoji) {
                button.setEmoji(role.emoji);
            }
            currentRow.addComponents(button);
        }
        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }
        return rows;
    }
}
exports.ReactionRoleService = ReactionRoleService;
//# sourceMappingURL=ReactionRoleService.js.map