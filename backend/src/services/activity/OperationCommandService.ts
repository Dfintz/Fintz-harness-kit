import crypto from 'node:crypto';

import { AppDataSource } from '../../data-source';
import { Activity, ActivityStatus, type CommandStructure } from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';
import { emitToOrganization } from '../../websocket/websocketServer';
import {
  NotificationContext,
  NotificationRouter,
} from '../communication/notifications/NotificationRouter';

import { ActivityAuditAction, activityAuditLogger } from './ActivityAuditLogger';

// ---------------------------------------------------------------------------
// Types (internal Redis state)
// ---------------------------------------------------------------------------

type CommandRank = 'ops_commander' | 'fleet_commander' | 'squadron_leader' | 'member';
type CommandPriority = 'routine' | 'urgent' | 'critical';
type OperationCommandType =
  | 'order'
  | 'preflight_check'
  | 'move_to'
  | 'hold_position'
  | 'engage'
  | 'disengage'
  | 'rally'
  | 'refuel'
  | 'form_up'
  | 'weapons_free'
  | 'weapons_hold'
  | 'custom';

interface CommandChainNode {
  userId: string;
  userName: string;
  rank: CommandRank;
  fleetId?: string;
  fleetName?: string;
  squadronName?: string;
  subordinateIds: string[];
  superiorId?: string;
}

interface OperationCommandChain {
  activityId: string;
  organizationId: string;
  commanderId: string;
  commanderName: string;
  nodes: Record<string, CommandChainNode>;
  updatedAt: string;
}

