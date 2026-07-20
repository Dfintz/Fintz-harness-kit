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
exports.createEventTempVoiceChannel = createEventTempVoiceChannel;
exports.handleEventVoiceEmpty = handleEventVoiceEmpty;
exports.handleVoiceAutoCreate = handleVoiceAutoCreate;
exports.getDynamicChannels = getDynamicChannels;
exports.getChannelOwners = getChannelOwners;
exports.getChannelOwner = getChannelOwner;
exports.setChannelOwner = setChannelOwner;
exports.reconcileDynamicChannels = reconcileDynamicChannels;
exports.clearDeletionTimers = clearDeletionTimers;
exports.bootstrapHubMembers = bootstrapHubMembers;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const database_1 = require("../../config/database");
const DiscordGuildSettings_1 = require("../../models/DiscordGuildSettings");
const FederationDiscordGuildSettings_1 = require("../../models/FederationDiscordGuildSettings");
const communication_1 = require("../../services/communication");
const types_1 = require("../../types");
const logger_1 = require("../../utils/logger");
const voiceInterfaceEmbed_1 = require("../embeds/voiceInterfaceEmbed");
const discord_1 = require("../utils/discord");
const lfgLobbyHandler_1 = require("./lfgLobbyHandler");
const voiceChannelService = communication_1.VoiceChannelService.getInstance();
const dynamicChannels = new Map();
const channelOwners = new Map();
const deletionTimers = new Map();
const pendingCreations = new Set();
async function postVoiceInterfaceMessage(channel, channelName, creatorDisplayName) {
    const embed = (0, voiceInterfaceEmbed_1.buildVoiceInterfaceEmbed)(channelName, creatorDisplayName);
    const controlRow = (0, voiceInterfaceEmbed_1.buildVoiceControlButtons)(channel.id);
    const modRow = (0, voiceInterfaceEmbed_1.buildVoiceModerationButtons)(channel.id);
    const extRow = (0, voiceInterfaceEmbed_1.buildVoiceExtendedButtons)(channel.id);
    await channel.send({
        embeds: [embed],
        components: [controlRow, modRow, extRow],
    });
}
async function grantOwnerPermissions(channel, userId) {
    await channel.permissionOverwrites.edit(userId, {
        Connect: true,
        Speak: true,
        Stream: true,
        ManageChannels: true,
        MoveMembers: true,
        MuteMembers: true,
        DeafenMembers: true,
    });
}
async function createEventTempVoiceChannel(input) {
    const { guild, creator, channelName, parentCategoryId, userLimit, expiresAt, eventId } = input;
    try {
        if (!(0, discord_1.checkBotGuildPermissions)(guild, discord_js_1.PermissionFlagsBits.ManageChannels, discord_js_1.PermissionFlagsBits.MoveMembers)) {
            logger_1.logger.warn(`Event VC: bot lacks ManageChannels or MoveMembers in guild ${guild.name} (${guild.id})`);
            return null;
        }
        const tempChannel = await guild.channels.create({
            name: channelName,
            type: discord_js_1.ChannelType.GuildVoice,
            parent: parentCategoryId,
            userLimit,
        });
        voiceChannelService.createChannel(channelName, guild.id, tempChannel.id, creator.id, types_1.VoiceChannelType.EVENT, { eventId, expiresAt, userLimit });
        setChannelOwner(tempChannel.id, creator.id);
        await grantOwnerPermissions(tempChannel, creator.id).catch(() => { });
        await postVoiceInterfaceMessage(tempChannel, channelName, creator.displayName).catch(err => {
            logger_1.logger.debug('Event VC: failed to post voice control panel', {
                channelId: tempChannel.id,
                error: err instanceof Error ? err.message : String(err),
            });
        });
        return {
            channelId: tempChannel.id,
            channelName,
        };
    }
    catch (error) {
        logger_1.logger.warn('Failed to create shared event temp voice channel', {
            guildId: guild.id,
            creatorId: creator.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
async function getVoiceSettings(guildId) {
    try {
        if (!database_1.AppDataSource.isInitialized) {
            logger_1.logger.warn(`Voice auto-create: AppDataSource not initialized for guild ${guildId}`);
            return null;
        }
        const repo = database_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
        const allSettings = await repo.find({ where: { guildId } });
        if (allSettings.length > 0) {
            const withVoice = allSettings.find(s => s.voiceChannelSettings?.autoCreateChannels);
            if (withVoice?.voiceChannelSettings) {
                return withVoice.voiceChannelSettings;
            }
            logger_1.logger.debug(`Voice auto-create: No active voice settings in org rows for guild ${guildId} (checked ${allSettings.length} row(s))`);
        }
        else {
            logger_1.logger.debug(`Voice auto-create: No org guild settings found for guild ${guildId}`);
        }
        try {
            const fedRepo = database_1.AppDataSource.getRepository(FederationDiscordGuildSettings_1.FederationDiscordGuildSettings);
            const fedSettings = await fedRepo.find({ where: { guildId } });
            const fedWithVoice = fedSettings.find(s => s.voiceChannelSettings?.autoCreateChannels);
            if (fedWithVoice?.voiceChannelSettings) {
                logger_1.logger.debug(`Voice auto-create: Found federation voice settings for guild ${guildId} (federation ${fedWithVoice.federationId})`);
                return fedWithVoice.voiceChannelSettings;
            }
        }
        catch (fedError) {
            logger_1.logger.error(`Voice auto-create: Failed to check federation voice settings for guild ${guildId}:`, fedError);
        }
        return null;
    }
    catch (error) {
        logger_1.logger.error(`Voice auto-create: Failed to load voice settings for guild ${guildId}:`, error);
        return null;
    }
}
function resolveParentCategory(voiceSettings, hubChannel) {
    if (voiceSettings.parentCategoryId) {
        return voiceSettings.parentCategoryId;
    }
    return hubChannel?.parentId ?? undefined;
}
async function createTempChannelForMember(guild, member, hubChannel, voiceSettings) {
    if (voiceSettings.maxActiveChannels) {
        const totalActive = dynamicChannels.size + pendingCreations.size;
        if (totalActive >= voiceSettings.maxActiveChannels) {
            logger_1.logger.warn(`Voice auto-create: max active channels (${voiceSettings.maxActiveChannels}) reached for guild ${guild.id}`);
            return false;
        }
    }
    const reservationKey = `${guild.id}:${member.id}`;
    if (pendingCreations.has(reservationKey)) {
        return false;
    }
    pendingCreations.add(reservationKey);
    try {
        if (!(0, discord_1.checkBotGuildPermissions)(guild, discord_js_1.PermissionFlagsBits.ManageChannels, discord_js_1.PermissionFlagsBits.MoveMembers)) {
            logger_1.logger.warn(`Voice auto-create: bot lacks ManageChannels or MoveMembers in guild ${guild.name} (${guild.id})`);
            return false;
        }
        const parentId = resolveParentCategory(voiceSettings, hubChannel);
        if (parentId) {
            const parentChannel = guild.channels.cache.get(parentId);
            if (parentChannel && 'permissionsFor' in parentChannel) {
                const me = guild.members.me;
                if (me) {
                    const perms = parentChannel.permissionsFor(me);
                    if (perms && !perms.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
                        logger_1.logger.warn(`Voice auto-create: bot lacks ManageChannels in category ${parentChannel.name} (${parentId}) for guild ${guild.name}`);
                        return false;
                    }
                }
            }
        }
        const nameTemplate = (0, shared_types_1.decodeHtmlEntities)(voiceSettings.channelNameTemplate ?? "🔊 {nickname}'s Channel");
        const game = member.presence?.activities?.find(a => a.type === 0)?.name ?? '';
        const channelCount = dynamicChannels.size + 1;
        const channelName = nameTemplate
            .replaceAll('{user}', member.user.username)
            .replaceAll('{nickname}', member.displayName)
            .replaceAll('{game}', game || 'General')
            .replaceAll('{count}', String(channelCount));
        const inheritedOverwrites = [];
        const sourceChannel = hubChannel ?? (parentId ? guild.channels.cache.get(parentId) : undefined);
        if (sourceChannel && 'permissionOverwrites' in sourceChannel) {
            for (const [, overwrite] of sourceChannel.permissionOverwrites.cache) {
                inheritedOverwrites.push({
                    id: overwrite.id,
                    type: overwrite.type,
                    allow: overwrite.allow,
                    deny: overwrite.deny,
                });
            }
        }
        const tempChannel = await guild.channels.create({
            name: channelName,
            type: discord_js_1.ChannelType.GuildVoice,
            parent: parentId,
            position: voiceSettings.channelPosition === 'top' ? 0 : undefined,
            userLimit: voiceSettings.defaultUserLimit ?? undefined,
            bitrate: voiceSettings.bitrate ?? undefined,
            permissionOverwrites: [
                ...inheritedOverwrites,
                {
                    id: member.id,
                    allow: [
                        discord_js_1.PermissionFlagsBits.Connect,
                        discord_js_1.PermissionFlagsBits.Speak,
                        discord_js_1.PermissionFlagsBits.Stream,
                        discord_js_1.PermissionFlagsBits.ManageChannels,
                        discord_js_1.PermissionFlagsBits.MoveMembers,
                        discord_js_1.PermissionFlagsBits.MuteMembers,
                        discord_js_1.PermissionFlagsBits.DeafenMembers,
                    ],
                },
            ],
            reason: 'Auto-created via join-to-create hub',
        });
        dynamicChannels.set(tempChannel.id, Date.now());
        channelOwners.set(tempChannel.id, member.id);
        voiceChannelService.createChannel(channelName, guild.id, tempChannel.id, member.id, types_1.VoiceChannelType.DYNAMIC);
        try {
            await member.voice.setChannel(tempChannel, 'Moved from hub to auto-created channel');
        }
        catch (moveError) {
            logger_1.logger.warn(`Failed to move ${member.id} to auto-created channel, cleaning up:`, moveError);
            dynamicChannels.delete(tempChannel.id);
            channelOwners.delete(tempChannel.id);
            voiceChannelService.deleteByDiscordId(tempChannel.id);
            await tempChannel.delete('User disconnected before move').catch(() => { });
            return false;
        }
        if (voiceSettings.interfaceMessageEnabled !== false) {
            try {
                await postVoiceInterfaceMessage(tempChannel, channelName, member.displayName);
            }
            catch (embedError) {
                logger_1.logger.warn(`Failed to post voice interface message in ${tempChannel.id}:`, embedError);
            }
        }
        logger_1.logger.info(`🎤 Auto-created voice channel "${channelName}" for ${member.displayName} in guild ${guild.name} (parent=${parentId ?? 'root'})`);
        return true;
    }
    catch (error) {
        logger_1.logger.error(`Failed to auto-create voice channel in guild ${guild.name} (${guild.id}):`, error);
        return false;
    }
    finally {
        pendingCreations.delete(reservationKey);
    }
}
async function handleHubJoin(client, newState, voiceSettings) {
    const hubChannelId = voiceSettings.hubChannelId;
    const hubChannelIds = voiceSettings.hubChannelIds ?? [];
    const allHubs = new Set();
    if (hubChannelId) {
        allHubs.add(hubChannelId);
    }
    for (const id of hubChannelIds) {
        if (id) {
            allHubs.add(id);
        }
    }
    if (allHubs.size === 0 || !newState.channelId || !allHubs.has(newState.channelId)) {
        if (allHubs.size === 0 && newState.channelId) {
            logger_1.logger.warn(`Voice auto-create: no hub channel configured for guild ${newState.guild.id} — set a hub channel in Discord Settings`);
        }
        else if (allHubs.size > 0 && newState.channelId) {
            logger_1.logger.debug(`Voice auto-create: channel ${newState.channelId} is not a hub (hubs: ${[...allHubs].join(', ')})`);
        }
        return;
    }
    const member = newState.member;
    if (!member) {
        logger_1.logger.warn(`Voice auto-create: member is null for voice state in guild ${newState.guild.id}`);
        return;
    }
    logger_1.logger.info(`Voice auto-create: hub join detected — creating temp channel for ${member.displayName} in ${newState.guild.name}`);
    await createTempChannelForMember(newState.guild, member, newState.channel, voiceSettings);
}
async function transferOwnership(channel, departingUserId) {
    const newOwner = channel.members.first();
    if (!newOwner) {
        return;
    }
    channelOwners.set(channel.id, newOwner.id);
    try {
        await channel.permissionOverwrites.edit(newOwner.id, {
            Connect: true,
            Speak: true,
            Stream: true,
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            DeafenMembers: true,
        });
        await channel.permissionOverwrites.delete(departingUserId, 'Ownership transferred — creator left');
    }
    catch (permError) {
        logger_1.logger.warn(`Failed to transfer voice channel permissions in ${channel.id}:`, permError);
    }
    logger_1.logger.info(`👑 Voice channel ownership transferred: ${channel.name} → ${newOwner.displayName}`);
}
function scheduleDeletion(guild, channelId, delaySeconds) {
    const existingTimer = deletionTimers.get(channelId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }
    const delayMs = Math.max(0, delaySeconds) * 1000;
    const timer = setTimeout(async () => {
        try {
            const ch = guild.channels.cache.get(channelId);
            if (!ch?.isVoiceBased()) {
                dynamicChannels.delete(channelId);
                channelOwners.delete(channelId);
                deletionTimers.delete(channelId);
                return;
            }
            if (ch.members.size > 0) {
                deletionTimers.delete(channelId);
                return;
            }
            await ch.delete('Auto-deleted empty dynamic voice channel');
            logger_1.logger.info(`🗑️ Auto-deleted empty voice channel: ${ch.name} in guild ${guild.name}`);
            dynamicChannels.delete(channelId);
            channelOwners.delete(channelId);
            deletionTimers.delete(channelId);
        }
        catch (error) {
            logger_1.logger.error(`Failed to auto-delete channel ${channelId}:`, error);
            deletionTimers.delete(channelId);
        }
    }, delayMs);
    deletionTimers.set(channelId, timer);
    logger_1.logger.debug(`Scheduled auto-delete of channel ${channelId} in ${delaySeconds}s`);
}
async function handleAutoDelete(client, oldState, voiceSettings) {
    const channelId = oldState.channelId;
    if (!channelId) {
        return;
    }
    if (!dynamicChannels.has(channelId)) {
        return;
    }
    const guild = oldState.guild;
    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel?.isVoiceBased()) {
            dynamicChannels.delete(channelId);
            channelOwners.delete(channelId);
            return;
        }
        const isOwnerLeaving = voiceSettings.ownershipTransferEnabled !== false &&
            channel.members.size > 0 &&
            oldState.member &&
            channelOwners.get(channelId) === oldState.member.id;
        if (isOwnerLeaving && oldState.member) {
            await transferOwnership(channel, oldState.member.id);
        }
        if (!voiceSettings.autoDeleteEmptyChannels) {
            return;
        }
        if (channel.members.size > 0) {
            const existingTimer = deletionTimers.get(channelId);
            if (existingTimer) {
                clearTimeout(existingTimer);
                deletionTimers.delete(channelId);
            }
            return;
        }
        const delayMinutes = voiceSettings.deleteEmptyChannelDelayMinutes;
        const fallbackSeconds = delayMinutes !== null && delayMinutes !== undefined ? delayMinutes * 60 : 10;
        const delaySeconds = voiceSettings.deleteEmptyChannelDelaySeconds ?? fallbackSeconds;
        logger_1.logger.debug(`Voice auto-delete: channel ${channelId} empty — deleting in ${delaySeconds}s ` +
            `(seconds=${voiceSettings.deleteEmptyChannelDelaySeconds}, minutes=${delayMinutes})`);
        scheduleDeletion(guild, channelId, delaySeconds);
    }
    catch (error) {
        logger_1.logger.error('Error in handleAutoDelete:', error);
    }
}
async function handleEventVoiceEmpty(client, oldState, newState) {
    const channelId = oldState.channelId;
    if (!channelId) {
        return;
    }
    if (channelId === newState.channelId) {
        return;
    }
    const vcRecord = voiceChannelService.getChannelByDiscordId(channelId);
    if (vcRecord?.type !== types_1.VoiceChannelType.EVENT) {
        return;
    }
    const guild = oldState.guild;
    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel?.isVoiceBased()) {
            voiceChannelService.deleteByDiscordId(channelId);
            channelOwners.delete(channelId);
            return;
        }
        if (channel.members.size > 0) {
            const existingTimer = deletionTimers.get(channelId);
            if (existingTimer) {
                clearTimeout(existingTimer);
                deletionTimers.delete(channelId);
            }
            return;
        }
        const now = new Date();
        let eventStartDate;
        let eventEndDate;
        try {
            const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../../config/database')));
            if (AppDataSource.isInitialized) {
                const { Activity } = await Promise.resolve().then(() => __importStar(require('../../models/Activity')));
                const activity = await AppDataSource.getRepository(Activity).findOne({
                    where: { id: vcRecord.eventId },
                    select: ['id', 'scheduledStartDate', 'estimatedDuration'],
                });
                if (activity?.scheduledStartDate) {
                    eventStartDate = new Date(activity.scheduledStartDate);
                    const durationMs = (activity.estimatedDuration ?? 120) * 60 * 1000;
                    eventEndDate = new Date(eventStartDate.getTime() + durationMs);
                }
            }
        }
        catch {
        }
        if (!eventEndDate && vcRecord.expiresAt) {
            eventEndDate = new Date(vcRecord.expiresAt);
        }
        let delaySeconds;
        if (eventEndDate && now >= eventEndDate) {
            delaySeconds = 0;
            logger_1.logger.info(`🎮 Event VC "${channel.name}" is empty after event end — deleting immediately`);
        }
        else if (eventStartDate && now >= eventStartDate) {
            delaySeconds = 30 * 60;
            logger_1.logger.info(`🎮 Event VC "${channel.name}" is empty during event — scheduling deletion in 30 minutes`);
        }
        else {
            logger_1.logger.debug(`🎮 Event VC "${channel.name}" is empty before event start — keeping channel`);
            return;
        }
        const existingTimer = deletionTimers.get(channelId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const delayMs = delaySeconds * 1000;
        const timer = setTimeout(async () => {
            try {
                const ch = guild.channels.cache.get(channelId);
                if (!ch?.isVoiceBased()) {
                    voiceChannelService.deleteByDiscordId(channelId);
                    channelOwners.delete(channelId);
                    deletionTimers.delete(channelId);
                    return;
                }
                if (ch.members.size > 0) {
                    deletionTimers.delete(channelId);
                    return;
                }
                await ch.delete('Event voice channel — empty after event');
                logger_1.logger.info(`🗑️ Auto-deleted event voice channel: ${ch.name} in guild ${guild.name}`);
                voiceChannelService.deleteByDiscordId(channelId);
                channelOwners.delete(channelId);
                deletionTimers.delete(channelId);
            }
            catch (error) {
                logger_1.logger.error(`Failed to auto-delete event channel ${channelId}:`, error);
                deletionTimers.delete(channelId);
            }
        }, delayMs);
        deletionTimers.set(channelId, timer);
    }
    catch (error) {
        logger_1.logger.error('Error in handleEventVoiceEmpty:', error);
    }
}
async function handleVoiceAutoCreate(client, oldState, newState) {
    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) {
        return;
    }
    const voiceSettings = await getVoiceSettings(guildId);
    if (!voiceSettings) {
        return;
    }
    if (!voiceSettings.autoCreateChannels) {
        return;
    }
    if (newState.channelId && newState.channelId !== oldState.channelId) {
        logger_1.logger.info(`Voice auto-create: user ${newState.member?.displayName ?? newState.id} joined channel ${newState.channelId}, hub(s)=${voiceSettings.hubChannelId ?? 'none'}/${JSON.stringify(voiceSettings.hubChannelIds ?? [])}`);
        const pendingTimer = deletionTimers.get(newState.channelId);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            deletionTimers.delete(newState.channelId);
            logger_1.logger.debug(`Cancelled pending deletion for channel ${newState.channelId} — user joined`);
        }
        await handleHubJoin(client, newState, voiceSettings);
        await (0, lfgLobbyHandler_1.handleLfgLobbyJoin)(client, newState, voiceSettings);
    }
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
        await handleAutoDelete(client, oldState, voiceSettings);
    }
}
function getDynamicChannels() {
    return dynamicChannels;
}
function getChannelOwners() {
    return channelOwners;
}
function getChannelOwner(channelId) {
    return channelOwners.get(channelId);
}
function setChannelOwner(channelId, userId) {
    channelOwners.set(channelId, userId);
}
function reconcileDynamicChannels(guildIds) {
    let recovered = 0;
    for (const guildId of guildIds) {
        const guildChannels = voiceChannelService.getGuildChannels(guildId);
        for (const vc of guildChannels) {
            if (vc.type === types_1.VoiceChannelType.DYNAMIC && !dynamicChannels.has(vc.channelId)) {
                dynamicChannels.set(vc.channelId, vc.createdAt.getTime());
                recovered++;
            }
        }
    }
    if (recovered > 0) {
        logger_1.logger.info(`🎤 Reconciled ${recovered} dynamic voice channel(s) from VoiceChannelService`);
    }
    return recovered;
}
function clearDeletionTimers() {
    for (const [channelId, timer] of deletionTimers) {
        clearTimeout(timer);
        deletionTimers.delete(channelId);
    }
}
async function bootstrapHubMembers(guild, voiceSettings) {
    const allHubs = new Set();
    if (voiceSettings.hubChannelId) {
        allHubs.add(voiceSettings.hubChannelId);
    }
    for (const id of voiceSettings.hubChannelIds ?? []) {
        if (id) {
            allHubs.add(id);
        }
    }
    if (allHubs.size === 0) {
        return 0;
    }
    let created = 0;
    for (const hubId of allHubs) {
        const channel = guild.channels.cache.get(hubId);
        if (!channel?.isVoiceBased()) {
            continue;
        }
        for (const [, member] of channel.members) {
            const success = await createTempChannelForMember(guild, member, channel, voiceSettings);
            if (success) {
                created++;
            }
        }
    }
    if (created > 0) {
        logger_1.logger.info(`🎤 Bootstrap: created ${created} channel(s) for existing hub members in guild ${guild.name}`);
    }
    return created;
}
//# sourceMappingURL=voiceAutoCreate.js.map