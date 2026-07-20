"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRsiStatusIpcHandler = initializeRsiStatusIpcHandler;
const logger_1 = require("../utils/logger");
const rsistatus_1 = require("./commands/rsistatus");
const rsiStatusChannels_1 = require("./commands/rsiStatusChannels");
const rsiStatusIpc_1 = require("./rsiStatusIpc");
function getGuildId(data) {
    return typeof data.guildId === 'string' && data.guildId.length > 0 ? data.guildId : null;
}
function isStatusRole(value) {
    return value === 'application' || value === 'server';
}
function success(correlationId, data) {
    return {
        correlationId,
        success: true,
        status: 'handled',
        definitive: true,
        data,
    };
}
function failure(correlationId, error) {
    return {
        correlationId,
        success: false,
        status: 'handled',
        definitive: true,
        error,
    };
}
function asErrorMessage(error) {
    return error instanceof Error ? error.message : 'Unknown error';
}
async function handleGetPanel(message) {
    const guildId = getGuildId(message.data);
    if (!guildId) {
        return failure(message.correlationId, 'Invalid payload: guildId is required');
    }
    const panel = await (0, rsistatus_1.getRsiStatusPanelForGuild)(guildId);
    return success(message.correlationId, { panel });
}
async function handleDeployPanel(message) {
    const guildId = getGuildId(message.data);
    const channelId = typeof message.data.channelId === 'string' && message.data.channelId.length > 0
        ? message.data.channelId
        : null;
    if (!guildId || !channelId) {
        return failure(message.correlationId, 'Invalid payload: guildId and channelId are required');
    }
    const panel = await (0, rsistatus_1.deployRsiStatusPanelForGuild)(guildId, channelId);
    return success(message.correlationId, { panel });
}
async function handleRemovePanel(message) {
    const guildId = getGuildId(message.data);
    if (!guildId) {
        return failure(message.correlationId, 'Invalid payload: guildId is required');
    }
    const removed = await (0, rsistatus_1.removeRsiStatusPanelForGuild)(guildId);
    return success(message.correlationId, { removed });
}
async function handleGetChannels(message) {
    const guildId = getGuildId(message.data);
    if (!guildId) {
        return failure(message.correlationId, 'Invalid payload: guildId is required');
    }
    const channels = await (0, rsiStatusChannels_1.getStatusChannelsForGuild)(guildId);
    return success(message.correlationId, { channels });
}
async function handleCreateManagedChannels(message) {
    const guildId = getGuildId(message.data);
    if (!guildId) {
        return failure(message.correlationId, 'Invalid payload: guildId is required');
    }
    await (0, rsiStatusChannels_1.createManagedStatusChannelsForGuild)(guildId);
    return success(message.correlationId, { ok: true });
}
async function handleAssignChannel(message) {
    const payload = message.data;
    const guildId = typeof payload.guildId === 'string' ? payload.guildId : null;
    const role = payload.role;
    const channelId = typeof payload.channelId === 'string' ? payload.channelId : null;
    if (!guildId || !channelId || !isStatusRole(role)) {
        return failure(message.correlationId, 'Invalid payload: guildId, channelId, and role(application|server) are required');
    }
    await (0, rsiStatusChannels_1.assignStatusChannelForGuild)(guildId, role, channelId);
    return success(message.correlationId, { ok: true });
}
async function handleRemoveChannels(message) {
    const guildId = getGuildId(message.data);
    if (!guildId) {
        return failure(message.correlationId, 'Invalid payload: guildId is required');
    }
    const removed = await (0, rsiStatusChannels_1.removeStatusChannelsForGuild)(guildId);
    return success(message.correlationId, { removed });
}
function registerHandler(ipcService, client, action, handler) {
    ipcService.registerHandler(action, async (message) => {
        const guildId = message.routing?.guildId ?? getGuildId(message.data);
        if (guildId && !client.guilds.cache.has(guildId)) {
            return {
                correlationId: message.correlationId,
                success: true,
                status: 'not_handled',
                definitive: false,
                data: { reason: 'guild_not_cached', guildId },
            };
        }
        try {
            return await handler(message);
        }
        catch (error) {
            const errorMessage = asErrorMessage(error);
            logger_1.logger.error(`RsiStatusIPC: ${action} failed`, {
                error: errorMessage,
            });
            return failure(message.correlationId, errorMessage);
        }
    });
}
function initializeRsiStatusIpcHandler(ipcService, client) {
    if (!ipcService.isAvailable()) {
        logger_1.logger.debug('RsiStatusIPC: IPC not available, handlers not registered');
        return;
    }
    registerHandler(ipcService, client, rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.GET_PANEL, handleGetPanel);
    registerHandler(ipcService, client, rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.DEPLOY_PANEL, handleDeployPanel);
    registerHandler(ipcService, client, rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.REMOVE_PANEL, handleRemovePanel);
    registerHandler(ipcService, client, rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.GET_CHANNELS, handleGetChannels);
    registerHandler(ipcService, client, rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.CREATE_MANAGED_CHANNELS, handleCreateManagedChannels);
    registerHandler(ipcService, client, rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.ASSIGN_CHANNEL, handleAssignChannel);
    registerHandler(ipcService, client, rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.REMOVE_CHANNELS, handleRemoveChannels);
    logger_1.logger.info('RsiStatusIPC: RSI status IPC handlers registered');
}
//# sourceMappingURL=rsiStatusIpcHandler.js.map