interface CommandState {
  id: string;
  activityId: string;
  organizationId: string;
  type: OperationCommandType;
  priority: CommandPriority;
  issuedBy: string;
  issuedByName: string;
  issuedByRank: CommandRank;
  targetScope: {
    type: 'all' | 'fleet' | 'squadron' | 'individual';
    fleetId?: string;
    squadronName?: string;
    userIds?: string[];
    resolvedRecipientIds: string[];
  };
  message: string;
  payload?: Record<string, unknown>;
  issuedAt: string;
  acknowledgedAt?: string;
  status: 'issued' | 'acknowledged' | 'completed' | 'cancelled';
  acknowledgements: Array<{
    userId: string;
    userName: string;
    acknowledgedAt: string;
    response?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Redis key patterns
// ---------------------------------------------------------------------------

const CHAIN_KEY = (activityId: string) => `op_chain:${activityId}`;
const CMD_KEY = (cmdId: string) => `op_cmd:${cmdId}`;
const CMD_LIST_KEY = (activityId: string) => `op_cmds:${activityId}`;
const CHAIN_TTL = 86400; // 24 hours
const CMD_TTL = 3600; // 1 hour per command

// ---------------------------------------------------------------------------
// Valid command types for Joi / controller validation
// ---------------------------------------------------------------------------

export const VALID_COMMAND_TYPES: OperationCommandType[] = [
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * OperationCommandService
 *
 * Manages hierarchical chain-of-command for fleet operations.
 * Commands flow downward: Ops Commander → Fleet Commanders → Squadron Leaders → Members.
 *
 * Architecture:
 * - Redis-backed (commands are ephemeral, live-ops only)
 * - WebSocket for real-time command delivery
 * - Voice-command friendly (simple issue/acknowledge API)
 * - Leverages existing Activity participants and CommandStructure
 */
export class OperationCommandService {
  private readonly activityRepo = AppDataSource.getRepository(Activity);
  private readonly participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
  private readonly notificationRouter = new NotificationRouter();

  // =========================================================================
  // Chain of Command Management
  // =========================================================================

  /**
   * Set up the chain of command for an operation.
   * Only the activity creator (ops commander) can configure this.
   */
  async setCommandChain(
    activityId: string,
    organizationId: string,
    userId: string,
    userName: string,
    fleetCommanders: Array<{
      userId: string;
      userName: string;
      fleetId?: string;
      fleetName?: string;
    }>,
    squadronLeaders: Array<{
      userId: string;
      userName: string;
      squadronName: string;
      reportsToUserId: string;
    }>
  ): Promise<OperationCommandChain> {
    const activity = await this.loadAndVerifyActivity(activityId, organizationId);

    // Only the creator sets the chain
    if (activity.creatorId !== userId) {
      throw new ForbiddenError('Only the operation creator can configure the chain of command');
    }

    // Verify all commanders and leaders are participants
    const participantIds = await this.getAcceptedParticipantIds(activityId);

    for (const fc of fleetCommanders) {
      if (!participantIds.has(fc.userId)) {
        throw new ValidationError(`Fleet commander ${fc.userName} is not an accepted participant`);
      }
    }
    for (const sl of squadronLeaders) {
      if (!participantIds.has(sl.userId)) {
        throw new ValidationError(`Squadron leader ${sl.userName} is not an accepted participant`);
      }
      if (!fleetCommanders.some(fc => fc.userId === sl.reportsToUserId)) {
        throw new ValidationError(
          `Squadron leader ${sl.userName} reports to unknown fleet commander`
        );
      }
    }

    // Build chain hierarchy
    const nodes: Record<string, CommandChainNode> = {};

    // Ops commander node
    nodes[userId] = {
      userId,
      userName,
      rank: 'ops_commander',
      subordinateIds: fleetCommanders.map(fc => fc.userId),
    };

    // Fleet commander nodes
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

    // Squadron leader nodes
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

    // All other participants are members under their squadron leader or fleet commander
    const assignedIds = new Set(Object.keys(nodes));
    for (const pId of participantIds) {
      if (!assignedIds.has(pId)) {
        nodes[pId] = {
          userId: pId,
          userName: '', // Will be resolved on read
          rank: 'member',
          subordinateIds: [],
        };
      }
    }

    const chain: OperationCommandChain = {
      activityId,
      organizationId,
      commanderId: userId,
      commanderName: userName,
      nodes,
      updatedAt: new Date().toISOString(),
    };

    await redisClient.set(CHAIN_KEY(activityId), chain, CHAIN_TTL);

    // Persist command structure to Activity metadata for durability
    // Use parameterized query to prevent SQL injection from user-supplied names
    const commandStructureJson: CommandStructure = {
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

    await AppDataSource.createQueryBuilder()
      .update(Activity)
      .set({
        metadata: () =>
          `jsonb_set(COALESCE(metadata, '{}'), '{commandStructure}', :cmdStructure::jsonb)`,
      })
      .where('id = :activityId', { activityId })
      .setParameter('cmdStructure', JSON.stringify(commandStructureJson))
      .execute();

    // Broadcast
    emitToOrganization(organizationId, 'activity:command_chain_set', {
      type: 'activity:command_chain_set',
      activityId,
      organizationId,
      data: { chain },
      timestamp: Date.now(),
      userId,
    });

    activityAuditLogger.log({
      action: ActivityAuditAction.ACTIVITY_UPDATED,
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

    logger.info(`Command chain set for activity ${activityId} by ${userName}`);
    return chain;
  }

  /**
   * Get the current command chain for an activity.
   */
  async getCommandChain(activityId: string): Promise<OperationCommandChain | null> {
    return redisClient.get<OperationCommandChain>(CHAIN_KEY(activityId));
  }

  // =========================================================================
  // Command Issuance & Acknowledgement
  // =========================================================================

  /**
   * Issue a command through the chain of command.
   * Commands flow downward — a user can only command those below them.
   */
  async issueCommand(
    activityId: string,
    organizationId: string,
    issuer: { userId: string; userName: string },
    type: OperationCommandType,
    message: string,
    targetScope: {
      type: 'all' | 'fleet' | 'squadron' | 'individual';
      fleetId?: string;
      squadronName?: string;
      userIds?: string[];
    },
    options?: { priority?: CommandPriority; payload?: Record<string, unknown> }
  ): Promise<CommandState> {
    const { userId, userName } = issuer;
    const priority = options?.priority ?? 'routine';
    const payload = options?.payload;
    const chain = await redisClient.get<OperationCommandChain>(CHAIN_KEY(activityId));
    if (!chain) {
      throw new NotFoundError('No command chain configured for this operation');
    }

    const issuerNode = chain.nodes[userId];
    if (!issuerNode) {
      throw new ForbiddenError('You are not in the command chain for this operation');
    }

    // Members cannot issue commands
    if (issuerNode.rank === 'member') {
      throw new ForbiddenError('Members cannot issue commands. Only commanders and leaders can.');
    }

    // Resolve recipients based on scope
    const resolvedRecipientIds = this.resolveRecipients(chain, userId, targetScope);

    if (resolvedRecipientIds.length === 0) {
      throw new ValidationError('No recipients found for this command scope');
    }

    const commandId = crypto.randomUUID();
    const command: CommandState = {
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

    // Store command
    await redisClient.set(CMD_KEY(commandId), command, CMD_TTL);

    // Add to activity command list
    const cmdList = (await redisClient.get<string[]>(CMD_LIST_KEY(activityId))) ?? [];
    cmdList.push(commandId);
    await redisClient.set(CMD_LIST_KEY(activityId), cmdList, CHAIN_TTL);

    // Broadcast to org
    emitToOrganization(organizationId, 'activity:command_issued', {
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

    logger.info(
      `Command ${commandId} (${type}) issued by ${userName} for activity ${activityId} — ${resolvedRecipientIds.length} recipients`
    );

    // Push Discord DM notifications to recipients (fire-and-forget)
    const notifContext =
      type === 'preflight_check'
        ? NotificationContext.PREFLIGHT_CHECK
        : NotificationContext.COMMAND_RECEIVED;
    const priorityLabels: Record<string, string> = { critical: 'CRITICAL', urgent: 'URGENT' };
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
          /* notification delivery is best-effort */
        });
    }

    return command;
  }

  /**
   * Acknowledge a command. Voice-command friendly — just "acknowledged".
   */
  async acknowledgeCommand(
    commandId: string,
    userId: string,
    userName: string,
    response?: string
  ): Promise<CommandState> {
    const command = await redisClient.get<CommandState>(CMD_KEY(commandId));
    if (!command) {
      throw new NotFoundError('Command not found or expired');
    }

    // Verify user is a recipient
    if (!command.targetScope.resolvedRecipientIds.includes(userId)) {
      throw new ForbiddenError('You are not a recipient of this command');
    }

    // Check not already acknowledged
    if (command.acknowledgements.some(a => a.userId === userId)) {
      throw new ConflictError('You have already acknowledged this command');
    }

    command.acknowledgements.push({
      userId,
      userName,
      acknowledgedAt: new Date().toISOString(),
      response,
    });

    // Check if all acknowledged
    if (command.acknowledgements.length === command.targetScope.resolvedRecipientIds.length) {
      command.status = 'acknowledged';
      command.acknowledgedAt = new Date().toISOString();
    }

    await redisClient.set(CMD_KEY(commandId), command, CMD_TTL);

    // Broadcast acknowledgement
    emitToOrganization(command.organizationId, 'activity:command_acknowledged', {
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

  /**
   * Get all commands for an activity.
   */
  async getCommands(activityId: string): Promise<CommandState[]> {
    const cmdList = await redisClient.get<string[]>(CMD_LIST_KEY(activityId));
    if (!cmdList || cmdList.length === 0) {
      return [];
    }

    const commands: CommandState[] = [];
    for (const cmdId of cmdList) {
      const cmd = await redisClient.get<CommandState>(CMD_KEY(cmdId));
      if (cmd) {
        commands.push(cmd);
      }
    }

    return commands.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }

  /**
   * Get a specific command.
   */
  async getCommand(commandId: string): Promise<CommandState | null> {
    return redisClient.get<CommandState>(CMD_KEY(commandId));
  }

  // =========================================================================
  // Pre-flight Check (specialized command)
  // =========================================================================

  /**
   * Issue a pre-flight check command to all participants.
   * This is a convenience wrapper that combines a command with a ready check prompt.
   */
  async issuePreflightCheck(
    activityId: string,
    organizationId: string,
    userId: string,
    userName: string
  ): Promise<CommandState> {
    return this.issueCommand(
      activityId,
      organizationId,
      { userId, userName },
      'preflight_check',
      'All stations: Pre-flight check. Report status.',
      { type: 'all' },
      { priority: 'urgent' }
    );
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private async loadAndVerifyActivity(
    activityId: string,
    organizationId: string
  ): Promise<Activity> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId, organizationId },
    });
    if (!activity) {
      throw new NotFoundError('Activity not found');
    }

    const validStatuses: ActivityStatus[] = [
      ActivityStatus.OPEN,
      ActivityStatus.PLANNING,
      ActivityStatus.RECRUITING,
      ActivityStatus.READY,
      ActivityStatus.IN_PROGRESS,
    ];
    if (!validStatuses.includes(activity.status)) {
      throw new ValidationError(`Cannot manage commands for activity in ${activity.status} status`);
    }

    return activity;
  }

  private async getAcceptedParticipantIds(activityId: string): Promise<Set<string>> {
    const participants = await this.participantRepo.find({
      where: { activityId, status: ActivityParticipantStatus.ACCEPTED },
      select: ['userId'],
    });
    return new Set(participants.map(p => p.userId));
  }

  /**
   * Resolve which users should receive a command based on the scope and chain hierarchy.
   * A user can only command those below them in the chain.
   */
  private resolveRecipients(
    chain: OperationCommandChain,
    issuerId: string,
    scope: {
      type: 'all' | 'fleet' | 'squadron' | 'individual';
      fleetId?: string;
      squadronName?: string;
      userIds?: string[];
    }
  ): string[] {
    const allSubordinates = this.getAllSubordinates(chain, issuerId);

    switch (scope.type) {
      case 'all':
        return allSubordinates;

      case 'fleet': {
        if (!scope.fleetId) {
          return allSubordinates;
        }
        // Find the fleet commander for this fleet
        const fcNode = Object.values(chain.nodes).find(
          n => n.rank === 'fleet_commander' && n.fleetId === scope.fleetId
        );
        if (!fcNode) {
          return [];
        }
        // Return the FC and all their subordinates
        return [fcNode.userId, ...this.getAllSubordinates(chain, fcNode.userId)];
      }

      case 'squadron': {
        if (!scope.squadronName) {
          return allSubordinates;
        }
        const slNode = Object.values(chain.nodes).find(
          n => n.rank === 'squadron_leader' && n.squadronName === scope.squadronName
        );
        if (!slNode) {
          return [];
        }
        return [slNode.userId, ...this.getAllSubordinates(chain, slNode.userId)];
      }

      case 'individual':
        // Only allow commanding subordinates
        return (scope.userIds ?? []).filter(uid => allSubordinates.includes(uid));

      default:
        return allSubordinates;
    }
  }

  /**
   * Recursively get all subordinates of a user in the chain.
   */
  private getAllSubordinates(chain: OperationCommandChain, userId: string): string[] {
    const node = chain.nodes[userId];
    if (!node) {
      return [];
    }

    const result: string[] = [];
    for (const subId of node.subordinateIds) {
      result.push(subId, ...this.getAllSubordinates(chain, subId));
    }
    return result;
  }
}

