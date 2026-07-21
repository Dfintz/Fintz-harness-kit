import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandlerV2';
import { friendshipService } from '../services/social/FriendshipService';
import { LFGSessionStatus, lfgSessionService } from '../services/social/LFGSessionService';
import { SocialGroupService } from '../services/social/SocialGroupService';
import { LFGActivity } from '../types';
import { ApiErrorCode } from '../types/api';
import { getErrorMessage } from '../utils/errorHandler';
import {
  emitLfgMemberJoined,
  emitLfgMemberLeft,
  emitLfgSessionCancelled,
} from '../websocket/controllers/lfgWebSocketController';

export class SocialController {
  private readonly socialGroupService: SocialGroupService;

  constructor() {
    this.socialGroupService = SocialGroupService.getInstance();
  }

  private parseStatusFilter(value: unknown): LFGSessionStatus | LFGSessionStatus[] | undefined {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value as LFGSessionStatus[];
    }

    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map(status => status.trim())
        .filter(Boolean) as LFGSessionStatus[];
    }

    return value as LFGSessionStatus;
  }

  createGroup(req: AuthRequest, res: Response): void {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      activity,
      description,
      creatorName,
      maxPlayers,
      guildId,
      channelId,
      expirationMinutes,
    } = req.body as {
      activity?: LFGActivity;
      description?: string;
      creatorName?: string;
      maxPlayers?: number;
      guildId?: string;
      channelId?: string;
      expirationMinutes?: number;
    };

    if (!activity || !description || !creatorName || !maxPlayers || !guildId || !channelId) {
      res.status(400).json({
        error:
          'Missing required fields: activity, description, creatorName, maxPlayers, guildId, channelId',
      });
      return;
    }

    try {
      const post = this.socialGroupService.createPost(
        activity,
        description,
        userId,
        creatorName,
        maxPlayers,
        guildId,
        channelId,
        expirationMinutes
      );
      res.success(post);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create social group post',
      });
    }
  }

  async listGroups(req: AuthRequest, res: Response): Promise<void> {
    const guildId = typeof req.query.guildId === 'string' ? req.query.guildId : undefined;

    try {
      const posts = guildId
        ? await this.socialGroupService.getActivePostsByGuild(guildId)
        : await this.socialGroupService.getAllActivePosts();
      res.success(posts);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list social group posts',
      });
    }
  }

  joinGroup(req: AuthRequest, res: Response): void {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const post = this.socialGroupService.joinPost(req.params.groupId, userId);
      const orgId = req.user?.currentOrganizationId;
      if (orgId) {
        emitLfgMemberJoined(orgId, req.params.groupId, userId);
      }
      res.success(post);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join social group';
      res.status(400).json({ error: message });
    }
  }

  leaveGroup(req: AuthRequest, res: Response): void {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const post = this.socialGroupService.leavePost(req.params.groupId, userId);
      const orgId = req.user?.currentOrganizationId;
      if (orgId) {
        emitLfgMemberLeft(orgId, req.params.groupId, userId);
      }
      res.success(post);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to leave social group';
      res.status(400).json({ error: message });
    }
  }

  closeGroup(req: AuthRequest, res: Response): void {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const post = this.socialGroupService.closePost(req.params.groupId, userId);
      const orgId = req.user?.currentOrganizationId;
      if (orgId) {
        emitLfgSessionCancelled(orgId, req.params.groupId, userId);
      }
      res.success(post);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close social group';
      res.status(400).json({ error: message });
    }
  }

  async convertGroupToTeam(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { groupId } = req.params;
    const { teamName, teamType, organizationId } = req.body as {
      teamName?: string;
      teamType?: string;
      organizationId?: string;
    };

    if (!teamName || !organizationId) {
      res.status(400).json({ error: 'Missing required fields: teamName, organizationId' });
      return;
    }

    try {
      const result = await this.socialGroupService.convertToTeam(
        groupId,
        organizationId,
        teamName,
        teamType
      );
      res.success(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to convert group to team';
      res.status(400).json({ error: message });
    }
  }

  async createSession(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      organizationId,
      activityType,
      title,
      description,
      maxPlayers,
      minPlayers,
      metadata,
      tags,
      ttlSeconds,
    } = req.body as {
      organizationId?: string;
      activityType?: string;
      title?: string;
      description?: string;
      maxPlayers?: number;
      minPlayers?: number;
      metadata?: Record<string, unknown>;
      tags?: string[];
      ttlSeconds?: number;
    };

    if (!organizationId || !activityType || !title || !maxPlayers) {
      res.status(400).json({
        error: 'Missing required fields: organizationId, activityType, title, maxPlayers',
      });
      return;
    }

    try {
      const session = await lfgSessionService.createSession({
        hostUserId: userId,
        organizationId,
        activityType,
        title,
        description,
        maxPlayers,
        minPlayers,
        metadata,
        tags,
        ttlSeconds,
      });
      res.success(session);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create LFG session',
      });
    }
  }

  async listSessions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const status = this.parseStatusFilter(req.query.status);
      const minAvailableSlots =
        typeof req.query.minAvailableSlots === 'string'
          ? Number.parseInt(req.query.minAvailableSlots, 10)
          : undefined;

      const tags =
        typeof req.query.tags === 'string'
          ? req.query.tags
              .split(',')
              .map(tag => tag.trim())
              .filter(Boolean)
          : undefined;

      const sessions = await lfgSessionService.findOpenSessions({
        activityType:
          typeof req.query.activityType === 'string' ? req.query.activityType : undefined,
        organizationId:
          typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined,
        status,
        minAvailableSlots,
        tags,
        hostUserId: typeof req.query.hostUserId === 'string' ? req.query.hostUserId : undefined,
      });

      res.success(sessions);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list LFG sessions',
      });
    }
  }

  async getSession(req: AuthRequest, res: Response): Promise<void> {
    const session = await lfgSessionService.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.success(session);
  }

  async joinSession(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await lfgSessionService.joinSession(req.params.sessionId, userId);
    if (!result.success) {
      res.status(400).json({ error: result.error ?? 'Failed to join session' });
      return;
    }

    res.success(result.session);
  }

  async leaveSession(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await lfgSessionService.leaveSession(req.params.sessionId, userId);
    if (!result.success) {
      res.status(400).json({ error: result.error ?? 'Failed to leave session' });
      return;
    }

    res.success(result.session);
  }

  async startSession(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await lfgSessionService.startSession(req.params.sessionId, userId);
    if (!result.success) {
      res.status(400).json({ error: result.error ?? 'Failed to start session' });
      return;
    }

    res.success(result.session);
  }

  async completeSession(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await lfgSessionService.completeSession(req.params.sessionId, userId);
    if (!result.success) {
      res.status(400).json({ error: result.error ?? 'Failed to complete session' });
      return;
    }

    res.success(result.session);
  }

  async cancelSession(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await lfgSessionService.cancelSession(req.params.sessionId, userId);
    if (!result.success) {
      res.status(400).json({ error: result.error ?? 'Failed to cancel session' });
      return;
    }

    res.success(result.session);
  }

  async getFriends(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const [friends, incoming] = await Promise.all([
        friendshipService.getFriends(userId),
        friendshipService.getIncomingRequests(userId),
      ]);
      res.success({ friends, incomingRequests: incoming });
    } catch (error) {
      this.handleFriendshipError(res, error, 'Failed to load friends');
    }
  }

  async addFriend(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const connection = await friendshipService.sendFriendRequest(userId, req.params.userId);
      res.success({
        connectionId: connection.id,
        targetUserId: connection.targetUserId,
        status: connection.status,
        createdAt: connection.createdAt,
      });
    } catch (error) {
      this.handleFriendshipError(res, error, 'Failed to send friend request');
    }
  }

  async removeFriend(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      await friendshipService.removeFriend(userId, req.params.userId);
      res.success({ removed: true });
    } catch (error) {
      this.handleFriendshipError(res, error, 'Failed to remove friend');
    }
  }

  async acceptFriend(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const connection = await friendshipService.acceptFriendRequest(userId, req.params.userId);
      res.success({
        connectionId: connection.id,
        userId: connection.userId,
        targetUserId: connection.targetUserId,
        status: connection.status,
        updatedAt: connection.updatedAt,
      });
    } catch (error) {
      this.handleFriendshipError(res, error, 'Failed to accept friend request');
    }
  }

  private handleFriendshipError(res: Response, error: unknown, fallback: string): void {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ error: error.message, code: error.code });
      return;
    }
    res.status(500).json({
      error: `${fallback}: ${getErrorMessage(error)}`,
      code: ApiErrorCode.INTERNAL_ERROR,
    });
  }

  blockUser(req: AuthRequest, res: Response): void {
    res.success({});
  }

  unblockUser(req: AuthRequest, res: Response): void {
    res.success({});
  }

  getFeed(req: AuthRequest, res: Response): void {
    res.success([]);
  }

  createPost(req: AuthRequest, res: Response): void {
    res.success({});
  }

  likePost(req: AuthRequest, res: Response): void {
    res.success({});
  }

  getPresence(req: AuthRequest, res: Response): void {
    res.success({});
  }
}

let socialControllerInstance: SocialController | null = null;

export const socialController = new Proxy({} as SocialController, {
  get(_target, prop) {
    socialControllerInstance ??= new SocialController();
    return (socialControllerInstance as unknown as Record<string, unknown>)[prop as string];
  },
});
