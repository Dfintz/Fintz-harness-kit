"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationCommandService = exports.VALID_COMMAND_TYPES = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const websocketServer_1 = require("../../websocket/websocketServer");
const NotificationRouter_1 = require("../communication/notifications/NotificationRouter");
const ActivityAuditLogger_1 = require("./ActivityAuditLogger");
const CHAIN_KEY = (activityId) => `op_chain:${activityId}`;
const CMD_KEY = (cmdId) => `op_cmd:${cmdId}`;
const CMD_LIST_KEY = (activityId) => `op_cmds:${activityId}`;
const CHAIN_TTL = 86400;
const CMD_TTL = 3600;
exports.VALID_COMMAND_TYPES = [
    'order',
    'preflight_check',
    'move_to',
    'hold_position',
    'engage',
    'disengage',
    'rally',
    'refuel',
    'form_up',
    'weapons_free',
    'weapons_hold',
    'custom',
];
class OperationCommandService {
    activityRepo = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
    notificationRouter = new NotificationRouter_1.NotificationRouter();
    async setCommandChain(activityId, organizationId, userId, userName, fleetCommanders, squadronLeaders) {
        const activity = await this.loadAndVerifyActivity(activityId, organizationId);
        if (activity.creatorId !== userId) {
            throw new apiErrors_1.ForbiddenError('Only the operation creator can configure the chain of command');
        }
        const participantIds = await this.getAcceptedParticipantIds(activityId);
        for (const fc of fleetCommanders) {
            if (!participantIds.has(fc.userId)) {
                throw new apiErrors_1.ValidationError(`Fleet commander ${fc.userName} is not an accepted participant`);
            }
        }
        for (const sl of squadronLeaders) {
            if (!participantIds.has(sl.userId)) {
                throw new apiErrors_1.ValidationError(`Squadron leader ${sl.userName} is not an accepted participant`);
            }
            if (!fleetCommanders.some(fc => fc.userId === sl.reportsToUserId)) {
                throw new apiErrors_1.ValidationError(`Squadron leader ${sl.userName} reports to unknown fleet commander`);
            }
        }
        const nodes = {};
        nodes[userId] = {
            userId,
            userName,
            rank: 'ops_commander',
            subordinateIds: fleetCommanders.map(fc => fc.userId),
        };
        for (const fc of fleetCommanders) {
            const fcSubordinates = squadronLeaders
                .filter(sl => sl.reportsToUserId === fc.userId)
                .map(sl => sl.userId);
            nodes[fc.userId] = {
                userId: fc.userId,
                userName: fc.userName,
                rank: 'fleet_commander',
                fleetId: fc.fleetId,
                fleetName: fc.fleetName,
                subordinateIds: fcSubordinates,
                superiorId: userId,
            };
        }
        for (const sl of squadronLeaders) {
            nodes[sl.userId] = {
                userId: sl.userId,
                userName: sl.userName,
                rank: 'squadron_leader',
                squadronName: sl.squadronName,
                subordinateIds: [],
                superiorId: sl.reportsToUserId,
            };
        }
        const assignedIds = new Set(Object.keys(nodes));
        for (const pId of participantIds) {
            if (!assignedIds.has(pId)) {
                nodes[pId] = {
                    userId: pId,
                    userName: '',
                    rank: 'member',
                    subordinateIds: [],
                };
            }
        }
        const chain = {
            activityId,
            organizationId,
            commanderId: userId,
            commanderName: userName,
            nodes,
            updatedAt: new Date().toISOString(),
        };
        await redis_1.redisClient.set(CHAIN_KEY(activityId), chain, CHAIN_TTL);
        const commandStructureJson = {
            commander: userName,
            commanderId: userId,
            squadLeaders: squadronLeaders.map(sl => ({
                userId: sl.userId,
                userName: sl.userName,
                squadName: sl.squadronName,
            })),
            chainOfCommand: [
                userId,
                ...fleetCommanders.map(fc => fc.userId),
                ...squadronLeaders.map(sl => sl.userId),
            ],
        };
        await data_source_1.AppDataSource.createQueryBuilder()
            .update(Activity_1.Activity)
            .set({
            metadata: () => `jsonb_set(COALESCE(metadata, '{}'), '{commandStructure}', :cmdStructure::jsonb)`,
        })
            .where('id = :activityId', { activityId })
            .setParameter('cmdStructure', JSON.stringify(commandStructureJson))
            .execute();
        (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:command_chain_set', {
            type: 'activity:command_chain_set',
            activityId,
            organizationId,
            data: { chain },
            timestamp: Date.now(),
            userId,
        });
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_UPDATED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId,
            performedById: userId,
            performedByName: userName,
            details: {
                action: 'command_chain_set',
                fleetCommanderCount: fleetCommanders.length,
                squadronLeaderCount: squadronLeaders.length,
            },
        });
        logger_1.logger.info(`Command chain set for activity ${activityId} by ${userName}`);
        return chain;
    }
    async getCommandChain(activityId) {
        return redis_1.redisClient.get(CHAIN_KEY(activityId));
    }
    async issueCommand(activityId, organizationId, issuer, type, message, targetScope, options) {
        const { userId, userName } = issuer;
        const priority = options?.priority ?? 'routine';
        const payload = options?.payload;
        const chain = await redis_1.redisClient.get(CHAIN_KEY(activityId));
        if (!chain) {
            throw new apiErrors_1.NotFoundError('No command chain configured for this operation');
        }
        const issuerNode = chain.nodes[userId];
        if (!issuerNode) {
            throw new apiErrors_1.ForbiddenError('You are not in the command chain for this operation');
        }
        if (issuerNode.rank === 'member') {
            throw new apiErrors_1.ForbiddenError('Members cannot issue commands. Only commanders and leaders can.');
        }
        const resolvedRecipientIds = this.resolveRecipients(chain, userId, targetScope);
        if (resolvedRecipientIds.length === 0) {
            throw new apiErrors_1.ValidationError('No recipients found for this command scope');
        }
        const commandId = node_crypto_1.default.randomUUID();
        const command = {
            id: commandId,
            activityId,
            organizationId,
            type,
            priority,
            issuedBy: userId,
            issuedByName: userName,
            issuedByRank: issuerNode.rank,
            targetScope: { ...targetScope, resolvedRecipientIds },
            message,
            payload,
            issuedAt: new Date().toISOString(),
            status: 'issued',
            acknowledgements: [],
        };
        await redis_1.redisClient.set(CMD_KEY(commandId), command, CMD_TTL);
        const cmdList = (await redis_1.redisClient.get(CMD_LIST_KEY(activityId))) ?? [];
        cmdList.push(commandId);
        await redis_1.redisClient.set(CMD_LIST_KEY(activityId), cmdList, CHAIN_TTL);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'activity:command_issued', {
            type: 'activity:command_issued',
            activityId,
            organizationId,
            data: {
                id: command.id,
                type: command.type,
                priority: command.priority,
                message: command.message,
                issuedByName: command.issuedByName,
                issuedByRank: command.issuedByRank,
                issuedAt: command.issuedAt,
                recipientIds: resolvedRecipientIds,
                payload: command.payload,
            },
            timestamp: Date.now(),
            userId,
        });
        logger_1.logger.info(`Command ${commandId} (${type}) issued by ${userName} for activity ${activityId} — ${resolvedRecipientIds.length} recipients`);
        const notifContext = type === 'preflight_check'
            ? NotificationRouter_1.NotificationContext.PREFLIGHT_CHECK
            : NotificationRouter_1.NotificationContext.COMMAND_RECEIVED;
        const priorityLabels = { critical: 'CRITICAL', urgent: 'URGENT' };
        const priorityLabel = priorityLabels[priority] ?? '';
        const titlePrefix = priorityLabel ? `[${priorityLabel}] ` : '';
        for (const recipientId of resolvedRecipientIds) {
            this.notificationRouter
                .notifyUser({
                context: notifContext,
                userId: recipientId,
                title: `${titlePrefix}Command: ${type.replaceAll('_', ' ')}`,
                message: `${userName}: ${message}`,
                actionUrl: `/activities/${activityId}`,
                metadata: { activityId, commandId, type, priority },
            })
                .catch(() => {
            });
        }
        return command;
    }
    async acknowledgeCommand(commandId, userId, userName, response) {
        const command = await redis_1.redisClient.get(CMD_KEY(commandId));
        if (!command) {
            throw new apiErrors_1.NotFoundError('Command not found or expired');
        }
        if (!command.targetScope.resolvedRecipientIds.includes(userId)) {
            throw new apiErrors_1.ForbiddenError('You are not a recipient of this command');
        }
        if (command.acknowledgements.some(a => a.userId === userId)) {
            throw new apiErrors_1.ConflictError('You have already acknowledged this command');
        }
        command.acknowledgements.push({
            userId,
            userName,
            acknowledgedAt: new Date().toISOString(),
            response,
        });
        if (command.acknowledgements.length === command.targetScope.resolvedRecipientIds.length) {
            command.status = 'acknowledged';
            command.acknowledgedAt = new Date().toISOString();
        }
        await redis_1.redisClient.set(CMD_KEY(commandId), command, CMD_TTL);
        (0, websocketServer_1.emitToOrganization)(command.organizationId, 'activity:command_acknowledged', {
            type: 'activity:command_acknowledged',
            activityId: command.activityId,
            organizationId: command.organizationId,
            data: {
                commandId,
                acknowledgedBy: userName,
                acknowledgedByUserId: userId,
                totalRecipients: command.targetScope.resolvedRecipientIds.length,
                acknowledgedCount: command.acknowledgements.length,
                allAcknowledged: command.status === 'acknowledged',
                response,
            },
            timestamp: Date.now(),
            userId,
        });
        return command;
    }
    async getCommands(activityId) {
        const cmdList = await redis_1.redisClient.get(CMD_LIST_KEY(activityId));
        if (!cmdList || cmdList.length === 0) {
            return [];
        }
        const commands = [];
        for (const cmdId of cmdList) {
            const cmd = await redis_1.redisClient.get(CMD_KEY(cmdId));
            if (cmd) {
                commands.push(cmd);
            }
        }
        return commands.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    }
    async getCommand(commandId) {
        return redis_1.redisClient.get(CMD_KEY(commandId));
    }
    async issuePreflightCheck(activityId, organizationId, userId, userName) {
        return this.issueCommand(activityId, organizationId, { userId, userName }, 'preflight_check', 'All stations: Pre-flight check. Report status.', { type: 'all' }, { priority: 'urgent' });
    }
    async loadAndVerifyActivity(activityId, organizationId) {
        const activity = await this.activityRepo.findOne({
            where: { id: activityId, organizationId },
        });
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity not found');
        }
        const validStatuses = [
            Activity_1.ActivityStatus.OPEN,
            Activity_1.ActivityStatus.PLANNING,
            Activity_1.ActivityStatus.RECRUITING,
            Activity_1.ActivityStatus.READY,
            Activity_1.ActivityStatus.IN_PROGRESS,
        ];
        if (!validStatuses.includes(activity.status)) {
            throw new apiErrors_1.ValidationError(`Cannot manage commands for activity in ${activity.status} status`);
        }
        return activity;
    }
    async getAcceptedParticipantIds(activityId) {
        const participants = await this.participantRepo.find({
            where: { activityId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
            select: ['userId'],
        });
        return new Set(participants.map(p => p.userId));
    }
    resolveRecipients(chain, issuerId, scope) {
        const allSubordinates = this.getAllSubordinates(chain, issuerId);
        switch (scope.type) {
            case 'all':
                return allSubordinates;
            case 'fleet': {
                if (!scope.fleetId) {
                    return allSubordinates;
                }
                const fcNode = Object.values(chain.nodes).find(n => n.rank === 'fleet_commander' && n.fleetId === scope.fleetId);
                if (!fcNode) {
                    return [];
                }
                return [fcNode.userId, ...this.getAllSubordinates(chain, fcNode.userId)];
            }
            case 'squadron': {
                if (!scope.squadronName) {
                    return allSubordinates;
                }
                const slNode = Object.values(chain.nodes).find(n => n.rank === 'squadron_leader' && n.squadronName === scope.squadronName);
                if (!slNode) {
                    return [];
                }
                return [slNode.userId, ...this.getAllSubordinates(chain, slNode.userId)];
            }
            case 'individual':
                return (scope.userIds ?? []).filter(uid => allSubordinates.includes(uid));
            default:
                return allSubordinates;
        }
    }
    getAllSubordinates(chain, userId) {
        const node = chain.nodes[userId];
        if (!node) {
            return [];
        }
        const result = [];
        for (const subId of node.subordinateIds) {
            result.push(subId, ...this.getAllSubordinates(chain, subId));
        }
        return result;
    }
}
exports.OperationCommandService = OperationCommandService;
//# sourceMappingURL=OperationCommandService.js.map