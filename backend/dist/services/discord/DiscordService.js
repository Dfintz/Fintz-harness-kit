"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscordService = exports.isDiscordServiceInitialized = exports.initializeDiscordService = exports.DiscordService = void 0;
const discord_js_1 = require("discord.js");
const BotClientManager_1 = require("../../bot/BotClientManager");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const DistributedCacheService_1 = require("../caching/DistributedCacheService");
class DiscordService {
    client;
    roleCache;
    botToken;
    clientId;
    clientSecret;
    redirectUri;
    constructor(botToken, clientId, clientSecret, redirectUri, externalClient) {
        if (!botToken) {
            throw new Error('Discord bot token is required');
        }
        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Discord SSO requires clientId, clientSecret, and redirectUri');
        }
        this.botToken = botToken;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        if (externalClient) {
            this.client = externalClient;
            logger_1.logger.info('DiscordService: Using externally provided Client instance');
        }
        else {
            try {
                const manager = BotClientManager_1.BotClientManager.getInstance();
                this.client = manager.getClient();
                logger_1.logger.info('DiscordService: Using BotClientManager shared Client instance');
            }
            catch (error) {
                logger_1.logger.debug('DiscordService: BotClientManager not available, creating standalone client', {
                    error: error instanceof Error ? error.message : String(error),
                });
                this.client = new discord_js_1.Client({
                    intents: [
                        discord_js_1.GatewayIntentBits.Guilds,
                        discord_js_1.GatewayIntentBits.GuildMembers,
                        discord_js_1.GatewayIntentBits.GuildMessages,
                        discord_js_1.GatewayIntentBits.MessageContent,
                    ],
                    partials: [discord_js_1.Partials.Message, discord_js_1.Partials.Channel, discord_js_1.Partials.Reaction],
                });
                this.setupEventHandlers();
                void this.client.login(botToken).catch((error) => {
                    logger_1.logger.error('Failed to login to Discord:', error);
                });
                logger_1.logger.info('DiscordService: Created standalone Client (fallback)');
            }
        }
        this.roleCache = (0, DistributedCacheService_1.createDistributedCache)({
            keyPrefix: 'discord:roles',
            defaultTTL: Number.parseInt(process.env.DISCORD_CACHE_TTL ?? '300', 10),
        });
    }
    setupEventHandlers() {
        this.client.once('clientReady', () => {
            logger_1.logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
        });
        this.client.on('error', error => {
            logger_1.logger.error('Discord client error:', error);
        });
    }
    isReady() {
        return this.client.isReady();
    }
    generateAuthUrl(state, codeChallenge) {
        if (!state) {
            throw new Error('State parameter is required for CSRF protection');
        }
        const baseUrl = 'https://discord.com/api/oauth2/authorize';
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'identify email',
            state,
        });
        if (codeChallenge) {
            params.set('code_challenge', codeChallenge);
            params.set('code_challenge_method', 'S256');
        }
        return `${baseUrl}?${params.toString()}`;
    }
    async authenticateUser(code, redirectUri, codeVerifier) {
        if (!code) {
            throw new Error('Authorization code is required');
        }
        const effectiveRedirectUri = redirectUri || this.redirectUri;
        logger_1.logger.debug('Discord OAuth token exchange starting', {
            redirectUri: effectiveRedirectUri,
            pkce: !!codeVerifier,
        });
        try {
            const body = new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: effectiveRedirectUri,
            });
            if (codeVerifier) {
                body.set('code_verifier', codeVerifier);
            }
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
            });
            if (!tokenResponse.ok) {
                const raw = await tokenResponse.text();
                let errorData = {};
                try {
                    errorData = raw ? JSON.parse(raw) : {};
                }
                catch (_parseError) {
                    logger_1.logger.debug('Failed to parse Discord error response as JSON', {
                        raw: raw.slice(0, 200),
                    });
                    errorData = { rawError: raw };
                }
                const errorDescription = errorData.error_description || errorData.error || tokenResponse.statusText;
                logger_1.logger.error('Discord authentication failed', {
                    status: tokenResponse.status,
                    error: errorData.error,
                    errorDescription,
                    redirectUri: effectiveRedirectUri,
                });
                throw new Error(`Discord authentication failed: ${tokenResponse.status} - ${errorDescription}`);
            }
            return (await tokenResponse.json());
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith('Discord authentication failed')) {
                throw error;
            }
            logger_1.logger.error('Discord authentication error:', error);
            throw new Error(`Failed to authenticate user: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
    }
    async getUserInfo(accessToken) {
        if (!accessToken) {
            throw new Error('Access token is required');
        }
        try {
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!userResponse.ok) {
                const errorData = (await userResponse.json().catch(() => ({})));
                throw new Error(`Failed to fetch user info: ${userResponse.status} - ${errorData.message || userResponse.statusText}`);
            }
            return (await userResponse.json());
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith('Failed to fetch user info')) {
                throw error;
            }
            logger_1.logger.error('Failed to fetch Discord user info:', error);
            throw new Error(`Failed to fetch user info: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
    }
    async refreshAccessToken(refreshToken) {
        if (!refreshToken) {
            throw new Error('Refresh token is required');
        }
        try {
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                }),
            });
            if (!tokenResponse.ok) {
                const errorData = (await tokenResponse.json().catch(() => ({})));
                throw new Error(`Token refresh failed: ${tokenResponse.status} - ${errorData.error || tokenResponse.statusText}`);
            }
            return (await tokenResponse.json());
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith('Token refresh failed')) {
                throw error;
            }
            logger_1.logger.error('Failed to refresh Discord token:', error);
            throw new Error(`Failed to refresh access token: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
    }
    shouldRefreshToken(expiresAt) {
        const now = new Date();
        const expirationTime = new Date(expiresAt).getTime();
        const currentTime = now.getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        return expirationTime - currentTime <= twentyFourHours;
    }
    async revokeToken(accessToken) {
        if (!accessToken) {
            throw new Error('Access token is required');
        }
        try {
            const response = await fetch('https://discord.com/api/oauth2/token/revoke', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    token: accessToken,
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to revoke token: ${response.status}`);
            }
            logger_1.logger.info('Discord token revoked successfully');
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith('Failed to revoke token')) {
                throw error;
            }
            logger_1.logger.error('Failed to revoke Discord token:', error);
            throw new Error(`Failed to revoke token: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
    }
    async sendMessage(channelId, message) {
        try {
            if (this.client.isReady()) {
                const channel = this.client.channels.cache.get(channelId);
                if (channel?.type === discord_js_1.ChannelType.GuildText) {
                    await channel.send(message);
                    logger_1.logger.debug(`Message sent to channel ${channelId}`);
                    return;
                }
            }
            const response = await this.discordRestRequest('POST', `/channels/${encodeURIComponent(channelId)}/messages`, { content: message });
            if (!response.ok) {
                const errorBody = await response.text();
                logger_1.logger.error(`Discord REST API error sending message to channel ${channelId}: ${response.status}`, { body: errorBody });
                throw new Error(`Failed to send message: Discord API returned ${response.status}`);
            }
            logger_1.logger.debug(`Message sent to channel ${channelId} via REST API`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to send message to channel ${channelId}:`, error);
            throw error;
        }
    }
    listenForCommands(commandPrefix, commandHandler) {
        this.client.on('messageCreate', message => {
            if (!message.content.startsWith(commandPrefix) || message.author.bot) {
                return;
            }
            const args = message.content.slice(commandPrefix.length).trim().split(/ +/);
            const command = args.shift()?.toLowerCase();
            if (command) {
                commandHandler(command, args);
            }
        });
        logger_1.logger.info(`Listening for commands with prefix: ${commandPrefix}`);
    }
    async getUserRoles(guildId, userId) {
        const cacheKey = `${guildId}:${userId}`;
        const cached = await this.roleCache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for user roles: ${userId}`);
            return cached;
        }
        let roles;
        if (this.client.isReady()) {
            try {
                const guild = await this.client.guilds.fetch(guildId);
                const member = await guild.members.fetch(userId);
                roles = Array.from(member.roles.cache.values()).map(role => ({
                    id: role.id,
                    name: role.name,
                }));
            }
            catch (error) {
                logger_1.logger.error(`Failed to fetch roles for user ${userId} via gateway:`, error);
                throw error;
            }
        }
        else {
            try {
                const response = await this.discordRestRequest('GET', `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`);
                if (!response.ok) {
                    const errorBody = await response.text();
                    logger_1.logger.error(`Discord REST API error fetching member ${userId} in guild ${guildId}: ${response.status}`, { body: errorBody });
                    throw new Error(`Discord API returned ${response.status} when fetching member ${userId}`);
                }
                const memberData = (await response.json());
                const allRoles = await this.getGuildRoles(guildId);
                const roleIdSet = new Set(memberData.roles);
                roles = allRoles.filter(role => roleIdSet.has(role.id));
            }
            catch (error) {
                logger_1.logger.error(`Failed to fetch roles for user ${userId} via REST:`, error);
                throw error;
            }
        }
        await this.roleCache.set(cacheKey, roles);
        logger_1.logger.debug(`Fetched and cached roles for user ${userId}`);
        return roles;
    }
    async getGuildRoles(guildId) {
        const cacheKey = `guild-roles:${guildId}`;
        const cached = await this.roleCache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for guild roles: ${guildId}`);
            return cached;
        }
        if (!this.client.isReady()) {
            return this.getGuildRolesViaRest(guildId, cacheKey);
        }
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const fetchedRoles = await guild.roles.fetch();
            const roles = Array.from(fetchedRoles.values())
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position)
                .map(role => ({
                id: role.id,
                name: role.name,
            }));
            await this.roleCache.set(cacheKey, roles);
            logger_1.logger.debug(`Fetched and cached ${roles.length} roles for guild ${guildId}`);
            return roles;
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch guild roles for ${guildId}:`, error);
            const errorCode = error?.code;
            if (errorCode === 50001) {
                throw new Error(`Bot does not have access to guild ${guildId}. Ensure the bot is a member of the Discord server.`);
            }
            if (errorCode === 50013) {
                throw new Error(`Bot lacks permissions to list roles in guild ${guildId}. Grant the bot "View Server" permission.`);
            }
            throw error;
        }
    }
    async getGuildName(guildId) {
        const cacheKey = `guild-name:${guildId}`;
        const cached = await this.roleCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            if (!this.client.isReady()) {
                return await this.getGuildNameViaRest(guildId, cacheKey);
            }
            const guild = await this.client.guilds.fetch(guildId);
            await this.roleCache.set(cacheKey, guild.name);
            return guild.name;
        }
        catch {
            logger_1.logger.debug(`Could not fetch guild name for ${guildId}`);
            return undefined;
        }
    }
    async getGuildNameViaRest(guildId, cacheKey) {
        try {
            const response = await this.discordRestRequest('GET', `/guilds/${encodeURIComponent(guildId)}`);
            if (!response.ok) {
                logger_1.logger.debug(`Discord REST API error fetching guild ${guildId}: ${response.status}`);
                return undefined;
            }
            const guild = (await response.json());
            if (guild.name) {
                await this.roleCache.set(cacheKey, guild.name);
            }
            return guild.name;
        }
        catch {
            logger_1.logger.debug(`Could not fetch guild name via REST for ${guildId}`);
            return undefined;
        }
    }
    async getGuildChannels(guildId) {
        const cacheKey = `guild-channels:${guildId}`;
        const cached = await this.roleCache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for guild channels: ${guildId}`);
            return cached;
        }
        if (!this.client.isReady()) {
            return this.getGuildChannelsViaRest(guildId, cacheKey);
        }
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const fetchedChannels = await guild.channels.fetch();
            const channels = Array.from(fetchedChannels.values())
                .filter((ch) => ch !== null)
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map(ch => ({
                id: ch.id,
                name: ch.name,
                type: ch.type,
                parentId: ch.parentId ?? undefined,
            }));
            await this.roleCache.set(cacheKey, channels);
            logger_1.logger.debug(`Fetched and cached ${channels.length} channels for guild ${guildId}`);
            return channels;
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch guild channels for ${guildId}:`, error);
            const errorCode = error?.code;
            if (errorCode === 50001) {
                throw new Error(`Bot does not have access to guild ${guildId}. Ensure the bot is a member of the Discord server.`);
            }
            if (errorCode === 50013) {
                throw new Error(`Bot lacks permissions to list channels in guild ${guildId}. Grant the bot "View Server" permission.`);
            }
            throw error;
        }
    }
    async getGuildChannelsViaRest(guildId, cacheKey) {
        try {
            const response = await this.discordRestRequest('GET', `/guilds/${encodeURIComponent(guildId)}/channels`);
            if (!response.ok) {
                const errorBody = await response.text();
                logger_1.logger.error(`Discord REST API error fetching channels for guild ${guildId}: ${response.status}`, { body: errorBody });
                throw this.createRestError(response.status, errorBody, `fetch channels for guild ${guildId}`);
            }
            const rawChannels = (await response.json());
            const sortedChannels = [...rawChannels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            const channels = sortedChannels.map(ch => ({
                id: ch.id,
                name: ch.name,
                type: ch.type,
                parentId: ch.parent_id ?? undefined,
            }));
            await this.roleCache.set(cacheKey, channels);
            logger_1.logger.debug(`Fetched and cached ${channels.length} channels for guild ${guildId} via REST API`);
            return channels;
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch guild channels via REST for ${guildId}:`, error);
            throw error;
        }
    }
    async discordRestRequest(method, path, body, _retryCount = 0) {
        const response = await fetch(`https://discord.com/api/v10${path}`, {
            method,
            headers: {
                Authorization: `Bot ${this.botToken}`,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(15_000),
        });
        if (response.status === 429 && _retryCount < 3) {
            const retryAfter = response.headers.get('retry-after');
            const delay = retryAfter ? Math.min(Number(retryAfter) * 1000, 10_000) : 1000;
            logger_1.logger.warn(`Discord REST rate limited on ${method} ${path}, retrying after ${delay}ms (attempt ${_retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.discordRestRequest(method, path, body, _retryCount + 1);
        }
        return response;
    }
    async getGuildRolesViaRest(guildId, cacheKey) {
        try {
            const response = await this.discordRestRequest('GET', `/guilds/${encodeURIComponent(guildId)}/roles`);
            if (!response.ok) {
                const errorBody = await response.text();
                logger_1.logger.error(`Discord REST API error fetching roles for guild ${guildId}: ${response.status}`, { body: errorBody });
                throw this.createRestError(response.status, errorBody, `fetch roles for guild ${guildId}`);
            }
            const rawRoles = (await response.json());
            const roles = rawRoles
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position)
                .map(role => ({ id: role.id, name: role.name }));
            await this.roleCache.set(cacheKey, roles);
            logger_1.logger.debug(`Fetched and cached ${roles.length} roles for guild ${guildId} via REST API`);
            return roles;
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch guild roles via REST for ${guildId}:`, error);
            throw error;
        }
    }
    async assignRole(guildId, userId, roleId, enqueueOnFailure = true) {
        try {
            if (this.client.isReady()) {
                await this.assignRoleViaGateway(guildId, userId, roleId);
            }
            else {
                await this.modifyMemberRoleViaRest('PUT', guildId, userId, roleId, 'assign');
            }
            const cacheKey = `${guildId}:${userId}`;
            await this.roleCache.del(cacheKey);
            logger_1.logger.info(`Role ${roleId} assigned to user ${userId}`);
            return `Role assigned to user ${userId}`;
        }
        catch (error) {
            const enhancedError = this.enhanceRoleError(error, 'assign', guildId, userId, roleId);
            logger_1.logger.error(`Failed to assign role ${roleId} to user ${userId}:`, enhancedError);
            if (enqueueOnFailure) {
                try {
                    const { getRoleSyncRetryService } = await Promise.resolve().then(() => __importStar(require('./RoleSyncRetryService')));
                    const { RoleSyncOperationType } = await Promise.resolve().then(() => __importStar(require('../../models/RoleSyncRetryQueue')));
                    const retryService = getRoleSyncRetryService();
                    await retryService.enqueue({
                        guildId,
                        userId,
                        roleId,
                        operation: RoleSyncOperationType.ASSIGN,
                    });
                    logger_1.logger.info(`Added failed role assignment to retry queue: ${roleId} for user ${userId}`);
                }
                catch (enqueueError) {
                    logger_1.logger.error('Failed to enqueue role assignment for retry:', enqueueError);
                }
            }
            throw enhancedError;
        }
    }
    async removeRole(guildId, userId, roleId, enqueueOnFailure = true) {
        try {
            if (this.client.isReady()) {
                await this.removeRoleViaGateway(guildId, userId, roleId);
            }
            else {
                await this.modifyMemberRoleViaRest('DELETE', guildId, userId, roleId, 'remove');
            }
            const cacheKey = `${guildId}:${userId}`;
            await this.roleCache.del(cacheKey);
            logger_1.logger.info(`Role ${roleId} removed from user ${userId}`);
            return `Role removed from user ${userId}`;
        }
        catch (error) {
            const enhancedError = this.enhanceRoleError(error, 'remove', guildId, userId, roleId);
            logger_1.logger.error(`Failed to remove role ${roleId} from user ${userId}:`, enhancedError);
            if (enqueueOnFailure) {
                try {
                    const { getRoleSyncRetryService } = await Promise.resolve().then(() => __importStar(require('./RoleSyncRetryService')));
                    const { RoleSyncOperationType } = await Promise.resolve().then(() => __importStar(require('../../models/RoleSyncRetryQueue')));
                    const retryService = getRoleSyncRetryService();
                    await retryService.enqueue({
                        guildId,
                        userId,
                        roleId,
                        operation: RoleSyncOperationType.REMOVE,
                    });
                    logger_1.logger.info(`Added failed role removal to retry queue: ${roleId} for user ${userId}`);
                }
                catch (enqueueError) {
                    logger_1.logger.error('Failed to enqueue role removal for retry:', enqueueError);
                }
            }
            throw enhancedError;
        }
    }
    async clearRoleCache(guildId, userId) {
        if (guildId && userId) {
            const cacheKey = `${guildId}:${userId}`;
            await this.roleCache.del(cacheKey);
            logger_1.logger.info(`Discord role cache cleared for user ${userId} in guild ${guildId}`);
        }
        else if (guildId) {
            await this.roleCache.delPattern(`${guildId}:*`);
            logger_1.logger.info(`Discord role cache cleared for guild ${guildId}`);
        }
        else {
            await this.roleCache.flushAll();
            logger_1.logger.info('Discord role cache cleared');
        }
    }
    async getRoleCacheStats() {
        return this.roleCache.getStats();
    }
    async assignRoleViaGateway(guildId, userId, roleId) {
        const guild = await this.client.guilds.fetch(guildId);
        const botMember = guild.members.me;
        if (botMember && !botMember.permissions.has('ManageRoles')) {
            throw new Error(`Bot lacks MANAGE_ROLES permission in guild ${guild.name} (${guildId})`);
        }
        const targetRole = guild.roles.cache.get(roleId);
        if (targetRole && botMember && botMember.roles.highest.position <= targetRole.position) {
            throw new Error(`Cannot assign role "${targetRole.name}" — it is at or above bot's highest role in hierarchy`);
        }
        const member = await guild.members.fetch(userId);
        await member.roles.add(roleId);
    }
    async removeRoleViaGateway(guildId, userId, roleId) {
        const guild = await this.client.guilds.fetch(guildId);
        const botMember = guild.members.me;
        if (botMember && !botMember.permissions.has('ManageRoles')) {
            throw new Error(`Bot lacks MANAGE_ROLES permission in guild ${guild.name} (${guildId})`);
        }
        const member = await guild.members.fetch(userId);
        await member.roles.remove(roleId);
    }
    async modifyMemberRoleViaRest(method, guildId, userId, roleId, operation) {
        const response = await this.discordRestRequest(method, `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`);
        if (!response.ok) {
            const errorBody = await response.text();
            logger_1.logger.error(`Discord REST API error (${operation} role ${roleId} for user ${userId} in guild ${guildId}): ${response.status}`, { body: errorBody });
            throw this.createRestError(response.status, errorBody, `${operation} role ${roleId}`);
        }
    }
    createRestError(status, rawBody, context) {
        let discordCode;
        let discordMessage;
        try {
            const parsed = JSON.parse(rawBody);
            discordCode = parsed.code;
            discordMessage = parsed.message;
        }
        catch {
        }
        if (discordCode === 50001 || status === 403) {
            return new Error(`Bot does not have access to ${context}. Ensure the bot is a member and has the required permissions.`);
        }
        if (discordCode === 50013) {
            return new Error(`Bot lacks permissions to ${context}. Check the bot's role hierarchy and permissions.`);
        }
        if (discordCode === 10007) {
            return new Error(`Member not found when trying to ${context}. The user may have left the server.`);
        }
        if (discordCode === 10011) {
            return new Error(`Role not found when trying to ${context}. The role may have been deleted.`);
        }
        const suffix = discordMessage ? `: ${discordMessage}` : '';
        return new Error(`Discord API returned ${status} when trying to ${context}${suffix}`);
    }
    enhanceRoleError(error, operation, guildId, userId, roleId) {
        if (!(error instanceof Error)) {
            return new Error(`Failed to ${operation} role: Unknown error`);
        }
        const errorMessage = error.message.toLowerCase();
        const errorCode = error.code;
        if (errorCode === 50013 || errorMessage.includes('missing permissions')) {
            return new Error(`Cannot ${operation} role: Bot lacks "Manage Roles" permission or the target role is higher in the hierarchy than the bot's highest role. ` +
                `Solution: Move the bot's role above the target role in Discord Server Settings > Roles, or grant additional permissions.`);
        }
        if (errorCode === 50001 || errorMessage.includes('missing access')) {
            return new Error(`Cannot ${operation} role: Bot does not have access to this guild or the member. ` +
                `Solution: Ensure the bot is a member of the server and has proper permissions.`);
        }
        if (errorCode === 10011 || errorMessage.includes('unknown role')) {
            return new Error(`Cannot ${operation} role: Role ${roleId} not found in guild ${guildId}. ` +
                `The role may have been deleted. Solution: Recreate the role or update the role mapping.`);
        }
        if (errorCode === 10007 || errorMessage.includes('unknown member')) {
            return new Error(`Cannot ${operation} role: User ${userId} is not a member of guild ${guildId}. ` +
                `The user may have left the server. Solution: Verify the user is still in the Discord server.`);
        }
        if (errorMessage.includes('rate limit')) {
            return new Error(`Cannot ${operation} role: Discord rate limit exceeded. ` +
                `This operation will be automatically retried. Solution: Reduce the frequency of role operations or wait a moment before trying again.`);
        }
        if (errorMessage.includes('hierarchy')) {
            return new Error(`Cannot ${operation} role: Role hierarchy issue - the target role is higher than or equal to the bot's highest role. ` +
                `Solution: In Discord Server Settings > Roles, drag the bot's role above all roles it needs to manage.`);
        }
        return new Error(`Failed to ${operation} role ${roleId} for user ${userId} in guild ${guildId}: ${error.message}. ` +
            `Common causes: Missing permissions, role hierarchy issues, or the user/role no longer exists.`);
    }
    disconnect() {
        void this.client.destroy();
        logger_1.logger.info('Discord client disconnected');
    }
}
exports.DiscordService = DiscordService;
let discordServiceInstance = null;
const initializeDiscordService = (botToken, clientId, clientSecret, redirectUri) => {
    discordServiceInstance ??= new DiscordService(botToken, clientId, clientSecret, redirectUri);
    return discordServiceInstance;
};
exports.initializeDiscordService = initializeDiscordService;
const isDiscordServiceInitialized = () => discordServiceInstance !== null;
exports.isDiscordServiceInitialized = isDiscordServiceInitialized;
const getDiscordService = () => {
    if (!discordServiceInstance) {
        throw new Error('Discord service not initialized. Call initializeDiscordService first.');
    }
    return discordServiceInstance;
};
exports.getDiscordService = getDiscordService;
//# sourceMappingURL=DiscordService.js.map