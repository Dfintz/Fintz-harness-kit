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
exports.ROLE_REMOVE_ACTION = exports.ROLE_ASSIGN_ACTION = void 0;
exports.initializeRoleIpcHandler = initializeRoleIpcHandler;
const RsiRoleMutationAuthorizationService_1 = require("../services/external/RsiRoleMutationAuthorizationService");
const logger_1 = require("../utils/logger");
const roleIpcAuth_1 = require("./roleIpcAuth");
exports.ROLE_ASSIGN_ACTION = 'role:assign';
exports.ROLE_REMOVE_ACTION = 'role:remove';
const INVALID_PAYLOAD_ERROR = 'Invalid payload: missing guildId, userId, roleId, organizationId, issuedAt, or signature';
function isValidPayload(data) {
    return (0, roleIpcAuth_1.isSignedRoleIpcPayload)(data);
}
function handledError(message, error) {
    return {
        correlationId: message.correlationId,
        success: false,
        status: 'handled',
        definitive: true,
        error,
    };
}
function notHandledOnThisShard(message, guildId) {
    return {
        correlationId: message.correlationId,
        success: true,
        status: 'not_handled',
        definitive: false,
        data: { reason: 'guild_not_cached', guildId },
    };
}
function isRoleMutationGuardResult(value) {
    return !('success' in value);
}
async function runRoleMutationGuards(message, client) {
    if (!isValidPayload(message.data)) {
        return handledError(message, INVALID_PAYLOAD_ERROR);
    }
    const payload = message.data;
    const { guildId, userId, roleId } = payload;
    const signatureCheck = (0, roleIpcAuth_1.verifySignedRoleIpcPayload)(message.action, payload);
    if (!signatureCheck.valid) {
        return handledError(message, signatureCheck.reason ?? 'Invalid IPC signature');
    }
    if (!client.guilds.cache.has(guildId)) {
        return notHandledOnThisShard(message, guildId);
    }
    const authorizationError = await RsiRoleMutationAuthorizationService_1.rsiRoleMutationAuthorizationService.validateRoleMutation({
        organizationId: payload.organizationId,
        guildId,
        roleId,
        discordUserId: userId,
    });
    if (authorizationError) {
        return handledError(message, authorizationError);
    }
    const replayCheck = (0, roleIpcAuth_1.consumeRoleIpcReplayToken)(message.action, payload);
    if (!replayCheck.valid) {
        return handledError(message, replayCheck.reason ?? 'IPC message replay detected');
    }
    return {
        guildId,
        userId,
        roleId,
    };
}
async function handleRoleMutation(message, client, operation) {
    const guardResult = await runRoleMutationGuards(message, client);
    if (!isRoleMutationGuardResult(guardResult)) {
        return guardResult;
    }
    const { guildId, userId, roleId } = guardResult;
    try {
        const { getDiscordService } = await Promise.resolve().then(() => __importStar(require('../services/discord/DiscordService')));
        const discordService = getDiscordService();
        const result = operation === 'assign'
            ? await discordService.assignRole(guildId, userId, roleId)
            : await discordService.removeRole(guildId, userId, roleId);
        return {
            correlationId: message.correlationId,
            success: true,
            status: 'handled',
            definitive: true,
            data: { message: result },
        };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error(`RoleIPC: Failed to ${operation} role ${roleId} ${operation === 'assign' ? 'to' : 'from'} ${userId} in ${guildId}:`, error);
        return handledError(message, errorMsg);
    }
}
function initializeRoleIpcHandler(ipcService, _client) {
    if (!ipcService.isAvailable()) {
        logger_1.logger.debug('RoleIPC: IPC not available, handlers not registered');
        return;
    }
    if (!(0, roleIpcAuth_1.isRoleIpcSigningSecretConfigured)()) {
        logger_1.logger.error('RoleIPC: signing secret (BOT_IPC_ROLE_SIGNING_SECRET / INTERNAL_SERVICE_SECRET) is not configured — all role:assign/role:remove requests will be rejected');
    }
    ipcService.registerHandler(exports.ROLE_ASSIGN_ACTION, async (message) => handleRoleMutation(message, _client, 'assign'));
    ipcService.registerHandler(exports.ROLE_REMOVE_ACTION, async (message) => handleRoleMutation(message, _client, 'remove'));
    logger_1.logger.info('RoleIPC: role:assign and role:remove handlers registered');
}
//# sourceMappingURL=roleIpcHandler.js.map