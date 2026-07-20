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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementCleanupJob = exports.ChannelCounterUpdateJob = exports.StatRoleEvaluationJob = void 0;
const discord_js_1 = require("discord.js");
const node_cron_1 = __importDefault(require("node-cron"));
const ChannelCounterService_1 = require("../../services/discord/ChannelCounterService");
const StatRoleService_1 = require("../../services/discord/StatRoleService");
const logger_1 = require("../../utils/logger");
const discord_1 = require("../utils/discord");
function stopAllTasks(tasks) {
    for (const task of tasks) {
        void task.stop();
    }
}
class StatRoleEvaluationJob {
    tasks = [];
    client;
    statRoleService;
    constructor(client) {
        this.client = client;
        this.statRoleService = StatRoleService_1.StatRoleService.getInstance();
    }
    start() {
        const task = node_cron_1.default.schedule('0 */6 * * *', () => {
            this.evaluateAll().catch(err => logger_1.logger.error('StatRoleEvaluationJob: evaluation failed', err));
        });
        this.tasks.push(task);
        logger_1.logger.info('📊 StatRoleEvaluationJob scheduled (every 6 hours)');
    }
    stop() {
        stopAllTasks(this.tasks);
        this.tasks = [];
    }
    async evaluateAll() {
        for (const guild of this.client.guilds.cache.values()) {
            await this.evaluateGuild(guild);
        }
    }
    async evaluateGuild(guild) {
        try {
            const results = await this.statRoleService.evaluateGuild(guild.id);
            if (results.length === 0) {
                return;
            }
            for (const { roleId, addUserIds, removeUserIds } of results) {
                const role = guild.roles.cache.get(roleId);
                if (!role) {
                    continue;
                }
                await this.applyRoleChanges(guild, roleId, role, addUserIds, true);
                await this.applyRoleChanges(guild, roleId, role, removeUserIds, false);
            }
            logger_1.logger.debug(`StatRoleEvaluationJob: evaluated ${results.length} stat roles for ${guild.name}`);
        }
        catch (error) {
            logger_1.logger.error(`StatRoleEvaluationJob: failed for guild ${guild.name}:`, error);
        }
    }
    async applyRoleChanges(guild, roleId, role, userIds, add) {
        if (userIds.length === 0) {
            return;
        }
        if (!(0, discord_1.checkBotGuildPermissions)(guild, discord_js_1.PermissionFlagsBits.ManageRoles)) {
            logger_1.logger.warn(`StatRoleEvaluationJob: bot lacks ManageRoles in guild ${guild.name} (${guild.id}), skipping`);
            return;
        }
        const CHUNK_SIZE = 100;
        const CONCURRENCY = 5;
        for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
            const chunk = userIds.slice(i, i + CHUNK_SIZE);
            const members = await guild.members.fetch({ user: chunk }).catch(err => {
                logger_1.logger.warn(`Failed to fetch members chunk for role assignment:`, err);
                return new Map();
            });
            const promises = [];
            let active = 0;
            for (const [, member] of members) {
                const hasRole = member.roles.cache.has(roleId);
                const needsChange = add ? !hasRole : hasRole;
                if (!needsChange) {
                    continue;
                }
                const task = (async () => {
                    try {
                        if (add) {
                            await member.roles.add(role, 'Stat role: threshold met');
                        }
                        else {
                            await member.roles.remove(role, 'Stat role: threshold no longer met');
                        }
                    }
                    catch {
                    }
                })();
                promises.push(task);
                active++;
                if (active >= CONCURRENCY) {
                    await Promise.all(promises);
                    promises.length = 0;
                    active = 0;
                }
            }
            if (promises.length > 0) {
                await Promise.all(promises);
            }
        }
    }
}
exports.StatRoleEvaluationJob = StatRoleEvaluationJob;
class ChannelCounterUpdateJob {
    tasks = [];
    client;
    counterService;
    constructor(client) {
        this.client = client;
        this.counterService = ChannelCounterService_1.ChannelCounterService.getInstance();
    }
    start() {
        const task = node_cron_1.default.schedule('*/10 * * * *', () => {
            this.updateAll().catch(err => logger_1.logger.error('ChannelCounterUpdateJob: update failed', err));
        });
        this.tasks.push(task);
        logger_1.logger.info('📊 ChannelCounterUpdateJob scheduled (every 10 minutes)');
    }
    stop() {
        stopAllTasks(this.tasks);
        this.tasks = [];
    }
    async updateAll() {
        for (const guild of this.client.guilds.cache.values()) {
            try {
                await this.counterService.updateCounters(this.client, guild.id);
            }
            catch (error) {
                logger_1.logger.error(`ChannelCounterUpdateJob: failed for ${guild.name}:`, error);
            }
        }
    }
}
exports.ChannelCounterUpdateJob = ChannelCounterUpdateJob;
class EngagementCleanupJob {
    tasks = [];
    start() {
        const task = node_cron_1.default.schedule('0 3 * * *', () => {
            this.cleanup().catch(err => logger_1.logger.error('EngagementCleanupJob: cleanup failed', err));
        });
        this.tasks.push(task);
        logger_1.logger.info('📊 EngagementCleanupJob scheduled (daily at 03:00)');
    }
    stop() {
        stopAllTasks(this.tasks);
        this.tasks = [];
    }
    async cleanup() {
        const { MemberEngagementService } = await Promise.resolve().then(() => __importStar(require('../../services/discord/MemberEngagementService')));
        const service = MemberEngagementService.getInstance();
        const deleted = await service.cleanupOldData(90);
        if (deleted > 0) {
            logger_1.logger.info(`🧹 EngagementCleanupJob: deleted ${deleted} old engagement records`);
        }
    }
}
exports.EngagementCleanupJob = EngagementCleanupJob;
//# sourceMappingURL=engagementJobs.js.map