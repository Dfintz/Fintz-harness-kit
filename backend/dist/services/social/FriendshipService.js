"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.friendshipService = exports.FriendshipService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const User_1 = require("../../models/User");
const UserSocialConnection_1 = require("../../models/UserSocialConnection");
const api_1 = require("../../types/api");
const apiErrors_1 = require("../../utils/apiErrors");
class FriendshipService {
    static instance;
    connectionRepo;
    userRepo;
    constructor() {
        this.connectionRepo = data_source_1.AppDataSource.getRepository(UserSocialConnection_1.UserSocialConnection);
        this.userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
    }
    static getInstance() {
        FriendshipService.instance ||= new FriendshipService();
        return FriendshipService.instance;
    }
    async sendFriendRequest(userId, targetUserId) {
        if (userId === targetUserId) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Cannot send a friend request to yourself', 400);
        }
        const targetUser = await this.userRepo.findOne({ where: { id: targetUserId } });
        if (!targetUser) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Target user not found', 404);
        }
        const existing = await this.findFriendConnection(userId, targetUserId);
        if (existing?.status === UserSocialConnection_1.UserSocialConnectionStatus.ACCEPTED) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_CONFLICT, 'You are already friends with this user', 409);
        }
        if (existing?.status === UserSocialConnection_1.UserSocialConnectionStatus.PENDING) {
            if (existing.userId === targetUserId) {
                return this.acceptByConnection(existing);
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_CONFLICT, 'Friend request already pending', 409);
        }
        if (existing?.status === UserSocialConnection_1.UserSocialConnectionStatus.REJECTED) {
            await this.connectionRepo.remove(existing);
        }
        const connection = this.connectionRepo.create({
            userId,
            targetUserId,
            connectionType: UserSocialConnection_1.UserSocialConnectionType.FRIEND,
            status: UserSocialConnection_1.UserSocialConnectionStatus.PENDING,
        });
        return this.connectionRepo.save(connection);
    }
    async acceptFriendRequest(userId, requesterId) {
        const connection = await this.connectionRepo.findOne({
            where: {
                userId: requesterId,
                targetUserId: userId,
                connectionType: UserSocialConnection_1.UserSocialConnectionType.FRIEND,
                status: UserSocialConnection_1.UserSocialConnectionStatus.PENDING,
            },
        });
        if (!connection) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'No pending friend request found', 404);
        }
        return this.acceptByConnection(connection);
    }
    async rejectFriendRequest(userId, requesterId) {
        const connection = await this.connectionRepo.findOne({
            where: {
                userId: requesterId,
                targetUserId: userId,
                connectionType: UserSocialConnection_1.UserSocialConnectionType.FRIEND,
                status: UserSocialConnection_1.UserSocialConnectionStatus.PENDING,
            },
        });
        if (!connection) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'No pending friend request found', 404);
        }
        connection.status = UserSocialConnection_1.UserSocialConnectionStatus.REJECTED;
        await this.connectionRepo.save(connection);
    }
    async removeFriend(userId, otherUserId) {
        const connection = await this.findFriendConnection(userId, otherUserId);
        if (!connection) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Friend connection not found', 404);
        }
        await this.connectionRepo.remove(connection);
    }
    async getFriends(userId) {
        const rows = await this.connectionRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.user', 'u')
            .leftJoinAndSelect('c.targetUser', 't')
            .where('c.connectionType = :type', { type: UserSocialConnection_1.UserSocialConnectionType.FRIEND })
            .andWhere('c.status = :status', { status: UserSocialConnection_1.UserSocialConnectionStatus.ACCEPTED })
            .andWhere(new typeorm_1.Brackets(qb => {
            qb.where('c.userId = :uid', { uid: userId }).orWhere('c.targetUserId = :uid', {
                uid: userId,
            });
        }))
            .orderBy('c.updatedAt', 'DESC')
            .getMany();
        return rows.map(row => {
            const friend = row.userId === userId ? row.targetUser : row.user;
            return {
                connectionId: row.id,
                userId: friend?.id ?? (row.userId === userId ? row.targetUserId : row.userId),
                username: friend?.username ?? 'unknown',
                connectedAt: row.updatedAt,
            };
        });
    }
    async getIncomingRequests(userId) {
        const rows = await this.connectionRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.user', 'u')
            .where('c.targetUserId = :uid', { uid: userId })
            .andWhere('c.connectionType = :type', { type: UserSocialConnection_1.UserSocialConnectionType.FRIEND })
            .andWhere('c.status = :status', { status: UserSocialConnection_1.UserSocialConnectionStatus.PENDING })
            .orderBy('c.createdAt', 'DESC')
            .getMany();
        return rows.map(row => ({
            connectionId: row.id,
            fromUserId: row.userId,
            fromUsername: row.user?.username ?? 'unknown',
            createdAt: row.createdAt,
        }));
    }
    async getFriendUserIds(userId) {
        const rows = await this.connectionRepo.find({
            where: [
                {
                    userId,
                    connectionType: UserSocialConnection_1.UserSocialConnectionType.FRIEND,
                    status: UserSocialConnection_1.UserSocialConnectionStatus.ACCEPTED,
                },
                {
                    targetUserId: userId,
                    connectionType: UserSocialConnection_1.UserSocialConnectionType.FRIEND,
                    status: UserSocialConnection_1.UserSocialConnectionStatus.ACCEPTED,
                },
            ],
            select: ['userId', 'targetUserId'],
        });
        const out = new Set();
        for (const row of rows) {
            out.add(row.userId === userId ? row.targetUserId : row.userId);
        }
        return out;
    }
    async findFriendConnection(a, b) {
        return this.connectionRepo
            .createQueryBuilder('c')
            .where('c.connectionType = :type', { type: UserSocialConnection_1.UserSocialConnectionType.FRIEND })
            .andWhere(new typeorm_1.Brackets(qb => {
            qb.where('(c.userId = :a AND c.targetUserId = :b)', { a, b }).orWhere('(c.userId = :b AND c.targetUserId = :a)', { a, b });
        }))
            .getOne();
    }
    async acceptByConnection(connection) {
        connection.status = UserSocialConnection_1.UserSocialConnectionStatus.ACCEPTED;
        return this.connectionRepo.save(connection);
    }
}
exports.FriendshipService = FriendshipService;
exports.friendshipService = FriendshipService.getInstance();
//# sourceMappingURL=FriendshipService.js.map