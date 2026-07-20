"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortcodeEngine = void 0;
const logger_1 = require("../../utils/logger");
const RESOLVERS = {
    'user.id': ctx => ctx.user?.id,
    'user.name': ctx => ctx.user?.username,
    'user.mention': ctx => (ctx.user ? `<@${ctx.user.id}>` : undefined),
    'user.tag': ctx => ('tag' in (ctx.user ?? {}) ? ctx.user.tag : ctx.user?.username),
    'member.displayname': ctx => ctx.member ? ('displayName' in ctx.member ? ctx.member.displayName : undefined) : undefined,
    'guild.id': ctx => ctx.guild?.id,
    'guild.name': ctx => ctx.guild?.name,
    'guild.members': ctx => ctx.guild?.memberCount?.toString(),
    'organization.id': ctx => ctx.organization?.id,
    'organization.name': ctx => ctx.organization?.name,
    'organization.members': ctx => ctx.organization?.memberCount?.toString(),
    'ticket.number': ctx => ctx.ticket?.number,
    'ticket.subject': ctx => ctx.ticket?.subject,
    'ticket.category': ctx => ctx.ticket?.category,
    'ticket.status': ctx => ctx.ticket?.status,
    'event.title': ctx => ctx.event?.title,
    'event.date': ctx => ctx.event?.date,
    'event.location': ctx => ctx.event?.location,
    'event.type': ctx => ctx.event?.type,
    'event.host': ctx => ctx.event?.hostName,
    'recruitment.title': ctx => ctx.recruitment?.title,
    'recruitment.position': ctx => ctx.recruitment?.position,
    'recruitment.status': ctx => ctx.recruitment?.status,
    'lfg.activity': ctx => ctx.lfg?.activity,
    'lfg.maxplayers': ctx => ctx.lfg?.maxPlayers?.toString(),
    'lfg.currentplayers': ctx => ctx.lfg?.currentPlayers?.toString(),
    'date.now': () => new Date().toLocaleDateString(),
    'date.iso': () => new Date().toISOString(),
    timestamp: () => `<t:${Math.floor(Date.now() / 1000)}:F>`,
    'timestamp.relative': () => `<t:${Math.floor(Date.now() / 1000)}:R>`,
};
class ShortcodeEngine {
    static instance;
    static getInstance() {
        if (!ShortcodeEngine.instance) {
            ShortcodeEngine.instance = new ShortcodeEngine();
        }
        return ShortcodeEngine.instance;
    }
    resolve(template, context) {
        if (!template) {
            return template;
        }
        return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (match, key) => {
            const normalizedKey = key.toLowerCase();
            if (context.custom?.[normalizedKey]) {
                return context.custom[normalizedKey];
            }
            const resolver = RESOLVERS[normalizedKey];
            if (resolver) {
                const value = resolver(context);
                if (value !== undefined) {
                    return value;
                }
            }
            return match;
        });
    }
    getAvailableShortcodes() {
        return Object.keys(RESOLVERS);
    }
    validate(template) {
        const shortcodes = [];
        const regex = /\{([a-zA-Z0-9_.]+)\}/g;
        let m;
        while ((m = regex.exec(template)) !== null) {
            const key = m[1].toLowerCase();
            if (!RESOLVERS[key]) {
                shortcodes.push(m[1]);
            }
        }
        return shortcodes;
    }
    registerResolver(key, resolver) {
        RESOLVERS[key.toLowerCase()] = resolver;
        logger_1.logger.debug(`Shortcode registered: {${key}}`);
    }
}
exports.ShortcodeEngine = ShortcodeEngine;
//# sourceMappingURL=ShortcodeEngine.js.map