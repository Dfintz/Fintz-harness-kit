"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordReconciliationService = void 0;
const discord_js_1 = require("discord.js");
const typeorm_1 = require("typeorm");
const BotClientManager_1 = require("../../bot/BotClientManager");
const data_source_1 = require("../../data-source");
const DiscordGuildSettings_1 = require("../../models/DiscordGuildSettings");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const query_1 = require("../../utils/query");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
const MEMBER_FETCH_LIMIT = 1000;
const PER_MEMBER_DELAY_MS = 200;
const PER_GUILD_DELAY_MS = 2000;
const MAX_ERRORS_PER_GUILD = 50;
class DiscordReconciliationService {
    static instance;
    settingsService;
    processing = false;
    constructor() {
        this.settingsService = new DiscordSettingsService_1.DiscordSettingsService();
    }
    static getInstance() {
        DiscordReconciliationService.instance ??= new DiscordReconciliationService();
        return DiscordReconciliationService.instance;
    }
    async runPass(force = false) {
        if (this.processing) {
            logger_1.logger.warn('DiscordReconciliationService: pass already in progress, skipping');
            return this.emptyPassResult();
        }
        this.processing = true;
        const passStart = Date.now();
        try {
            const client = this.getClient();
            if (!client) {
                logger_1.logger.debug('DiscordReconciliationService: no bot client available, skipping pass');
                return this.emptyPassResult();
            }
            const dueSettings = await this.loadDueSettings(force);
            if (!dueSettings) {
                return this.emptyPassResult();
            }
            return await this.processGuilds(client, dueSettings, passStart);
        }
        catch (err) {
            logger_1.logger.error('DiscordReconciliationService: pass failed', {
                error: (0, errorHandler_1.getErrorMessage)(err),
            });
            return this.emptyPassResult();
        }
        finally {
            this.processing = false;
        }
    }
    async loadDueSettings(force) {
        const enabledSettings = [];
        await (0, query_1.findInBatches)(data_source_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings), {}, batch => {
            for (const s of batch) {
                if (s.roleSyncSettings?.enabled) {
                    enabledSettings.push(s);
                }
            }
        });
        if (enabledSettings.length === 0) {
            logger_1.logger.debug('DiscordReconciliationService: no guilds with role sync enabled');
            return null;
        }
        const now = Date.now();
        const due = force
            ? enabledSettings
            : enabledSettings.filter(s => {
                const intervalMs = (s.roleSyncSettings?.syncIntervalMinutes ?? 60) * 60 * 1000;
                const lastSync = s.lastSyncedAt?.getTime() ?? 0;
                return now - lastSync >= intervalMs;
            });
        const skipped = enabledSettings.length - due.length;
        if (due.length === 0) {
            logger_1.logger.debug('DiscordReconciliationService: no guilds due for reconciliation');
            return null;
        }
        return { due, skipped };
    }
    async processGuilds(client, settings, passStart) {
        const { due, skipped } = settings;
        const passResult = {
            guildsProcessed: 0,
            guildsSkipped: skipped,
            totalRolesAssigned: 0,
            totalRolesRemoved: 0,
            totalNicknamesSynced: 0,
            totalMembersScanned: 0,
            totalErrors: 0,
            results: [],
            durationMs: 0,
        };
        logger_1.logger.info(`DiscordReconciliationService: starting pass — ${due.length} guild(s) due, ${skipped} skipped`);
        for (let i = 0; i < due.length; i++) {
            const guildSettings = due[i];
            const guild = client.guilds.cache.get(guildSettings.guildId);
            if (!guild) {
                logger_1.logger.debug(`DiscordReconciliationService: guild ${guildSettings.guildId} not in cache, skipping`);
                passResult.guildsSkipped++;
                continue;
            }
            const result = await this.reconcileGuild(guild, guildSettings);
            this.accumulateResult(passResult, result);
            const errorSummary = result.errors.length > 0 ? `${result.errors.length} error(s)` : undefined;
            await this.settingsService.markSynced(guildSettings.organizationId, guildSettings.guildId, errorSummary);
            if (i < due.length - 1) {
                await this.delay(PER_GUILD_DELAY_MS);
            }
        }
        passResult.durationMs = Date.now() - passStart;
        logger_1.logger.info('DiscordReconciliationService: pass complete', {
            guildsProcessed: passResult.guildsProcessed,
            guildsSkipped: passResult.guildsSkipped,
            rolesAssigned: passResult.totalRolesAssigned,
            rolesRemoved: passResult.totalRolesRemoved,
            nicknamesSynced: passResult.totalNicknamesSynced,
            membersScanned: passResult.totalMembersScanned,
            errors: passResult.totalErrors,
            durationMs: passResult.durationMs,
        });
        return passResult;
    }
    accumulateResult(passResult, result) {
        passResult.results.push(result);
        passResult.guildsProcessed++;
        passResult.totalRolesAssigned += result.rolesAssigned;
        passResult.totalRolesRemoved += result.rolesRemoved;
        passResult.totalNicknamesSynced += result.nicknamesSynced;
        passResult.totalMembersScanned += result.membersScanned;
        passResult.totalErrors += result.errors.length;
    }
    async reconcileGuild(guild, settings) {
        const start = Date.now();
        const result = {
            guildId: guild.id,
            organizationId: settings.organizationId,
            guildName: guild.name,
            rolesAssigned: 0,
            rolesRemoved: 0,
            nicknamesSynced: 0,
            membersScanned: 0,
            errors: [],
            durationMs: 0,
        };
        try {
            const roleSync = settings.roleSyncSettings ?? { enabled: false };
            const guildMembers = await this.fetchAllGuildMembers(guild);
            result.membersScanned = guildMembers.size;
            const orgDiscordMap = await this.buildOrgDiscordMap(settings.organizationId);
            const managedRoleIds = this.collectManagedRoleIds(roleSync);
            await this.processGuildMembers(guildMembers, orgDiscordMap, roleSync, managedRoleIds, result);
            logger_1.logger.info(`DiscordReconciliationService: reconciled guild ${guild.name}`, {
                guildId: guild.id,
                organizationId: settings.organizationId,
                membersScanned: result.membersScanned,
                rolesAssigned: result.rolesAssigned,
                rolesRemoved: result.rolesRemoved,
                nicknamesSynced: result.nicknamesSynced,
                errors: result.errors.length,
            });
        }
        catch (err) {
            result.errors.push(`Guild-level error: ${(0, errorHandler_1.getErrorMessage)(err)}`);
        }
        result.durationMs = Date.now() - start;
        return result;
    }
    async buildOrgDiscordMap(organizationId) {
        const orgMembers = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).find({
            where: { organizationId, isActive: true },
            select: ['userId'],
        });
        const orgUserIds = orgMembers.map(m => m.userId);
        const platformUsers = orgUserIds.length > 0
            ? await data_source_1.AppDataSource.getRepository(User_1.User).find({
                where: { id: (0, typeorm_1.In)(orgUserIds) },
                select: ['id', 'discordId', 'rsiHandle'],
            })
            : [];
        const map = new Map();
        for (const user of platformUsers) {
            if (user.discordId) {
                map.set(user.discordId, { userId: user.id, rsiHandle: user.rsiHandle });
            }
        }
        return map;
    }
    async processGuildMembers(guildMembers, orgDiscordMap, roleSync, managedRoleIds, result) {
        for (const [, member] of guildMembers) {
            if (member.user.bot) {
                continue;
            }
            try {
                const memberResult = await this.reconcileMember(member, orgDiscordMap, roleSync, managedRoleIds);
                result.rolesAssigned += memberResult.assigned;
                result.rolesRemoved += memberResult.removed;
                result.nicknamesSynced += memberResult.nicknameSynced ? 1 : 0;
            }
            catch (err) {
                result.errors.push(`Member ${member.user.id}: ${(0, errorHandler_1.getErrorMessage)(err)}`);
                if (result.errors.length >= MAX_ERRORS_PER_GUILD) {
                    result.errors.push('...error limit reached, suppressing further errors');
                    break;
                }
            }
            await this.delay(PER_MEMBER_DELAY_MS);
        }
    }
    async reconcileMember(member, orgDiscordMap, roleSync, managedRoleIds) {
        const platformUser = orgDiscordMap.get(member.user.id);
        if (platformUser) {
            return this.reconcileOrgMember(member, platformUser, roleSync);
        }
        return this.reconcileNonOrgMember(member, roleSync, managedRoleIds);
    }
    async reconcileOrgMember(member, platformUser, roleSync) {
        let assigned = 0;
        let nicknameSynced = false;
        if (roleSync.verifiedRoleId && platformUser.rsiHandle) {
            if (!member.roles.cache.has(roleSync.verifiedRoleId)) {
                const success = await this.safeAddRole(member, roleSync.verifiedRoleId, 'Reconciliation: verified role');
                if (success) {
                    assigned++;
                }
            }
        }
        if (roleSync.syncNicknames && platformUser.rsiHandle) {
            nicknameSynced = await this.syncNickname(member, platformUser.rsiHandle, roleSync);
        }
        return { assigned, removed: 0, nicknameSynced };
    }
    async reconcileNonOrgMember(member, roleSync, managedRoleIds) {
        let removed = 0;
        if (!roleSync.removeRolesOnLeave) {
            return { assigned: 0, removed: 0, nicknameSynced: false };
        }
        const rolesToRemove = [...member.roles.cache.keys()].filter(id => managedRoleIds.has(id));
        for (const roleId of rolesToRemove) {
            const success = await this.safeRemoveRole(member, roleId, 'Reconciliation: user not in org');
            if (success) {
                removed++;
            }
        }
        return { assigned: 0, removed, nicknameSynced: false };
    }
    async syncNickname(member, rsiHandle, roleSync) {
        const desiredNick = this.formatNickname(rsiHandle, member.displayName, roleSync.nicknameFormat);
        if (member.nickname === desiredNick || member.id === member.guild.ownerId) {
            return false;
        }
        try {
            await member.setNickname(desiredNick, 'Reconciliation: nickname sync');
            return true;
        }
        catch {
            return false;
        }
    }
    async fetchAllGuildMembers(guild) {
        try {
            return await guild.members.fetch({ limit: MEMBER_FETCH_LIMIT });
        }
        catch (err) {
            logger_1.logger.error('DiscordReconciliationService: failed to fetch guild members', {
                error: (0, errorHandler_1.getErrorMessage)(err),
                guildId: guild.id,
            });
            return new discord_js_1.Collection();
        }
    }
    collectManagedRoleIds(roleSync) {
        const ids = new Set();
        if (roleSync.verifiedRoleId) {
            ids.add(roleSync.verifiedRoleId);
        }
        if (roleSync.roleMappings) {
            for (const mappedValue of Object.values(roleSync.roleMappings)) {
                const mappedRoleIds = Array.isArray(mappedValue) ? mappedValue : [mappedValue];
                for (const roleId of mappedRoleIds) {
                    if (roleId) {
                        ids.add(roleId);
                    }
                }
            }
        }
        return ids;
    }
    formatNickname(rsiHandle, displayName, format) {
        if (!format) {
            return rsiHandle;
        }
        return format.replaceAll('{rsiHandle}', rsiHandle).replaceAll('{displayName}', displayName);
    }
    async safeAddRole(member, roleId, reason) {
        try {
            await member.roles.add(roleId, reason);
            return true;
        }
        catch (err) {
            logger_1.logger.warn('DiscordReconciliationService: failed to add role', {
                error: (0, errorHandler_1.getErrorMessage)(err),
                guildId: member.guild.id,
                memberId: member.user.id,
                roleId,
            });
            return false;
        }
    }
    async safeRemoveRole(member, roleId, reason) {
        try {
            await member.roles.remove(roleId, reason);
            return true;
        }
        catch (err) {
            logger_1.logger.warn('DiscordReconciliationService: failed to remove role', {
                error: (0, errorHandler_1.getErrorMessage)(err),
                guildId: member.guild.id,
                memberId: member.user.id,
                roleId,
            });
            return false;
        }
    }
    getClient() {
        try {
            const manager = BotClientManager_1.BotClientManager.getInstance();
            const client = manager.getClient();
            return client.isReady() ? client : null;
        }
        catch {
            return null;
        }
    }
    emptyPassResult() {
        return {
            guildsProcessed: 0,
            guildsSkipped: 0,
            totalRolesAssigned: 0,
            totalRolesRemoved: 0,
            totalNicknamesSynced: 0,
            totalMembersScanned: 0,
            totalErrors: 0,
            results: [],
            durationMs: 0,
        };
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.DiscordReconciliationService = DiscordReconciliationService;
//# sourceMappingURL=DiscordReconciliationService.js.map