import { Brackets, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { User } from '../../models/User';
import {
  UserSocialConnection,
  UserSocialConnectionStatus,
  UserSocialConnectionType,
} from '../../models/UserSocialConnection';
import { ApiErrorCode } from '../../types/api';
import { ApiError } from '../../utils/apiErrors';

export interface FriendSummary {
  connectionId: string;
  userId: string;
  username: string;
  connectedAt: Date;
}

export interface FriendRequestSummary {
  connectionId: string;
  fromUserId: string;
  fromUsername: string;
  createdAt: Date;
}

/**
 * FriendshipService — persistent social-graph operations between users.
 *
 * Friendship model: one row from requester → target with status transitions.
 *   pending  : request awaiting target's response
 *   accepted : both users are friends (reciprocity is derived in queries)
 *   rejected : terminal; the row is kept briefly then can be re-created
 */
export class FriendshipService {
  private static instance: FriendshipService;
  private readonly connectionRepo: Repository<UserSocialConnection>;
  private readonly userRepo: Repository<User>;

  private constructor() {
    this.connectionRepo = AppDataSource.getRepository(UserSocialConnection);
    this.userRepo = AppDataSource.getRepository(User);
  }

  static getInstance(): FriendshipService {
    FriendshipService.instance ||= new FriendshipService();
    return FriendshipService.instance;
  }

  /**
   * Send (or re-send) a friend request from `userId` to `targetUserId`.
   */
  async sendFriendRequest(userId: string, targetUserId: string): Promise<UserSocialConnection> {
    if (userId === targetUserId) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Cannot send a friend request to yourself',
        400
      );
    }

    const targetUser = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Target user not found', 404);
    }

    // Look up either direction for an existing FRIEND connection
    const existing = await this.findFriendConnection(userId, targetUserId);

    if (existing?.status === UserSocialConnectionStatus.ACCEPTED) {
      throw new ApiError(
        ApiErrorCode.RESOURCE_CONFLICT,
        'You are already friends with this user',
        409
      );
    }
    if (existing?.status === UserSocialConnectionStatus.PENDING) {
      // If the target previously sent you a request, accept it instead of duplicating.
      if (existing.userId === targetUserId) {
        return this.acceptByConnection(existing);
      }
      throw new ApiError(ApiErrorCode.RESOURCE_CONFLICT, 'Friend request already pending', 409);
    }

    // existing is rejected or absent — create a fresh request
    if (existing?.status === UserSocialConnectionStatus.REJECTED) {
      await this.connectionRepo.remove(existing);
    }

    const connection = this.connectionRepo.create({
      userId,
      targetUserId,
      connectionType: UserSocialConnectionType.FRIEND,
      status: UserSocialConnectionStatus.PENDING,
    });
    return this.connectionRepo.save(connection);
  }

  /**
   * Accept a pending friend request that was sent TO `userId` by `requesterId`.
   */
  async acceptFriendRequest(userId: string, requesterId: string): Promise<UserSocialConnection> {
    const connection = await this.connectionRepo.findOne({
      where: {
        userId: requesterId,
        targetUserId: userId,
        connectionType: UserSocialConnectionType.FRIEND,
        status: UserSocialConnectionStatus.PENDING,
      },
    });
    if (!connection) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'No pending friend request found', 404);
    }
    return this.acceptByConnection(connection);
  }

  /**
   * Reject a pending friend request that was sent TO `userId` by `requesterId`.
   */
  async rejectFriendRequest(userId: string, requesterId: string): Promise<void> {
    const connection = await this.connectionRepo.findOne({
      where: {
        userId: requesterId,
        targetUserId: userId,
        connectionType: UserSocialConnectionType.FRIEND,
        status: UserSocialConnectionStatus.PENDING,
      },
    });
    if (!connection) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'No pending friend request found', 404);
    }
    connection.status = UserSocialConnectionStatus.REJECTED;
    await this.connectionRepo.save(connection);
  }

  /**
   * Remove an existing friend (or cancel a pending outgoing request) in either direction.
   */
  async removeFriend(userId: string, otherUserId: string): Promise<void> {
    const connection = await this.findFriendConnection(userId, otherUserId);
    if (!connection) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Friend connection not found', 404);
    }
    await this.connectionRepo.remove(connection);
  }

  /**
   * List the user's accepted friends.
   */
  async getFriends(userId: string): Promise<FriendSummary[]> {
    const rows = await this.connectionRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .leftJoinAndSelect('c.targetUser', 't')
      .where('c.connectionType = :type', { type: UserSocialConnectionType.FRIEND })
      .andWhere('c.status = :status', { status: UserSocialConnectionStatus.ACCEPTED })
      .andWhere(
        new Brackets(qb => {
          qb.where('c.userId = :uid', { uid: userId }).orWhere('c.targetUserId = :uid', {
            uid: userId,
          });
        })
      )
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

  /**
   * List pending friend requests INCOMING to the user.
   */
  async getIncomingRequests(userId: string): Promise<FriendRequestSummary[]> {
    const rows = await this.connectionRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .where('c.targetUserId = :uid', { uid: userId })
      .andWhere('c.connectionType = :type', { type: UserSocialConnectionType.FRIEND })
      .andWhere('c.status = :status', { status: UserSocialConnectionStatus.PENDING })
      .orderBy('c.createdAt', 'DESC')
      .getMany();

    return rows.map(row => ({
      connectionId: row.id,
      fromUserId: row.userId,
      fromUsername: row.user?.username ?? 'unknown',
      createdAt: row.createdAt,
    }));
  }

  /**
   * Return the set of userIds that the given user is already friends with
   * (in either direction). Useful for similarity exclusion.
   */
  async getFriendUserIds(userId: string): Promise<Set<string>> {
    const rows = await this.connectionRepo.find({
      where: [
        {
          userId,
          connectionType: UserSocialConnectionType.FRIEND,
          status: UserSocialConnectionStatus.ACCEPTED,
        },
        {
          targetUserId: userId,
          connectionType: UserSocialConnectionType.FRIEND,
          status: UserSocialConnectionStatus.ACCEPTED,
        },
      ],
      select: ['userId', 'targetUserId'],
    });
    const out = new Set<string>();
    for (const row of rows) {
      out.add(row.userId === userId ? row.targetUserId : row.userId);
    }
    return out;
  }

  // ==================== INTERNAL ====================

  private async findFriendConnection(a: string, b: string): Promise<UserSocialConnection | null> {
    return this.connectionRepo
      .createQueryBuilder('c')
      .where('c.connectionType = :type', { type: UserSocialConnectionType.FRIEND })
      .andWhere(
        new Brackets(qb => {
          qb.where('(c.userId = :a AND c.targetUserId = :b)', { a, b }).orWhere(
            '(c.userId = :b AND c.targetUserId = :a)',
            { a, b }
          );
        })
      )
      .getOne();
  }

  private async acceptByConnection(
    connection: UserSocialConnection
  ): Promise<UserSocialConnection> {
    connection.status = UserSocialConnectionStatus.ACCEPTED;
    return this.connectionRepo.save(connection);
  }
}

export const friendshipService = FriendshipService.getInstance();

