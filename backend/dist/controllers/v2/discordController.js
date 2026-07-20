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
exports.DiscordControllerV2 = void 0;
const BotClientManager_1 = require("../../bot/BotClientManager");
const DiscordService_1 = require("../../services/discord/DiscordService");
const api_1 = require("../../types/api");
const ApiError_1 = require("../../utils/ApiError");
const joiValidators_1 = require("../../utils/joiValidators");
const logger_1 = require("../../utils/logger");
class DiscordControllerV2 {
    async getUserRoles(req, res) {
        try {
            const { guildId, userId } = req.params;
            const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
            const userIdValidation = joiValidators_1.discordIdSchema.validate(userId);
            if (guildIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
            }
            if (userIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid user ID format', 400);
            }
            const discordService = (0, DiscordService_1.getDiscordService)();
            const roles = await discordService.getUserRoles(guildId, userId);
            res.success({ roles });
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Failed to fetch Discord roles';
            logger_1.logger.error('Failed to fetch Discord roles', {
                error: message,
                guildId: req.params.guildId,
                userId: req.params.userId,
            });
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async assignRole(req, res) {
        try {
            const { guildId, userId } = req.params;
            const { roleId } = req.body;
            const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
            const userIdValidation = joiValidators_1.discordIdSchema.validate(userId);
            const roleIdValidation = joiValidators_1.discordIdSchema.validate(roleId);
            if (guildIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
            }
            if (userIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid user ID format', 400);
            }
            if (roleIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid role ID format', 400);
            }
            const discordService = (0, DiscordService_1.getDiscordService)();
            const message = await discordService.assignRole(guildId, userId, roleId);
            res.success({ message, roleId, userId, guildId });
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Failed to assign Discord role';
            logger_1.logger.error('Failed to assign Discord role', {
                error: message,
                guildId: req.params.guildId,
                userId: req.params.userId,
            });
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async removeRole(req, res) {
        try {
            const { guildId, userId } = req.params;
            const { roleId } = req.body;
            const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
            const userIdValidation = joiValidators_1.discordIdSchema.validate(userId);
            const roleIdValidation = joiValidators_1.discordIdSchema.validate(roleId);
            if (guildIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
            }
            if (userIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid user ID format', 400);
            }
            if (roleIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid role ID format', 400);
            }
            const discordService = (0, DiscordService_1.getDiscordService)();
            const message = await discordService.removeRole(guildId, userId, roleId);
            res.success({ message, roleId, userId, guildId });
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Failed to remove Discord role';
            logger_1.logger.error('Failed to remove Discord role', {
                error: message,
                guildId: req.params.guildId,
                userId: req.params.userId,
            });
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async getGuildRoles(req, res) {
        try {
            const { guildId } = req.params;
            const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
            if (guildIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
            }
            const discordService = (0, DiscordService_1.getDiscordService)();
            const roles = await discordService.getGuildRoles(guildId);
            res.success({ roles });
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Failed to fetch guild roles';
            logger_1.logger.error('Failed to fetch guild roles', { error: message, guildId: req.params.guildId });
            const status = message.includes('not connected') ? 503 : 500;
            throw new ApiError_1.ApiError(status === 503 ? api_1.ApiErrorCode.SERVICE_UNAVAILABLE : api_1.ApiErrorCode.INTERNAL_ERROR, message, status);
        }
    }
    async getGuildInfo(req, res) {
        try {
            const { guildId } = req.params;
            const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
            if (guildIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
            }
            const discordService = (0, DiscordService_1.getDiscordService)();
            const discordServiceRecord = discordService;
            const getGuildInfoFn = discordServiceRecord.getGuildInfo;
            const getGuildFn = discordServiceRecord.getGuild;
            const guildInfo = (await getGuildInfoFn?.(guildId)) ||
                (await getGuildFn?.(guildId)) || { id: guildId, name: 'Unknown Guild' };
            res.success(guildInfo);
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                throw error;
            }
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch guild information', 500);
        }
    }
    async getGuildMembers(req, res) {
        try {
            const { guildId } = req.params;
            const queryParams = req.queryParams || {};
            const { limit = 100, after } = queryParams;
            const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
            if (guildIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
            }
            const discordService = (0, DiscordService_1.getDiscordService)();
            const discordServiceRecord = discordService;
            const getGuildMembersFn = discordServiceRecord.getGuildMembers;
            const fetchGuildMembersFn = discordServiceRecord.fetchGuildMembers;
            const members = (await getGuildMembersFn?.(guildId, { limit: Number(limit), after })) ||
                (await fetchGuildMembersFn?.(guildId, Number(limit))) ||
                [];
            res.success(members);
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                throw error;
            }
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch guild members', 500);
        }
    }
    async checkMyMembership(req, res) {
        try {
            const { guildId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
            if (guildIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
            }
            const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../../data-source')));
            const { User } = await Promise.resolve().then(() => __importStar(require('../../models/User')));
            const userEntity = await AppDataSource.getRepository(User).findOne({
                where: { id: userId },
                select: ['id', 'discordId'],
            });
            if (!userEntity?.discordId) {
                res.json({
                    success: true,
                    data: {
                        isInGuild: false,
                        reason: 'no_discord_linked',
                    },
                });
                return;
            }
            try {
                const client = BotClientManager_1.BotClientManager.getInstance().getClient();
                if (client.isReady()) {
                    const guild = await client.guilds.fetch(guildId);
                    const member = await guild.members.fetch(userEntity.discordId);
                    res.json({
                        success: true,
                        data: {
                            isInGuild: true,
                            displayName: member.displayName,
                            joinedAt: member.joinedAt?.toISOString(),
                            roles: Array.from(member.roles.cache.values())
                                .filter(r => r.id !== guildId)
                                .map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
                        },
                    });
                    return;
                }
            }
            catch {
            }
            try {
                const discordService = (0, DiscordService_1.getDiscordService)();
                const roles = await discordService.getUserRoles(guildId, userEntity.discordId);
                res.json({
                    success: true,
                    data: {
                        isInGuild: true,
                        roles: roles.map(r => ({ id: r.id, name: r.name })),
                    },
                });
                return;
            }
            catch {
            }
            res.json({
                success: true,
                data: {
                    isInGuild: false,
                    reason: 'not_in_guild',
                },
            });
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Failed to check guild membership', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to check guild membership', 500);
        }
    }
    async getGuildChannels(req, res) {
        try {
            const { guildId } = req.params;
            const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
            if (guildIdValidation.error) {
                throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
            }
            const discordService = (0, DiscordService_1.getDiscordService)();
            const channels = await discordService.getGuildChannels(guildId);
            res.success({ channels });
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Failed to fetch guild channels';
            logger_1.logger.error('Failed to fetch guild channels', {
                error: message,
                guildId: req.params.guildId,
            });
            const status = message.includes('not connected') ? 503 : 500;
            throw new ApiError_1.ApiError(status === 503 ? api_1.ApiErrorCode.SERVICE_UNAVAILABLE : api_1.ApiErrorCode.INTERNAL_ERROR, message, status);
        }
    }
}
exports.DiscordControllerV2 = DiscordControllerV2;
//# sourceMappingURL=discordController.js.map