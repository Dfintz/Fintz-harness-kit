"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__setUserServiceFactoryForTesting = __setUserServiceFactoryForTesting;
exports.__clearPlatformRbacCacheForTesting = __clearPlatformRbacCacheForTesting;
exports.isPlatformAdmin = isPlatformAdmin;
exports.requirePlatformAdmin = requirePlatformAdmin;
const discord_js_1 = require("discord.js");
const UserService_1 = require("../../services/user/UserService");
const logger_1 = require("../../utils/logger");
const PLATFORM_ADMIN_ROLES = new Set(['admin', 'superadmin']);
const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;
const cache = new Map();
let userServiceFactory = () => new UserService_1.UserService();
function __setUserServiceFactoryForTesting(factory) {
    userServiceFactory = factory;
    cache.clear();
}
function __clearPlatformRbacCacheForTesting() {
    cache.clear();
}
function pruneCacheIfNeeded() {
    if (cache.size <= CACHE_MAX_ENTRIES) {
        return;
    }
    const now = Date.now();
    for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) {
            cache.delete(key);
        }
    }
    while (cache.size > CACHE_MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) {
            break;
        }
        cache.delete(oldestKey);
    }
}
async function isPlatformAdmin(discordId) {
    const now = Date.now();
    const cached = cache.get(discordId);
    if (cached && cached.expiresAt > now) {
        return cached.isAdmin;
    }
    let isAdmin = false;
    try {
        const user = await userServiceFactory().getUserByDiscordId(discordId);
        isAdmin = !!user && PLATFORM_ADMIN_ROLES.has(user.role);
    }
    catch (error) {
        logger_1.logger.error('platformRbac: isPlatformAdmin lookup failed', {
            error: error instanceof Error ? error.message : String(error),
            discordId,
        });
        isAdmin = false;
    }
    cache.set(discordId, { isAdmin, expiresAt: now + CACHE_TTL_MS });
    pruneCacheIfNeeded();
    return isAdmin;
}
async function requirePlatformAdmin(interaction) {
    if (await isPlatformAdmin(interaction.user.id)) {
        return true;
    }
    const reply = {
        content: '❌ This action requires platform administrator privileges.',
        flags: discord_js_1.MessageFlags.Ephemeral,
    };
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => { });
    }
    else {
        await interaction.reply(reply).catch(() => { });
    }
    return false;
}
//# sourceMappingURL=platformRbac.js.map