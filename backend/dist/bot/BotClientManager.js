"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotClientManager = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../utils/logger");
const restRateLimitObserver_1 = require("./utils/restRateLimitObserver");
class BotClientManager {
    static instance = null;
    client;
    loggedIn = false;
    loginPromise = null;
    constructor() {
        this.client = new discord_js_1.Client({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.MessageContent,
                discord_js_1.GatewayIntentBits.GuildVoiceStates,
                discord_js_1.GatewayIntentBits.GuildModeration,
                discord_js_1.GatewayIntentBits.GuildMessageReactions,
                discord_js_1.GatewayIntentBits.GuildMembers,
                discord_js_1.GatewayIntentBits.GuildPresences,
                discord_js_1.GatewayIntentBits.GuildScheduledEvents,
            ],
            partials: [
                discord_js_1.Partials.Message,
                discord_js_1.Partials.Channel,
                discord_js_1.Partials.Reaction,
                discord_js_1.Partials.GuildMember,
            ],
            makeCache: discord_js_1.Options.cacheWithLimits({
                ...discord_js_1.Options.DefaultMakeCacheSettings,
                ReactionManager: 0,
                GuildMemberManager: { maxSize: 200, keepOverLimit: m => m.id === m.client.user?.id },
                MessageManager: { maxSize: 100 },
            }),
            sweepers: {
                ...discord_js_1.Options.DefaultSweeperSettings,
                messages: { interval: 3600, lifetime: 1800 },
            },
            rest: { invalidRequestWarningInterval: 100 },
        });
        this.client.on('error', error => {
            logger_1.logger.error('Discord client error:', error);
        });
        this.client.on('warn', warning => {
            logger_1.logger.warn('Discord client warning:', warning);
        });
        (0, restRateLimitObserver_1.registerRestRateLimitObserver)(this.client.rest);
    }
    static getInstance() {
        BotClientManager.instance ??= new BotClientManager();
        return BotClientManager.instance;
    }
    getClient() {
        return this.client;
    }
    async login(token) {
        if (this.loggedIn) {
            return;
        }
        if (this.loginPromise) {
            await this.loginPromise;
            return;
        }
        this.loginPromise = this.client.login(token);
        try {
            await this.loginPromise;
            this.loggedIn = true;
            logger_1.logger.info(`✅ BotClientManager: Discord client logged in as ${this.client.user?.tag}`);
        }
        catch (error) {
            logger_1.logger.error('❌ BotClientManager: Failed to login to Discord:', error);
            throw error;
        }
        finally {
            this.loginPromise = null;
        }
    }
    isReady() {
        return this.loggedIn && this.client.isReady();
    }
    async destroy() {
        if (this.loggedIn) {
            void this.client.destroy();
            this.loggedIn = false;
            logger_1.logger.info('BotClientManager: Client destroyed');
        }
    }
    static resetInstance() {
        if (BotClientManager.instance) {
            BotClientManager.instance.client.removeAllListeners();
            BotClientManager.instance = null;
        }
    }
}
exports.BotClientManager = BotClientManager;
//# sourceMappingURL=BotClientManager.js.map