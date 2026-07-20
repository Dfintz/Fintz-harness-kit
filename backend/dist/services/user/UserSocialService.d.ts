import { User } from '../../models/User';
export declare enum SocialConnectionType {
    FRIEND = "friend",
    FOLLOWER = "follower",
    FOLLOWING = "following",
    BLOCKED = "blocked",
    MUTED = "muted"
}
export interface SocialConnection {
    id: string;
    userId: string;
    targetUserId: string;
    type: SocialConnectionType;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
}
export declare enum SocialActivityType {
    PROFILE_VIEW = "profile_view",
    FRIEND_REQUEST_SENT = "friend_request_sent",
    FRIEND_REQUEST_RECEIVED = "friend_request_received",
    FRIEND_ADDED = "friend_added",
    USER_FOLLOWED = "user_followed",
    USER_UNFOLLOWED = "user_unfollowed",
    MESSAGE_SENT = "message_sent",
    GROUP_JOINED = "group_joined",
    ORGANIZATION_JOINED = "organization_joined"
}
export interface SocialActivity {
    id: string;
    userId: string;
    targetUserId?: string;
    activityType: SocialActivityType;
    description: string;
    metadata?: Record<string, unknown>;
    isPublic: boolean;
    createdAt: Date;
}
export declare class UserSocialService {
    private userRepository;
    sendFriendRequest(userId: string, targetUserId: string): Promise<SocialConnection>;
    acceptFriendRequest(userId: string, requesterId: string): Promise<SocialConnection>;
    rejectFriendRequest(userId: string, requesterId: string): Promise<void>;
    removeFriend(userId: string, friendId: string): Promise<void>;
    getFriends(userId: string, _limit?: number): Promise<User[]>;
    getPendingFriendRequests(_userId: string): Promise<Array<{
        connection: SocialConnection;
        requester: User;
    }>>;
    getSentFriendRequests(_userId: string): Promise<Array<{
        connection: SocialConnection;
        targetUser: User;
    }>>;
    followUser(userId: string, targetUserId: string): Promise<SocialConnection>;
    unfollowUser(userId: string, targetUserId: string): Promise<void>;
    getFollowing(userId: string, _limit?: number): Promise<User[]>;
    getFollowers(userId: string, _limit?: number): Promise<User[]>;
    blockUser(userId: string, targetUserId: string): Promise<SocialConnection>;
    unblockUser(userId: string, targetUserId: string): Promise<void>;
    getBlockedUsers(_userId: string): Promise<User[]>;
    isBlockedBy(userId: string, checkUserId: string): Promise<boolean>;
    logSocialActivity(activityData: Omit<SocialActivity, 'id' | 'createdAt'>): Promise<SocialActivity>;
    getSocialActivityFeed(_userId: string, _limit?: number, _includePrivate?: boolean): Promise<SocialActivity[]>;
    getSocialStats(_userId: string): Promise<{
        friendCount: number;
        followerCount: number;
        followingCount: number;
        blockedCount: number;
        profileViews: number;
        recentActivityCount: number;
    }>;
    getMutualFriends(_userId1: string, _userId2: string): Promise<User[]>;
    getMutualFollowers(_userId1: string, _userId2: string): Promise<User[]>;
    getConnectionSuggestions(userId: string, _limit?: number): Promise<User[]>;
    private getConnection;
    private getBidirectionalConnections;
    private removeAllConnections;
    private generateId;
    canInteract(userId: string, targetUserId: string): Promise<boolean>;
    getRelationshipStatus(userId: string, targetUserId: string): Promise<{
        areFriends: boolean;
        isFollowing: boolean;
        isFollowedBy: boolean;
        isBlocked: boolean;
        hasBlocked: boolean;
        hasPendingRequest: boolean;
        canSendRequest: boolean;
    }>;
}
//# sourceMappingURL=UserSocialService.d.ts.map