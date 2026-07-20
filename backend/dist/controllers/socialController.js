"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialController = exports.SocialController = void 0;
const errorHandlerV2_1 = require("../middleware/errorHandlerV2");
const FriendshipService_1 = require("../services/social/FriendshipService");
const LFGSessionService_1 = require("../services/social/LFGSessionService");
const SocialGroupService_1 = require("../services/social/SocialGroupService");
const api_1 = require("../types/api");
const errorHandler_1 = require("../utils/errorHandler");
const lfgWebSocketController_1 = require("../websocket/controllers/lfgWebSocketController");
class SocialController {
    socialGroupService;
    constructor() {
        this.socialGroupService = SocialGroupService_1.SocialGroupService.getInstance();
    }
    parseStatusFilter(value) {
        if (!value) {
            return undefined;
        }
        if (Array.isArray(value)) {
            return value;
        }
        if (typeof value === 'string' && value.includes(',')) {
            return value
                .split(',')
                .map(status => status.trim())
                .filter(Boolean);
        }
        return value;
    }
    createGroup(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { activity, description, creatorName, maxPlayers, guildId, channelId, expirationMinutes, } = req.body;
        if (!activity || !description || !creatorName || !maxPlayers || !guildId || !channelId) {
            res.status(400).json({
                error: 'Missing required fields: activity, description, creatorName, maxPlayers, guildId, channelId',
            });
            return;
        }
        try {
            const post = this.socialGroupService.createPost(activity, description, userId, creatorName, maxPlayers, guildId, channelId, expirationMinutes);
            res.success(post);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to create social group post',
            });
        }
    }
    async listGroups(req, res) {
        const guildId = typeof req.query.guildId === 'string' ? req.query.guildId : undefined;
        try {
            const posts = guildId
                ? await this.socialGroupService.getActivePostsByGuild(guildId)
                : await this.socialGroupService.getAllActivePosts();
            res.success(posts);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to list social group posts',
            });
        }
    }
    joinGroup(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        try {
            const post = this.socialGroupService.joinPost(req.params.groupId, userId);
            const orgId = req.user?.currentOrganizationId;
            if (orgId) {
                (0, lfgWebSocketController_1.emitLfgMemberJoined)(orgId, req.params.groupId, userId);
            }
            res.success(post);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to join social group';
            res.status(400).json({ error: message });
        }
    }
    leaveGroup(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        try {
            const post = this.socialGroupService.leavePost(req.params.groupId, userId);
            const orgId = req.user?.currentOrganizationId;
            if (orgId) {
                (0, lfgWebSocketController_1.emitLfgMemberLeft)(orgId, req.params.groupId, userId);
            }
            res.success(post);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to leave social group';
            res.status(400).json({ error: message });
        }
    }
    closeGroup(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        try {
            const post = this.socialGroupService.closePost(req.params.groupId, userId);
            const orgId = req.user?.currentOrganizationId;
            if (orgId) {
                (0, lfgWebSocketController_1.emitLfgSessionCancelled)(orgId, req.params.groupId, userId);
            }
            res.success(post);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to close social group';
            res.status(400).json({ error: message });
        }
    }
    async convertGroupToTeam(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { groupId } = req.params;
        const { teamName, teamType, organizationId } = req.body;
        if (!teamName || !organizationId) {
            res.status(400).json({ error: 'Missing required fields: teamName, organizationId' });
            return;
        }
        try {
            const result = await this.socialGroupService.convertToTeam(groupId, organizationId, teamName, teamType);
            res.success(result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to convert group to team';
            res.status(400).json({ error: message });
        }
    }
    async createSession(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { organizationId, activityType, title, description, maxPlayers, minPlayers, metadata, tags, ttlSeconds, } = req.body;
        if (!organizationId || !activityType || !title || !maxPlayers) {
            res.status(400).json({
                error: 'Missing required fields: organizationId, activityType, title, maxPlayers',
            });
            return;
        }
        try {
            const session = await LFGSessionService_1.lfgSessionService.createSession({
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
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to create LFG session',
            });
        }
    }
    async listSessions(req, res) {
        try {
            const status = this.parseStatusFilter(req.query.status);
            const minAvailableSlots = typeof req.query.minAvailableSlots === 'string'
                ? Number.parseInt(req.query.minAvailableSlots, 10)
                : undefined;
            const tags = typeof req.query.tags === 'string'
                ? req.query.tags
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(Boolean)
                : undefined;
            const sessions = await LFGSessionService_1.lfgSessionService.findOpenSessions({
                activityType: typeof req.query.activityType === 'string' ? req.query.activityType : undefined,
                organizationId: typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined,
                status,
                minAvailableSlots,
                tags,
                hostUserId: typeof req.query.hostUserId === 'string' ? req.query.hostUserId : undefined,
            });
            res.success(sessions);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to list LFG sessions',
            });
        }
    }
    async getSession(req, res) {
        const session = await LFGSessionService_1.lfgSessionService.getSession(req.params.sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        res.success(session);
    }
    async joinSession(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await LFGSessionService_1.lfgSessionService.joinSession(req.params.sessionId, userId);
        if (!result.success) {
            res.status(400).json({ error: result.error ?? 'Failed to join session' });
            return;
        }
        res.success(result.session);
    }
    async leaveSession(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await LFGSessionService_1.lfgSessionService.leaveSession(req.params.sessionId, userId);
        if (!result.success) {
            res.status(400).json({ error: result.error ?? 'Failed to leave session' });
            return;
        }
        res.success(result.session);
    }
    async startSession(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await LFGSessionService_1.lfgSessionService.startSession(req.params.sessionId, userId);
        if (!result.success) {
            res.status(400).json({ error: result.error ?? 'Failed to start session' });
            return;
        }
        res.success(result.session);
    }
    async completeSession(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await LFGSessionService_1.lfgSessionService.completeSession(req.params.sessionId, userId);
        if (!result.success) {
            res.status(400).json({ error: result.error ?? 'Failed to complete session' });
            return;
        }
        res.success(result.session);
    }
    async cancelSession(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await LFGSessionService_1.lfgSessionService.cancelSession(req.params.sessionId, userId);
        if (!result.success) {
            res.status(400).json({ error: result.error ?? 'Failed to cancel session' });
            return;
        }
        res.success(result.session);
    }
    async getFriends(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        try {
            const [friends, incoming] = await Promise.all([
                FriendshipService_1.friendshipService.getFriends(userId),
                FriendshipService_1.friendshipService.getIncomingRequests(userId),
            ]);
            res.success({ friends, incomingRequests: incoming });
        }
        catch (error) {
            this.handleFriendshipError(res, error, 'Failed to load friends');
        }
    }
    async addFriend(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        try {
            const connection = await FriendshipService_1.friendshipService.sendFriendRequest(userId, req.params.userId);
            res.success({
                connectionId: connection.id,
                targetUserId: connection.targetUserId,
                status: connection.status,
                createdAt: connection.createdAt,
            });
        }
        catch (error) {
            this.handleFriendshipError(res, error, 'Failed to send friend request');
        }
    }
    async removeFriend(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        try {
            await FriendshipService_1.friendshipService.removeFriend(userId, req.params.userId);
            res.success({ removed: true });
        }
        catch (error) {
            this.handleFriendshipError(res, error, 'Failed to remove friend');
        }
    }
    async acceptFriend(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        try {
            const connection = await FriendshipService_1.friendshipService.acceptFriendRequest(userId, req.params.userId);
            res.success({
                connectionId: connection.id,
                userId: connection.userId,
                targetUserId: connection.targetUserId,
                status: connection.status,
                updatedAt: connection.updatedAt,
            });
        }
        catch (error) {
            this.handleFriendshipError(res, error, 'Failed to accept friend request');
        }
    }
    handleFriendshipError(res, error, fallback) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            res.status(error.statusCode).json({ error: error.message, code: error.code });
            return;
        }
        res.status(500).json({
            error: `${fallback}: ${(0, errorHandler_1.getErrorMessage)(error)}`,
            code: api_1.ApiErrorCode.INTERNAL_ERROR,
        });
    }
    blockUser(req, res) {
        res.success({});
    }
    unblockUser(req, res) {
        res.success({});
    }
    getFeed(req, res) {
        res.success([]);
    }
    createPost(req, res) {
        res.success({});
    }
    likePost(req, res) {
        res.success({});
    }
    getPresence(req, res) {
        res.success({});
    }
}
exports.SocialController = SocialController;
let socialControllerInstance = null;
exports.socialController = new Proxy({}, {
    get(_target, prop) {
        socialControllerInstance ??= new SocialController();
        return socialControllerInstance[prop];
    },
});
//# sourceMappingURL=socialController.js.map